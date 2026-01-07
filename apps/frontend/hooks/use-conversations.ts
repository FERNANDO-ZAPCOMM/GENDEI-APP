import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

export enum ConversationState {
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  NEGOCIANDO = 'negociando',
  CHECKOUT = 'checkout',
  FECHADO = 'fechado',
}

export interface ConversationDocument {
  id: string;
  creatorId: string;
  waUserId: string;
  waUserName?: string;
  waUserPhone?: string;
  state: ConversationState;
  lastMessageAt: Date;
  isHumanTakeover: boolean;
  aiPaused: boolean;
  takenOverAt?: Date;
  takenOverBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationFilters {
  state?: ConversationState;
  isHumanTakeover?: boolean;
  search?: string;
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
  creatorId: string;
  direction: 'in' | 'out';  // Backend enum uses 'in'/'out' not 'inbound'/'outbound'
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
 * Hook to fetch conversations for a creator
 */
export function useConversations(creatorId: string, filters?: ConversationFilters) {
  const { getIdToken } = useAuth();
  const queryKey = ['conversations', creatorId, filters];

  const { data, isLoading, error, refetch } = useQuery<ConversationDocument[]>({
    queryKey,
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters?.state) params.append('state', filters.state);
      if (filters?.isHumanTakeover !== undefined) {
        params.append('isHumanTakeover', filters.isHumanTakeover.toString());
      }
      if (filters?.search) params.append('search', filters.search);

      const response = await fetch(
        `/api/conversations/creator/${creatorId}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const result = await response.json();
      return result.data || [];
    },
    enabled: !!creatorId,
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
export function useConversationStats(creatorId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error } = useQuery<ConversationStats>({
    queryKey: ['conversation-stats', creatorId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/creator/${creatorId}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversation stats');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!creatorId,
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
export function useConversation(creatorId: string, conversationId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<ConversationDocument>({
    queryKey: ['conversation', creatorId, conversationId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/${creatorId}/${conversationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!creatorId && !!conversationId,
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
export function useConversationMessages(creatorId: string, conversationId: string) {
  const { getIdToken } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<MessageLog[]>({
    queryKey: ['conversation-messages', creatorId, conversationId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/${creatorId}/${conversationId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const result = await response.json();
      return result.data || [];
    },
    enabled: !!creatorId && !!conversationId,
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
      creatorId,
      conversationId,
      userId,
    }: {
      creatorId: string;
      conversationId: string;
      userId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/${creatorId}/${conversationId}/takeover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to take over conversation');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate conversation queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.creatorId, variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.creatorId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation-stats', variables.creatorId],
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
      creatorId,
      conversationId,
    }: {
      creatorId: string;
      conversationId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/${creatorId}/${conversationId}/release`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to release conversation');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.creatorId, variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.creatorId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation-stats', variables.creatorId],
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
      creatorId,
      conversationId,
      message,
      userId,
    }: {
      creatorId: string;
      conversationId: string;
      message: string;
      userId: string;
    }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/conversations/${creatorId}/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ message, userId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate messages query to refresh chat
      queryClient.invalidateQueries({
        queryKey: ['conversation-messages', variables.creatorId, variables.conversationId],
      });
    },
  });

  return mutation;
}
