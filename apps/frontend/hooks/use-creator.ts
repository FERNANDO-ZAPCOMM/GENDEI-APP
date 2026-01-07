import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import { getCurrencyByCountry } from '@/lib/currency';
import type { Creator } from '@/lib/types';

/**
 * Hook to fetch and manage creator/creator data
 * For new users without a profile, returns a minimal creator object
 */
export function useCreator() {
  const { currentUser, getIdToken, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['creator', currentUser?.uid],
    queryFn: async (): Promise<Creator> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      try {
        // Try to fetch creator from API
        const creator = await apiClient<Creator>('/creators/me', {
          token,
          suppressErrorLog: true
        });

        // Enrich with currency info if country is available
        if (creator.country) {
          const currencyInfo = getCurrencyByCountry(creator.country);
          return {
            ...creator,
            currency: creator.currency || currencyInfo.code,
            currencyLocale: creator.currencyLocale || currencyInfo.locale,
          };
        }

        return creator;
      } catch {
        // New user or no creator exists - return minimal creator object
        return {
          id: currentUser!.uid,
          name: currentUser!.displayName || currentUser!.email?.split('@')[0] || 'New User',
          status: 'active' as const,
          isNewUser: true,
        } as Creator;
      }
    },
    enabled: !!currentUser?.uid,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const updateCreator = useMutation({
    mutationFn: async (data: Partial<Creator>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Creator>('/creators/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: (updatedCreator) => {
      queryClient.setQueryData(['creator', currentUser?.uid], updatedCreator);
    },
  });

  return {
    ...query,
    currentCreator: query.data ?? null,
    isLoading: authLoading || query.isLoading,
    updateCreator,
  };
}

