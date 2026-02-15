import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { HeldPayment } from '@/lib/clinic-types';

interface TransferResult {
  transferred: number;
  failed: number;
  results: Array<{
    orderId: string;
    transferId?: string;
    status: string;
    error?: string;
  }>;
}

export function useHeldPayments(clinicId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['held-payments', clinicId],
    queryFn: async (): Promise<HeldPayment[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const result = await apiClient<{ data: HeldPayment[] }>(
        `/payments/stripe-connect/${clinicId}/held`,
        { token }
      );
      return result.data || [];
    },
    enabled: !!clinicId,
    staleTime: 30_000,
  });

  const transferMutation = useMutation({
    mutationFn: async (): Promise<TransferResult> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<TransferResult>(
        `/payments/stripe-connect/${clinicId}/transfer-held`,
        { method: 'POST', token }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['held-payments', clinicId] });
      queryClient.invalidateQueries({ queryKey: ['payments', clinicId] });
    },
  });

  return {
    heldPayments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    transferHeld: transferMutation.mutateAsync,
    isTransferring: transferMutation.isPending,
  };
}
