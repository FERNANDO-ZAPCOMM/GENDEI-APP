import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { PaymentTransaction } from '@/lib/clinic-types';

export function usePayments(clinicId: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['payments', clinicId],
    queryFn: async (): Promise<PaymentTransaction[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<PaymentTransaction[]>(`/payments/clinic/${clinicId}`, { token });
    },
    enabled: !!clinicId,
    staleTime: 30 * 1000,
  });
}
