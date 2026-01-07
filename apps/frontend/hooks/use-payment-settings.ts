import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { PaymentSettings } from '@/lib/types';

export function usePaymentSettings(creatorId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['creator', creatorId, 'payments'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const response = await apiClient<{ pixKey?: string | null }>(`/creators/${creatorId}/payments`, { token });
      // Transform camelCase from backend to snake_case for frontend
      return {
        pix_key: response.pixKey || undefined,
      } as PaymentSettings;
    },
    enabled: !!creatorId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { pix_key: string; confirm_pix_key: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      // Transform snake_case to camelCase for backend
      return apiClient(`/creators/${creatorId}/payments`, {
        method: 'PUT',
        body: JSON.stringify({ pixKey: data.pix_key }),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'payments'] });
    },
  });

  return { ...query, update: updateMutation };
}
