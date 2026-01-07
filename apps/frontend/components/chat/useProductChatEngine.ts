'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message, Step, ProductData, Suggestion, DocumentAnalysis } from './types';
import { generateObjectionResponses, extractCleanValue } from '@/lib/ai-api';

// Create steps based on product type and document analysis
function createProductSteps(productType?: string, documentAnalysis?: DocumentAnalysis): Step[] {
  const hasAnalysis = documentAnalysis && (
    documentAnalysis.suggestedName ||
    documentAnalysis.suggestedBenefits?.length ||
    documentAnalysis.suggestedDescription
  );

  // Generate name suggestions from analysis OR defaults
  const nameSuggestions: Suggestion[] = [];

  if (hasAnalysis && documentAnalysis?.suggestedName) {
    // When we have AI analysis, only show AI-generated name as primary
    nameSuggestions.push({
      id: 'ai-name-1',
      text: documentAnalysis.suggestedName,
      isAI: true,
    });

    // Add variations based on the suggested name
    const baseName = documentAnalysis.suggestedName;
    if (!baseName.toLowerCase().includes('método')) {
      nameSuggestions.push({
        id: 'ai-name-2',
        text: `Método ${baseName.split(' ').slice(0, 3).join(' ')}`,
        isAI: true,
      });
    }
    if (!baseName.toLowerCase().includes('guia')) {
      nameSuggestions.push({
        id: 'ai-name-3',
        text: `Guia ${baseName.split(' ').slice(0, 3).join(' ')}`,
        isAI: true,
      });
    }
  } else {
    // Only show generic defaults when NO analysis is available
    const defaultNames = [
      `Método ${productType || 'Definitivo'}`,
      'Guia Completo Passo a Passo',
      'Segredo dos Profissionais',
    ];
    defaultNames.forEach((name, index) => {
      nameSuggestions.push({
        id: `default-name-${index}`,
        text: name,
        isAI: false,
      });
    });
  }

  // Generate benefit suggestions from analysis OR default suggestions
  const benefitSuggestions: Suggestion[] = [];
  if (documentAnalysis?.suggestedBenefits && documentAnalysis.suggestedBenefits.length > 0) {
    documentAnalysis.suggestedBenefits.slice(0, 3).forEach((benefit, index) => {
      benefitSuggestions.push({
        id: `ai-benefit-${index}`,
        text: benefit,
        isAI: true,
      });
    });
  } else {
    // Default benefit suggestions based on product type
    const defaultBenefits = [
      'Transformação completa em poucas semanas',
      'Resultados garantidos ou seu dinheiro de volta',
      'Método testado e aprovado por centenas de pessoas',
    ];
    defaultBenefits.forEach((benefit, index) => {
      benefitSuggestions.push({
        id: `default-benefit-${index}`,
        text: benefit,
        isAI: true,
      });
    });
  }

  // Generate description suggestions from analysis OR defaults
  const descriptionSuggestions: Suggestion[] = [];
  if (documentAnalysis?.suggestedDescription) {
    descriptionSuggestions.push({
      id: 'ai-desc-1',
      text: documentAnalysis.suggestedDescription,
      isAI: true,
    });
  }
  if (documentAnalysis?.summary) {
    descriptionSuggestions.push({
      id: 'ai-desc-2',
      text: documentAnalysis.summary,
      isAI: true,
    });
  }
  // Always add default description suggestions
  const defaultDescriptions = [
    `Um guia completo que vai te ensinar tudo o que você precisa saber para alcançar seus objetivos.`,
    `Método testado e comprovado que já ajudou centenas de pessoas a transformarem suas vidas.`,
    `Conteúdo exclusivo desenvolvido por especialistas para você ter resultados rápidos e duradouros.`,
  ];
  defaultDescriptions.forEach((desc, index) => {
    if (!descriptionSuggestions.find(s => s.text === desc)) {
      descriptionSuggestions.push({
        id: `default-desc-${index}`,
        text: desc,
        isAI: !hasAnalysis,
      });
    }
  });

  return [
    // Step 1: Thumbnail selection (only for ebooks/PDFs)
    {
      id: 'thumbnail',
      type: 'thumbnail' as const,
      prompt: 'Escolha uma imagem para a capa do seu produto. Essa imagem aparecerá no catálogo do WhatsApp:',
      pdfCoverUrl: documentAnalysis?.pdfCoverUrl,
    },
    // Step 2: Product Name (ALWAYS with suggestions - horizontal scroll)
    {
      id: 'name',
      type: 'suggestions' as const,
      prompt: hasAnalysis
        ? 'Baseado no conteúdo do seu documento, sugiro estes nomes. Deslize para ver as opções:'
        : `Qual é o nome do seu ${productType || 'produto'}? Deslize para ver sugestões ou escreva o seu:`,
      suggestions: nameSuggestions.slice(0, 3),
      allowCustom: true,
      horizontal: true,
    },
    // Step 3: Price with chips
    {
      id: 'price',
      type: 'price-chips' as const,
      prompt: 'Qual vai ser o preço do seu produto?',
      priceOptions: documentAnalysis?.suggestedPrice
        ? [47, documentAnalysis.suggestedPrice, 197].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
        : [47, 97, 197],
      allowCustom: true,
    },
    // NOTE: Free products are delivered via WhatsApp SPM template just like paid products
    // No separate delivery URL is needed - the product from Meta catalog is sent directly
    // Step 4: Main benefit (ALWAYS with suggestions - horizontal scroll)
    {
      id: 'main-benefit',
      type: 'suggestions' as const,
      prompt: hasAnalysis
        ? 'Identifiquei estes benefícios no seu documento. Qual é o PRINCIPAL resultado para o cliente?'
        : 'Qual é o PRINCIPAL resultado que seu cliente vai ter? Deslize para ver as opções:',
      suggestions: benefitSuggestions,
      allowCustom: true,
      horizontal: true,
    },
    // Step 5: Description (ALWAYS with suggestions - horizontal scroll)
    {
      id: 'description',
      type: 'suggestions' as const,
      prompt: hasAnalysis
        ? 'Baseado no documento, criei estas descrições. Escolha ou personalize:'
        : 'Descreva brevemente o que seu produto ensina. Deslize para ver sugestões:',
      suggestions: descriptionSuggestions.slice(0, 3),
      allowCustom: true,
      horizontal: true,
    },
    // Step 6: Ask if objections exist (yes/no)
    {
      id: 'has-objections',
      type: 'yesno' as const,
      prompt: 'Seus leads costumam ter objeções de vendas? (ex: "tá caro", "preciso pensar", "não tenho tempo"...)',
    },
    // Step 7: Objections input (only if has-objections = yes)
    {
      id: 'objections',
      type: 'textarea' as const,
      prompt: 'Quais são as objeções mais comuns? Digite separadas por vírgula ou uma por linha:',
      placeholder: 'Ex: tá caro, não tenho tempo, preciso pensar...',
      conditional: {
        dependsOn: 'has-objections',
        showWhen: 'sim',
      },
    },
    // Step 8: Agent tone (with horizontal suggestions)
    {
      id: 'tone',
      type: 'suggestions' as const,
      prompt: 'Qual tom de voz seu agente deve usar nas conversas? Deslize para escolher:',
      suggestions: [
        { id: 'tone-friendly', text: '🔥 Amigável e motivador - Usa energia positiva, emojis e incentiva o cliente com entusiasmo!', isAI: true },
        { id: 'tone-professional', text: '💼 Profissional e direto - Comunicação clara, objetiva e focada em resultados.', isAI: true },
        { id: 'tone-empathetic', text: '💚 Acolhedor e empático - Escuta ativa, compreensão e conexão emocional com o cliente.', isAI: true },
        { id: 'tone-casual', text: '😄 Descontraído e informal - Linguagem leve, gírias e muita descontração!', isAI: true },
        { id: 'tone-urgent', text: '⚡ Urgente e persuasivo - Cria senso de urgência e usa gatilhos de escassez.', isAI: true },
      ],
      allowCustom: false,
      horizontal: true,
    },
  ];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface UseProductChatEngineOptions {
  getIdToken?: () => Promise<string | null>;
}

export function useProductChatEngine(options: UseProductChatEngineOptions = {}) {
  const { getIdToken } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [productData, setProductData] = useState<ProductData>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const initialized = useRef(false);
  const documentAnalysisRef = useRef<DocumentAnalysis | undefined>(undefined);

  const currentStep = currentStepIndex >= 0 && currentStepIndex < steps.length
    ? steps[currentStepIndex]
    : null;

  const addBotMessage = useCallback(async (text: string, delay = 500) => {
    setIsTyping(true);
    await new Promise((resolve) => setTimeout(resolve, delay));
    setIsTyping(false);

    const message: Message = {
      id: generateId(),
      who: 'bot',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const addUserMessage = useCallback((text: string, imageUrl?: string) => {
    const message: Message = {
      id: generateId(),
      who: 'user',
      text,
      timestamp: new Date(),
      imageUrl,
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const initialize = useCallback(async (productType?: string, documentAnalysis?: DocumentAnalysis, creatorVoiceStyle?: string) => {
    if (initialized.current) return;
    initialized.current = true;

    // Store document analysis for later use
    documentAnalysisRef.current = documentAnalysis;

    // Map creator voiceStyle to product tone
    const voiceStyleToTone: Record<string, string> = {
      'friendly_coach': 'friendly',
      'professional_expert': 'professional',
      'formal_consultant': 'professional',
      'casual_friend': 'casual',
    };
    const mappedTone = creatorVoiceStyle ? voiceStyleToTone[creatorVoiceStyle] || 'friendly' : 'friendly';

    // Create steps with product type and document analysis context, excluding tone step
    const productSteps = createProductSteps(productType, documentAnalysis).filter(step => step.id !== 'tone');
    setSteps(productSteps);

    // Store product type and tone (from creator profile) if provided
    if (productType || creatorVoiceStyle) {
      setProductData((prev) => ({
        ...prev,
        ...(productType && { productType }),
        tone: mappedTone,
      }));
    }

    if (documentAnalysis && (documentAnalysis.suggestedName || documentAnalysis.suggestedBenefits?.length || documentAnalysis.summary)) {
      // Combine all analysis info into ONE message with uppercase titles and proper spacing
      let analysisMessage = '📄 Analisei seu documento!\n\n';

      if (documentAnalysis.summary) {
        analysisMessage += `📋 **RESUMO:** ${documentAnalysis.summary}\n\n`;
      }
      if (documentAnalysis.targetAudience) {
        analysisMessage += `👥 **PÚBLICO:** ${documentAnalysis.targetAudience}\n\n`;
      }
      if (documentAnalysis.topics && documentAnalysis.topics.length > 0) {
        analysisMessage += `📚 **TÓPICOS:** ${documentAnalysis.topics.slice(0, 4).join(', ')}\n\n`;
      }

      analysisMessage += 'Vou usar essas informações para sugerir respostas personalizadas!';

      await addBotMessage(analysisMessage);
    } else {
      await addBotMessage('Vou te ajudar a cadastrar seu produto! No final, você verá como seu agente de vendas vai responder aos clientes.');
    }

    await addBotMessage(productSteps[0].prompt || '', 300);
    setCurrentStepIndex(0);
  }, [addBotMessage]);

  // Check if a step should be shown based on its conditional
  const shouldShowStep = useCallback((step: Step, data: ProductData): boolean => {
    if (!step.conditional) return true;

    const { dependsOn, showWhen } = step.conditional;

    if (dependsOn === 'has-file') {
      return data.hasFile === (showWhen === 'sim' || showWhen === true);
    }

    if (dependsOn === 'has-objections') {
      return data.hasObjections === (showWhen === 'sim' || showWhen === true);
    }

    return true;
  }, []);

  // Find the next valid step
  const findNextStep = useCallback((currentIndex: number, data: ProductData): number => {
    let nextIndex = currentIndex + 1;

    while (nextIndex < steps.length) {
      const step = steps[nextIndex];
      if (shouldShowStep(step, data)) {
        return nextIndex;
      }
      nextIndex++;
    }

    return -1; // No more steps
  }, [steps, shouldShowStep]);


  const processStepResponse = useCallback(
    async (value: string) => {
      if (!currentStep) return;

      // Add user message
      let displayValue = value;

      // Format display for certain step types
      let thumbnailImageUrl: string | undefined;

      if (currentStep.type === 'price-chips') {
        displayValue = `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
      } else if (currentStep.type === 'yesno') {
        displayValue = value === 'sim' ? 'Sim' : 'Não';
      } else if (currentStep.id === 'file-upload') {
        const [fileName] = value.split('|');
        displayValue = `📄 ${fileName}`;
      } else if (currentStep.type === 'thumbnail') {
        // Display thumbnail selection type with image preview
        const typeLabels: Record<string, string> = {
          'pdf': '📄 Capa do PDF',
          'upload': '🖼️ Imagem personalizada',
          'generate': '✨ Imagem gerada',
        };
        const thumbnailParts = value.replace('thumbnail:', '').split('|');
        const thumbnailType = thumbnailParts[0];
        thumbnailImageUrl = thumbnailParts[1] && thumbnailParts[1] !== 'error' ? thumbnailParts[1] : undefined;
        displayValue = typeLabels[thumbnailType] || '🖼️ Imagem';
      } else if (currentStep.type === 'suggestions' && value.length > 50) {
        // Truncate long suggestion text for display
        displayValue = value.substring(0, 50) + '...';
      }

      addUserMessage(displayValue, thumbnailImageUrl);

      // Update product data based on step
      const stepId = currentStep.id;
      const newProductData = { ...productData };

      // Helper to extract clean value from conversational input
      const cleanValue = async (raw: string, fieldType: 'name' | 'description' | 'benefit'): Promise<string> => {
        if (!getIdToken) return raw;
        try {
          const token = await getIdToken();
          if (!token) return raw;
          const result = await extractCleanValue(token, raw, fieldType, { productName: newProductData.name });
          return result.cleanValue;
        } catch {
          return raw;
        }
      };

      switch (stepId) {
        case 'thumbnail':
          // Parse thumbnail response: "thumbnail:type|url"
          if (value.startsWith('thumbnail:')) {
            const parts = value.substring(10).split('|');
            const rawType = parts[0];
            // Map 'generate' to 'generated' for storage
            const thumbnailSource = rawType === 'generate' ? 'generated' : rawType as 'pdf' | 'upload';
            const thumbnailUrl = parts[1] || '';
            newProductData.thumbnailSource = thumbnailSource;
            if (thumbnailUrl && thumbnailUrl !== 'error') {
              newProductData.thumbnailUrl = thumbnailUrl;
            }
          }
          break;
        case 'name':
          newProductData.name = await cleanValue(value, 'name');
          break;
        case 'price':
          newProductData.price = parseFloat(value);
          newProductData.currency = 'BRL';
          break;
        case 'main-benefit':
          newProductData.mainBenefit = await cleanValue(value, 'benefit');
          break;
        case 'description':
          newProductData.description = await cleanValue(value, 'description');
          break;
        case 'has-file':
          newProductData.hasFile = value === 'sim';
          break;
        case 'has-objections':
          newProductData.hasObjections = value === 'sim';
          break;
        case 'file-upload':
          const [fileName, fileUrl] = value.split('|');
          newProductData.fileName = fileName;
          newProductData.fileUrl = fileUrl;
          break;
        case 'objections':
          // Parse text input - split by comma or newline
          const objectionsList = value
            .split(/[,\n]/)
            .map(o => o.trim())
            .filter(o => o.length > 0);
          newProductData.objections = objectionsList;
          break;
        case 'tone':
          // Extract tone type from the suggestion text
          if (value.includes('Amigável')) {
            newProductData.tone = 'friendly';
          } else if (value.includes('Profissional')) {
            newProductData.tone = 'professional';
          } else if (value.includes('Acolhedor')) {
            newProductData.tone = 'empathetic';
          } else if (value.includes('Descontraído')) {
            newProductData.tone = 'casual';
          } else if (value.includes('Urgente')) {
            newProductData.tone = 'urgent';
          } else {
            newProductData.tone = 'friendly'; // default
          }
          break;
      }

      setProductData(newProductData);

      // Find next step
      const nextIndex = findNextStep(currentStepIndex, newProductData);

      if (nextIndex === -1) {
        // Conversation complete
        await addBotMessage('Perfeito! Tenho todas as informações que preciso.');

        const toneLabels: Record<string, string> = {
          friendly: 'Amigável e motivador',
          professional: 'Profissional e direto',
          empathetic: 'Acolhedor e empático',
          casual: 'Descontraído e informal',
          urgent: 'Urgente e persuasivo',
        };

        const priceDisplay = newProductData.price === 0
          ? 'Gratuito'
          : `R$ ${newProductData.price?.toFixed(2).replace('.', ',')}`;
        await addBotMessage(
          `📋 Resumo do seu produto:\n\n` +
            `📦 ${newProductData.name}\n` +
            `💳 ${priceDisplay}\n` +
            `🎯 ${newProductData.mainBenefit}\n` +
            `🗣️ Tom: ${toneLabels[newProductData.tone || 'friendly']}`
        );
        await addBotMessage('Veja na prévia ao lado como seu agente vai responder aos clientes! Quando estiver pronto, clique em "Salvar Produto".');
        setIsComplete(true);
      } else {
        // Generate contextual response COMBINED with next question
        const priceValue = parseFloat(value);
        const priceResponse = priceValue === 0
          ? 'Gratuito - ótimo para captar leads!'
          : `R$ ${priceValue.toFixed(2).replace('.', ',')} - bom ticket!`;
        const thumbnailResponses: Record<string, string> = {
          'pdf': 'Capa do PDF selecionada!',
          'upload': 'Imagem enviada!',
          'generated': 'Imagem gerada!',
        };
        const thumbnailResponse = newProductData.thumbnailSource
          ? thumbnailResponses[newProductData.thumbnailSource] || 'Imagem definida!'
          : 'Imagem definida!';
        const contextResponses: Record<string, string> = {
          'thumbnail': thumbnailResponse,
          'name': `"${newProductData.name}" - ótimo nome!`,
          'price': priceResponse,
          'main-benefit': 'Excelente benefício!',
          'description': 'Perfeito!',
          'has-file': value === 'sim' ? 'Ótimo!' : 'Sem problemas!',
          'has-objections': value === 'sim' ? 'Vou te ajudar a responder essas objeções!' : 'Sem problemas!',
          'file-upload': 'Arquivo recebido!',
        };

        const nextStep = steps[nextIndex];

        // Special handling for objections - call AI to generate responses
        if (stepId === 'objections' && newProductData.objections && newProductData.objections.length > 0) {
          await addBotMessage(`Anotei ${newProductData.objections.length} objeções! Gerando respostas...`);

          try {
            if (getIdToken) {
              const token = await getIdToken();
              if (token) {
                const aiResponses = await generateObjectionResponses(token, newProductData, newProductData.objections);
                newProductData.objectionResponses = aiResponses;
                setProductData(newProductData);
              }
            }
          } catch (error) {
            console.error('Error generating objection responses:', error);
          }
          // Combine confirmation with next prompt
          await addBotMessage(`Pronto! ${nextStep.prompt || ''}`, 400);
        } else if (stepId === 'objections') {
          await addBotMessage(`Ok! ${nextStep.prompt || ''}`, 400);
        } else {
          // Combine context response with next prompt in ONE message
          const response = contextResponses[stepId] || 'Entendi!';
          await addBotMessage(`${response} ${nextStep.prompt || ''}`, 400);
        }

        setCurrentStepIndex(nextIndex);
      }
    },
    [currentStep, currentStepIndex, productData, addUserMessage, addBotMessage, findNextStep, steps, getIdToken]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setProductData({});
    setCurrentStepIndex(-1);
    setIsTyping(false);
    setIsComplete(false);
    setSteps([]);
    documentAnalysisRef.current = undefined;
    initialized.current = false;
  }, []);

  // Calculate progress based on actual steps shown
  const calculateProgress = useCallback(() => {
    if (steps.length === 0) return 0;

    let visibleSteps = 0;
    let completedSteps = 0;

    for (let i = 0; i < steps.length; i++) {
      if (shouldShowStep(steps[i], productData)) {
        visibleSteps++;
        if (i < currentStepIndex) {
          completedSteps++;
        }
      }
    }

    return visibleSteps > 0 ? Math.round((completedSteps / visibleSteps) * 100) : 0;
  }, [steps, currentStepIndex, productData, shouldShowStep]);

  return {
    messages,
    productData,
    currentStep,
    currentStepIndex,
    isTyping,
    isComplete,
    isUploading,
    setIsUploading,
    initialize,
    processStepResponse,
    reset,
    totalSteps: steps.length,
    progress: calculateProgress(),
  };
}
