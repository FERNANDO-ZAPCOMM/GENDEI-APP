'use client';

import { useState, useCallback, useRef } from 'react';
import { initPersonaAgent, sendPersonaAgentMessage, PersonaData } from '@/lib/ai-api';
import type { Message } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UsePersonaAgentEngineOptions {
  getIdToken: () => Promise<string | null>;
}

export function usePersonaAgentEngine(options: UsePersonaAgentEngineOptions) {
  const { getIdToken } = options;

  // UI Messages (for display)
  const [messages, setMessages] = useState<Message[]>([]);

  // Conversation history (for API)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

  // Persona data being collected
  const [personaData, setPersonaData] = useState<PersonaData>({});

  // UI state
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current field being asked (for showing selection cards)
  const [currentField, setCurrentField] = useState<string | null>(null);

  // Track initialization
  const initialized = useRef(false);

  const inferFieldFromText = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('tom de voz') || lowerText.includes('coach amigável') || lowerText.includes('expert profissional')) {
      return 'voiceStyle';
    }
    if (lowerText.includes('nicho') || lowerText.includes('área você atua')) {
      return 'niche';
    }
    if (lowerText.includes('nome') || lowerText.includes('como você gostaria de ser chamado')) {
      return 'displayName';
    }
    if (lowerText.includes('telefone') || lowerText.includes('whatsapp') || lowerText.includes('número de telefone')) {
      return 'phone';
    }
    if (lowerText.includes('e-mail') || lowerText.includes('email')) {
      return 'email';
    }
    if (lowerText.includes('produto') || lowerText.includes('lançar')) {
      return 'upcomingProducts';
    }
    if (lowerText.includes('consultoria') || lowerText.includes('mentoria') || lowerText.includes('serviço')) {
      return 'servicesPreview';
    }
    if (lowerText.includes('boas-vindas') || lowerText.includes('mensagem de boas')) {
      return 'welcomeMessage';
    }
    return null;
  }, []);

  const detectCurrentField = useCallback(
    (text: string) => {
      const field = inferFieldFromText(text);
      setCurrentField(field);
      return field;
    },
    [inferFieldFromText]
  );

  const fieldToCategory: Record<string, string> = {
    displayName: 'Informações pessoais',
    phone: 'Informações pessoais',
    email: 'Informações pessoais',
    niche: 'Posicionamento',
    voiceStyle: 'Tom de voz',
    upcomingProducts: 'Produtos',
    servicesPreview: 'Serviços',
    welcomeMessage: 'Boas-vindas',
  };

  // Add a bot message to the UI
  const addBotMessage = useCallback((text: string) => {
    const field = detectCurrentField(text);
    const lower = text.toLowerCase();
    // Normalize some prompts to match AdvogaCV tone
    if (
      field === 'voiceStyle' &&
      (lower.includes('cards com as opções de tom de voz') ||
        lower.includes('opções de tom de voz aparecerão'))
    ) {
      text =
        'Agora escolha o TOM DE VOZ do seu clone. Selecione uma das opções abaixo.';
    }
    if (field === 'upcomingProducts') {
      // Remove UI-instruction lines from the model (we already render cards)
      text = text
        .split('\n')
        .filter((line) => !line.toLowerCase().includes('você vai ver bot'))
        .join('\n')
        .trim();
    }
    const hasBoldQuestion = /\*\*[^*]+\*\*/.test(text);
    const hasQuestionMark = text.trim().endsWith('?');
    const isPrompt = hasBoldQuestion || hasQuestionMark;
    const message: Message = {
      id: generateId(),
      who: 'bot',
      text,
      timestamp: new Date(),
      field,
      category: field ? fieldToCategory[field] ?? null : null,
      isPrompt,
    };
    setMessages((prev) => [...prev, message]);
  }, [detectCurrentField]);

  // Add a user message to the UI
  const addUserMessage = useCallback((text: string) => {
    const message: Message = {
      id: generateId(),
      who: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  // Initialize the agent conversation
  const initialize = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    setIsTyping(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const result = await initPersonaAgent(token);

      // Add the initial greeting (split into greeting + first question when possible)
      const splitInitialGreeting = (text: string): [string, string] | null => {
        const normalized = text.replace(/\r\n/g, '\n').trim();
        // Avoid /s (dotAll) to keep TS target compatibility
        const match = normalized.match(/^([\s\S]*?)(\*\*[^*?]+\?\*\*|\n[^\n]*\?)\s*$/);
        if (!match) return null;
        const greeting = match[1].trim();
        const question = match[2].trim();
        if (!greeting || !question) return null;
        return [greeting, question];
      };

      const split = splitInitialGreeting(result.response);
      if (split) {
        addBotMessage(split[0]);
        addBotMessage(split[1]);
      } else {
        addBotMessage(result.response);
      }
      setPersonaData(result.initialData);

      // Add to conversation history
      setConversationHistory([
        { role: 'user', content: 'Olá, quero configurar meu perfil de clone de IA.' },
        { role: 'assistant', content: result.response },
      ]);
    } catch (err: any) {
      console.error('Error initializing persona agent:', err);
      setError(err.message || 'Failed to initialize');
      // Fallback greeting split in two messages
      addBotMessage('Oi! Vou te ajudar a criar seu clone de IA. Ele vai responder seus leads automaticamente no WhatsApp.');
      addBotMessage('**Qual seu nome?**');
    } finally {
      setIsTyping(false);
    }
  }, [getIdToken, addBotMessage]);

  // Send a message to the agent
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isTyping) return;

      setError(null);

      // Add user message to UI
      addUserMessage(userMessage);

      // Update conversation history with user message
      const updatedHistory: ConversationMessage[] = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];
      setConversationHistory(updatedHistory);

      setIsTyping(true);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const result = await sendPersonaAgentMessage(
          token,
          userMessage,
          conversationHistory, // Send previous history (not including current message)
          personaData
        );

        // Add bot response to UI
        addBotMessage(result.response);

        // Update conversation history with assistant response
        setConversationHistory([
          ...updatedHistory,
          { role: 'assistant', content: result.response },
        ]);

        // Update persona data
        setPersonaData(result.updatedPersonaData);

        // Check if complete
        if (result.isComplete) {
          setIsComplete(true);
        }
      } catch (err: any) {
        console.error('Error sending message to persona agent:', err);
        setError(err.message || 'Failed to send message');
        addBotMessage('Desculpe, tive um problema. Pode tentar novamente?');
      } finally {
        setIsTyping(false);
      }
    },
    [getIdToken, conversationHistory, personaData, isTyping, addUserMessage, addBotMessage]
  );

  // Reset the conversation
  const reset = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setPersonaData({});
    setIsTyping(false);
    setIsComplete(false);
    setError(null);
    setCurrentField(null);
    initialized.current = false;
  }, []);

  // Load existing persona data (for editing mode)
  const loadExistingData = useCallback((existingData: PersonaData) => {
    if (initialized.current) return;
    initialized.current = true;
    setPersonaData(existingData);
    setIsComplete(true);
    // Add a compact summary message showing the loaded data
    const summaryParts = [];
    if (existingData.displayName) summaryParts.push(`• ${existingData.displayName}`);
    if (existingData.niche) summaryParts.push(`• ${existingData.niche}`);
    if (existingData.voiceStyle) summaryParts.push(`• ${getVoiceStyleLabel(existingData.voiceStyle)}`);
    if (existingData.upcomingProducts && existingData.upcomingProducts !== 'Não') summaryParts.push(`• ${existingData.upcomingProducts}`);
    if (existingData.servicesPreview && existingData.servicesPreview !== 'Não') summaryParts.push(`• ${existingData.servicesPreview}`);

    const summaryMessage = `Clone configurado! 🎉\n${summaryParts.join('\n')}`;
    addBotMessage(summaryMessage);
  }, [addBotMessage]);

  // Calculate progress based on collected fields
  const calculateProgress = useCallback(() => {
    const requiredFields = ['displayName', 'niche', 'voiceStyle'];
    const optionalFields = ['upcomingProducts', 'servicesPreview', 'welcomeMessage'];
    const allFields = [...requiredFields, ...optionalFields];

    const filledCount = allFields.filter(
      (field) => personaData[field as keyof PersonaData]
    ).length;

    return Math.round((filledCount / allFields.length) * 100);
  }, [personaData]);

  // Get list of collected fields for UI feedback
  const getCollectedFields = useCallback(() => {
    const fieldLabels: Record<string, string> = {
      displayName: 'Nome',
      niche: 'Nicho',
      voiceStyle: 'Tom de Voz',
      upcomingProducts: 'Produtos',
      servicesPreview: 'Serviços',
      welcomeMessage: 'Mensagem de Boas-vindas',
    };

    return Object.entries(personaData)
      .filter(([_, value]) => value)
      .map(([key, value]) => ({
        field: key,
        label: fieldLabels[key] || key,
        value: key === 'voiceStyle' ? getVoiceStyleLabel(value as string) : value,
      }));
  }, [personaData]);

  return {
    // State
    messages,
    personaData,
    isTyping,
    isComplete,
    error,
    progress: calculateProgress(),
    collectedFields: getCollectedFields(),
    currentField,

    // Actions
    initialize,
    sendMessage,
    reset,
    loadExistingData,
  };
}

// Helper function to get voice style label
function getVoiceStyleLabel(style: string): string {
  const labels: Record<string, string> = {
    friendly_coach: 'Coach Amigável',
    professional_expert: 'Expert Profissional',
    formal_consultant: 'Consultor Formal',
  };
  return labels[style] || style;
}
