import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { WhatsAppChannel } from '@/lib/types';

export function useWhatsAppChannel(creatorId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<WhatsAppChannel | null>({
    queryKey: ['creator', creatorId, 'whatsapp'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      try {
        return await apiClient<WhatsAppChannel>(`/creators/${creatorId}/channel/whatsapp`, {
          token,
          suppressErrorLog: true,
        });
      } catch (error: any) {
        if (error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!creatorId,
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { phone_e164: string; verify_code?: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient(`/creators/${creatorId}/channel/whatsapp/connect`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
        suppressErrorLog: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'whatsapp'] });
    },
  });

  return { ...query, connect: connectMutation };
}
