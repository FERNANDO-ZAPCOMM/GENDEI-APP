import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';

export enum ConversationState {
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  NEGOCIANDO = 'negociando',
  CHECKOUT = 'checkout',
  FECHADO = 'fechado',
}

export interface ConversationDocument {
  id: string;
  clinicId: string;
  waUserId: string;
  waUserName?: string;
  waUserPhone?: string;
  state: ConversationState;
  lastMessageAt: Date;
  isHumanTakeover: boolean;
  aiPaused: boolean;
  takenOverAt?: Date;
  takenOverBy?: string;
  professionalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationFilters {
  state?: ConversationState;
  isHumanTakeover?: boolean;
  search?: string;
  professionalId?: string;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  humanTakeoverConversations: number;
  closedConversations: number;
}

export interface MessageLog {
  id: string;
  conversationId: string;
  clinicId: string;
  direction: 'in' | 'out';
  from: string;
  to: string;
  body: string;
  messageType: string;
  timestamp: Date;
  deliveryStatus?: string;
  isAiGenerated?: boolean;
  isHumanSent?: boolean;
  sentBy?: string;
}

/**
 * Hook to fetch conversations for a clinic
 */
export function useConversations(clinicId: string, filters?: ConversationFilters) {
  const { getIdToken } = useAuth();
  const queryKey = ['conversations', clinicId, filters];

  const { data, isLoading, error, refetch } = useQuery<ConversationDocument[]>({
    queryKey,
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('clinicId', clinicId);
      if (filters?.state) params.append('state', filters.state);
      if (filters?.isHumanTakeover !== undefined) {
        params.append('isHumanTakeover', filters.isHumanTakeover.toString());
      }
      if (filters?.search) params.append('search', filters.search);
      if (filters?.professionalId) params.append('professionalId', filters.professionalId);

      const result = await apiClient<{ data: ConversationDocument[] }>(
        `/conversations?${params.toString()}`,
        { token }
      );
      return result.data || [];
    },
    enabled: !!clinicId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    conversations: data || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch conversation statistics
 */
export function useConversationStats(clinicId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error } = useQuery<ConversationStats>({
    queryKey: ['conversation-stats', clinicId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: ConversationStats }>(
        `/conversations/stats?clinicId=${clinicId}`,
        { token }
      );
      return result.data;
    },
    enabled: !!clinicId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    stats: data,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch a single conversation
 */
export function useConversation(clinicId: string, conversationId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<ConversationDocument>({
    queryKey: ['conversation', clinicId, conversationId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: ConversationDocument }>(
        `/conversations/${conversationId}?clinicId=${clinicId}`,
        { token }
      );
      return result.data;
    },
    enabled: !!clinicId && !!conversationId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    conversation: data,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch messages for a conversation
 */
export function useConversationMessages(clinicId: string, conversationId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<MessageLog[]>({
    queryKey: ['conversation-messages', clinicId, conversationId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: MessageLog[] }>(
        `/conversations/${conversationId}/messages?clinicId=${clinicId}`,
        { token }
      );
      return result.data || [];
    },
    enabled: !!clinicId && !!conversationId,
    refetchInterval: 5000, // Poll every 5 seconds for new messages
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    messages: data || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to take over a conversation from AI
 */
export function useTakeoverConversation() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      clinicId,
      conversationId,
      userId,
    }: {
      clinicId: string;
      conversationId: string;
      userId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: { success: boolean } }>(
        `/conversations/${conversationId}/takeover?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ userId }),
        }
      );
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.clinicId, variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.clinicId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation-stats', variables.clinicId],
      });
    },
  });

  return mutation;
}

/**
 * Hook to release a conversation back to AI
 */
export function useReleaseConversation() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      clinicId,
      conversationId,
    }: {
      clinicId: string;
      conversationId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: { success: boolean } }>(
        `/conversations/${conversationId}/release?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
        }
      );
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.clinicId, variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.clinicId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation-stats', variables.clinicId],
      });
    },
  });

  return mutation;
}

/**
 * Hook to send a message in a conversation
 */
export function useSendMessage() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      clinicId,
      conversationId,
      message,
      userId,
    }: {
      clinicId: string;
      conversationId: string;
      message: string;
      userId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: { success: boolean; messageId: string } }>(
        `/conversations/${conversationId}/messages?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ message, userId }),
        }
      );
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', variables.clinicId, variables.conversationId],
      });
    },
  });

  return mutation;
}

/**
 * Hook to update conversation state
 */
export function useUpdateConversationState() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      clinicId,
      conversationId,
      state,
    }: {
      clinicId: string;
      conversationId: string;
      state: ConversationState;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiClient<{ data: { success: boolean } }>(
        `/conversations/${conversationId}?clinicId=${clinicId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ state }),
        }
      );
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.clinicId, variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.clinicId],
      });
    },
  });

  return mutation;
}
