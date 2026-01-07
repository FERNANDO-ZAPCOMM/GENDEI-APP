import { apiClient } from './api';
import type { ProductData, CreatorData } from '@/components/chat/types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Generate AI response for product chat
 */
export async function generateChatResponse(
  token: string,
  message: string,
  productContext: ProductData,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const response = await apiClient<{ response: string }>('/ai/chat', {
    method: 'POST',
    token,
    body: JSON.stringify({
      message,
      productContext,
      conversationHistory,
    }),
  });
  return response.response;
}

/**
 * Generate objection responses using AI
 */
export async function generateObjectionResponses(
  token: string,
  productContext: ProductData,
  objections: string[]
): Promise<Record<string, string>> {
  const response = await apiClient<{ responses: Record<string, string> }>(
    '/ai/objections',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        productContext,
        objections,
      }),
    }
  );
  return response.responses;
}

/**
 * Generate WhatsApp preview messages using AI
 */
export async function generateWhatsAppPreview(
  token: string,
  productContext: ProductData
): Promise<Array<{ who: 'customer' | 'bot'; text: string }>> {
  const response = await apiClient<{
    messages: Array<{ who: 'customer' | 'bot'; text: string }>;
  }>('/ai/preview', {
    method: 'POST',
    token,
    body: JSON.stringify({
      productContext,
    }),
  });
  return response.messages;
}

/**
 * Save product conversation to Firestore
 */
export async function saveProductConversation(
  token: string,
  creatorId: string,
  productId: string,
  messages: ChatMessage[],
  productContext: ProductData
): Promise<void> {
  await apiClient('/ai/conversation/save', {
    method: 'POST',
    token,
    body: JSON.stringify({
      creatorId,
      productId,
      messages,
      productContext,
    }),
  });
}

/**
 * Extract clean value from conversational text
 * E.g., "Eu acho que o melhor nome seria Super Agentes" -> "Super Agentes"
 */
export async function extractCleanValue(
  token: string,
  rawInput: string,
  fieldType: 'name' | 'description' | 'benefit' | 'objection',
  context?: { productName?: string }
): Promise<{ cleanValue: string; wasConversational: boolean }> {
  return apiClient<{ cleanValue: string; wasConversational: boolean }>(
    '/ai/extract-value',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        rawInput,
        fieldType,
        context,
      }),
    }
  );
}

/**
 * Generate welcome message for creator profile (when no products exist)
 */
export async function generateCreatorWelcome(
  token: string,
  creatorData: CreatorData
): Promise<string> {
  const response = await apiClient<{ welcomeMessage: string }>(
    '/ai/creator-welcome',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        creatorData,
      }),
    }
  );
  return response.welcomeMessage;
}

// ============================================================================
// PERSONA AGENT API (Claude-based conversational onboarding)
// ============================================================================

export interface PersonaData {
  displayName?: string;
  niche?: string;
  voiceStyle?: 'friendly_coach' | 'professional_expert' | 'formal_consultant';
  upcomingProducts?: string;
  servicesPreview?: string;
  welcomeMessage?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PersonaAgentResponse {
  response: string;
  updatedPersonaData: PersonaData;
  isComplete: boolean;
  extractedFields?: string[];
}

interface PersonaInitResponse {
  response: string;
  initialData: PersonaData;
}

/**
 * Initialize persona agent conversation
 */
export async function initPersonaAgent(token: string): Promise<PersonaInitResponse> {
  return apiClient<PersonaInitResponse>('/ai/persona/init', {
    method: 'POST',
    token,
  });
}

/**
 * Send message to persona agent
 */
export async function sendPersonaAgentMessage(
  token: string,
  message: string,
  conversationHistory: ConversationMessage[],
  currentPersonaData: PersonaData
): Promise<PersonaAgentResponse> {
  return apiClient<PersonaAgentResponse>('/ai/persona/chat', {
    method: 'POST',
    token,
    body: JSON.stringify({
      message,
      conversationHistory,
      currentPersonaData,
    }),
  });
}
