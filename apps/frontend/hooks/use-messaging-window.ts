import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';

interface QueuedMessage {
  id: string;
  text: string;
  queuedAt: string;
  queuedBy: string;
}

interface WindowStatus {
  isWindowOpen: boolean;
  lastCustomerMessageAt: string | null;
  reengagementSentAt: string | null;
  queuedMessagesCount: number;
  queuedMessages: QueuedMessage[];
}

/**
 * Hook to manage 24h messaging window and message queue
 */
export function useMessagingWindow(clinicId: string, conversationId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  // Query for window status - refetch every 30 seconds
  const { data: windowStatus, isLoading, refetch } = useQuery({
    queryKey: ['window-status', clinicId, conversationId],
    queryFn: async (): Promise<WindowStatus> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await apiClient<{ data: WindowStatus }>(
        `/conversations/${conversationId}/window-status?clinicId=${clinicId}`,
        { token }
      );
      return (response as any).data;
    },
    enabled: !!clinicId && !!conversationId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });

  // Queue a message mutation
  const queueMessage = useMutation({
    mutationFn: async (message: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<{ data: { queuedMessage: QueuedMessage; queueLength: number } }>(
        `/conversations/${conversationId}/queue?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ message }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['window-status', clinicId, conversationId] });
    },
  });

  // Clear queue mutation
  const clearQueue = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<{ data: { success: boolean } }>(
        `/conversations/${conversationId}/queue?clinicId=${clinicId}`,
        {
          method: 'DELETE',
          token,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['window-status', clinicId, conversationId] });
    },
  });

  // Send queued messages mutation
  const sendQueue = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<{ data: { sent: number; failed: number } }>(
        `/conversations/${conversationId}/send-queue?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['window-status', clinicId, conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', clinicId, conversationId] });
    },
  });

  // Send re-engagement template mutation
  const sendReengagement = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<{ data: { success: boolean; messageId?: string; message: string } }>(
        `/conversations/${conversationId}/reengagement?clinicId=${clinicId}`,
        {
          method: 'POST',
          token,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['window-status', clinicId, conversationId] });
    },
  });

  return {
    isWindowOpen: windowStatus?.isWindowOpen ?? true, // Default to open if unknown
    lastCustomerMessageAt: windowStatus?.lastCustomerMessageAt ?? null,
    reengagementSentAt: windowStatus?.reengagementSentAt ?? null,
    queuedMessages: windowStatus?.queuedMessages ?? [],
    queuedMessagesCount: windowStatus?.queuedMessagesCount ?? 0,
    isLoading,
    refetch,
    queueMessage,
    clearQueue,
    sendQueue,
    sendReengagement,
  };
}
