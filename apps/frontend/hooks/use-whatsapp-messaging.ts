import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import type { TestMessageRequest, TestMessageResponse } from '@/lib/types';

/**
 * Hook for sending WhatsApp test messages
 */
export function useWhatsAppMessaging() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const sendTestMessage = useMutation({
    mutationFn: async (data: TestMessageRequest): Promise<TestMessageResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send test message');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate meta status to update testMessageSent flag
      queryClient.invalidateQueries({ queryKey: ['meta-status'] });
    },
  });

  return {
    sendTestMessage: sendTestMessage.mutate,
    sendTestMessageAsync: sendTestMessage.mutateAsync,
    isSending: sendTestMessage.isPending,
    error: sendTestMessage.error,
    data: sendTestMessage.data,
  };
}
