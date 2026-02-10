import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';

export interface StripeConnectState {
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  country?: string;
  defaultCurrency?: string;
  updatedAt?: string;
}

interface StripeConnectStatusResponse {
  stripeConfigured: boolean;
  state: StripeConnectState;
}

interface StripeConnectLinkResponse {
  accountId: string;
  onboardingUrl: string;
}

export function useStripeConnect(clinicId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['stripe-connect-status', clinicId],
    queryFn: async (): Promise<StripeConnectStatusResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<StripeConnectStatusResponse>(`/payments/stripe-connect/${clinicId}/status`, {
        token,
      });
    },
    enabled: !!clinicId,
    staleTime: 30 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const startMutation = useMutation({
    mutationFn: async (): Promise<StripeConnectLinkResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const frontendBaseUrl =
        typeof window !== 'undefined' ? window.location.origin : undefined;
      return apiClient<StripeConnectLinkResponse>(`/payments/stripe-connect/${clinicId}/start`, {
        method: 'POST',
        token,
        body: JSON.stringify({ frontendBaseUrl }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status', clinicId] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (): Promise<StripeConnectLinkResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const frontendBaseUrl =
        typeof window !== 'undefined' ? window.location.origin : undefined;
      return apiClient<StripeConnectLinkResponse>(`/payments/stripe-connect/${clinicId}/refresh`, {
        method: 'POST',
        token,
        body: JSON.stringify({ frontendBaseUrl }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status', clinicId] });
    },
  });

  return {
    ...statusQuery,
    startOnboarding: startMutation.mutateAsync,
    refreshOnboarding: refreshMutation.mutateAsync,
    isStarting: startMutation.isPending,
    isRefreshing: refreshMutation.isPending,
  };
}
