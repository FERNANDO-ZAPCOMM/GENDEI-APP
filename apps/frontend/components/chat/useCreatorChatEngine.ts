'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message, Step, CreatorData, Suggestion } from './types';
import { generateCreatorWelcome } from '@/lib/ai-api';

// Create steps for creator profile onboarding
function createCreatorSteps(): Step[] {
  return [
    // Step 1: Creator Name
    {
      id: 'displayName',
      type: 'text' as const,
      prompt: 'Como você quer que eu te chame? Este será o nome que vou usar nas conversas com seus leads.',
      placeholder: 'Ex: Paola, Dr. Carlos, Mari...',
    },
    // Step 2: Niche/Area of expertise
    {
      id: 'niche',
      type: 'suggestions' as const,
      prompt: 'Qual é sua área de atuação? Isso me ajuda a entender seu público.',
      suggestions: [
        { id: 'niche-health', text: 'Saúde e Bem-estar (nutrição, fitness, emagrecimento)', isAI: true },
        { id: 'niche-business', text: 'Negócios e Empreendedorismo', isAI: true },
        { id: 'niche-education', text: 'Educação e Cursos Online', isAI: true },
        { id: 'niche-finance', text: 'Finanças e Investimentos', isAI: true },
        { id: 'niche-development', text: 'Desenvolvimento Pessoal', isAI: true },
        { id: 'niche-tech', text: 'Tecnologia e Programação', isAI: true },
      ],
      allowCustom: true,
      horizontal: true,
    },
    // Step 3: Voice Style
    {
      id: 'voiceStyle',
      type: 'suggestions' as const,
      prompt: 'Qual tom de voz combina mais com você? Deslize para escolher:',
      suggestions: [
        { id: 'style-friendly', text: '🔥 Coach Amigável - Energia positiva, motivação e emojis!', isAI: true },
        { id: 'style-professional', text: '💼 Especialista Profissional - Direto, técnico e focado em resultados', isAI: true },
        { id: 'style-formal', text: '🎓 Consultor Formal - Sério, respeitoso e tradicional', isAI: true },
      ],
      allowCustom: false,
      horizontal: true,
    },
    // Step 4: What they're working on
    {
      id: 'upcomingProducts',
      type: 'textarea' as const,
      prompt: 'O que você está preparando para seus clientes? Pode ser um e-book, curso, consultoria... Isso me ajuda a criar expectativa nos leads!',
      placeholder: 'Ex: Estou criando um e-book sobre dieta cetogênica, um curso completo de receitas low-carb...',
    },
    // Step 5: Services preview
    {
      id: 'servicesPreview',
      type: 'suggestions' as const,
      prompt: 'Você pretende oferecer atendimentos ou consultas? Posso mencionar isso nas conversas.',
      suggestions: [
        { id: 'service-consulting', text: 'Sim, vou oferecer consultorias/atendimentos individuais', isAI: true },
        { id: 'service-group', text: 'Sim, vou ter mentorias ou grupos', isAI: true },
        { id: 'service-schedule', text: 'Ainda não, mas pretendo habilitar minha agenda em breve', isAI: true },
        { id: 'service-none', text: 'Por enquanto só produtos digitais', isAI: true },
      ],
      allowCustom: true,
      horizontal: true,
    },
  ];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface UseCreatorChatEngineOptions {
  getIdToken?: () => Promise<string | null>;
}

export function useCreatorChatEngine(options: UseCreatorChatEngineOptions = {}) {
  const { getIdToken } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [creatorData, setCreatorData] = useState<CreatorData>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isGeneratingWelcome, setIsGeneratingWelcome] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const initialized = useRef(false);

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

  const addUserMessage = useCallback((text: string) => {
    const message: Message = {
      id: generateId(),
      who: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const initialize = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    const creatorSteps = createCreatorSteps();
    setSteps(creatorSteps);

    await addBotMessage('Oi! Vou te ajudar a configurar seu perfil de criador. Assim, mesmo sem produtos cadastrados, posso conversar com seus leads de forma personalizada! 🎯');
    await addBotMessage('Vamos lá? São só 5 perguntas rápidas.');
    await addBotMessage(creatorSteps[0].prompt || '', 300);
    setCurrentStepIndex(0);
  }, [addBotMessage]);

  const processStepResponse = useCallback(
    async (value: string) => {
      if (!currentStep) return;

      // Add user message
      let displayValue = value;

      // Truncate long text for display
      if (value.length > 60) {
        displayValue = value.substring(0, 60) + '...';
      }

      addUserMessage(displayValue);

      // Update creator data based on step
      const stepId = currentStep.id;
      const newCreatorData = { ...creatorData };

      switch (stepId) {
        case 'displayName':
          newCreatorData.displayName = value.trim();
          break;
        case 'niche':
          newCreatorData.niche = value;
          break;
        case 'voiceStyle':
          // Extract voice style from the suggestion text
          if (value.includes('Coach Amigável')) {
            newCreatorData.voiceStyle = 'friendly_coach';
          } else if (value.includes('Especialista Profissional')) {
            newCreatorData.voiceStyle = 'professional_expert';
          } else if (value.includes('Consultor Formal')) {
            newCreatorData.voiceStyle = 'formal_consultant';
          } else {
            newCreatorData.voiceStyle = 'friendly_coach'; // default
          }
          break;
        case 'upcomingProducts':
          newCreatorData.upcomingProducts = value.trim();
          break;
        case 'servicesPreview':
          newCreatorData.servicesPreview = value;
          break;
      }

      setCreatorData(newCreatorData);

      // Check if this is the last step
      const nextIndex = currentStepIndex + 1;

      if (nextIndex >= steps.length) {
        // Conversation complete - generate welcome message
        await addBotMessage('Perfeito! Tenho todas as informações. Agora vou criar sua mensagem de boas-vindas personalizada...');

        setIsGeneratingWelcome(true);

        try {
          if (getIdToken) {
            const token = await getIdToken();
            if (token) {
              const welcomeMessage = await generateCreatorWelcome(token, newCreatorData);
              newCreatorData.welcomeMessage = welcomeMessage;
              setCreatorData(newCreatorData);

              await addBotMessage('Pronto! Criei uma mensagem personalizada para quando seus leads entrarem em contato:');
              await addBotMessage(`💬 **Preview:**\n\n"${welcomeMessage}"`);
            }
          }
        } catch (error) {
          console.error('Error generating welcome message:', error);
          // Generate a simple fallback message
          const fallbackMessage = `Oi! Me chamo ${newCreatorData.displayName} 👋 Ainda estou preparando meus produtos, mas logo teremos novidades! ${newCreatorData.upcomingProducts ? `Estou trabalhando em ${newCreatorData.upcomingProducts}.` : ''} Posso te avisar quando tiver algo novo?`;
          newCreatorData.welcomeMessage = fallbackMessage;
          setCreatorData(newCreatorData);
          await addBotMessage('Criei uma mensagem básica para você:');
          await addBotMessage(`💬 **Preview:**\n\n"${fallbackMessage}"`);
        }

        setIsGeneratingWelcome(false);

        const voiceLabels: Record<string, string> = {
          friendly_coach: 'Coach Amigável',
          professional_expert: 'Especialista Profissional',
          formal_consultant: 'Consultor Formal',
        };

        await addBotMessage(
          `📋 **Resumo do seu perfil:**\n\n` +
            `👤 Nome: ${newCreatorData.displayName}\n` +
            `🎯 Nicho: ${newCreatorData.niche}\n` +
            `🗣️ Estilo: ${voiceLabels[newCreatorData.voiceStyle || 'friendly_coach']}\n` +
            `📦 Preparando: ${newCreatorData.upcomingProducts || 'Não informado'}`
        );
        await addBotMessage('Veja na prévia ao lado como vou responder aos seus leads! Quando estiver pronto, clique em "Salvar Perfil".');
        setIsComplete(true);
      } else {
        // Generate contextual response before next question
        const contextResponses: Record<string, string> = {
          'displayName': `Prazer, ${newCreatorData.displayName}! 😊`,
          'niche': 'Ótima área! Vou adaptar minha comunicação para esse público.',
          'voiceStyle': 'Entendido! Vou usar esse tom nas conversas.',
          'upcomingProducts': 'Que legal! Vou mencionar isso para criar expectativa nos leads.',
        };

        const response = contextResponses[stepId] || 'Entendi!';
        await addBotMessage(response);

        const nextStep = steps[nextIndex];
        await addBotMessage(nextStep.prompt || '', 400);
        setCurrentStepIndex(nextIndex);
      }
    },
    [currentStep, currentStepIndex, creatorData, addUserMessage, addBotMessage, steps, getIdToken]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setCreatorData({});
    setCurrentStepIndex(-1);
    setIsTyping(false);
    setIsComplete(false);
    setIsGeneratingWelcome(false);
    setSteps([]);
    initialized.current = false;
  }, []);

  // Calculate progress based on steps
  const calculateProgress = useCallback(() => {
    if (steps.length === 0) return 0;
    return Math.round((currentStepIndex / steps.length) * 100);
  }, [steps, currentStepIndex]);

  return {
    messages,
    creatorData,
    currentStep,
    currentStepIndex,
    isTyping,
    isComplete,
    isGeneratingWelcome,
    initialize,
    processStepResponse,
    reset,
    totalSteps: steps.length,
    progress: calculateProgress(),
  };
}
