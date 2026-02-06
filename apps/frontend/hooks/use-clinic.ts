import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { useVertical } from '@/lib/vertical-provider';
import { apiClient } from '@/lib/api';
import type { Clinic, ClinicStats } from '@/lib/clinic-types';

/**
 * Hook to fetch and manage clinic data
 * Similar to useCreator but for clinic context
 */
export function useClinic() {
  const { currentUser, getIdToken, loading: authLoading } = useAuth();
  const vertical = useVertical();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clinic', currentUser?.uid, vertical.slug],
    queryFn: async (): Promise<Clinic> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      try {
        const clinic = await apiClient<Clinic>('/clinics/me', {
          token,
          suppressErrorLog: true
        });
        return clinic;
      } catch {
        // New user or no clinic exists - return minimal object with composite ID
        return {
          id: `${currentUser!.uid}_${vertical.slug}`,
          name: currentUser!.displayName || 'Nova Clínica',
          ownerId: currentUser!.uid,
          isNewClinic: true,
        } as Clinic & { isNewClinic: boolean };
      }
    },
    enabled: !!currentUser?.uid,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const updateClinic = useMutation({
    mutationFn: async (data: Partial<Clinic>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Clinic>('/clinics/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: (updatedClinic) => {
      queryClient.setQueryData(['clinic', currentUser?.uid, vertical.slug], updatedClinic);
    },
  });

  const generateSummary = useMutation({
    mutationFn: async (data: { description: string; clinicName: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<{ summary: string }>('/clinics/me/generate-summary', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Refetch clinic data to get updated greetingSummary
      queryClient.invalidateQueries({ queryKey: ['clinic', currentUser?.uid, vertical.slug] });
    },
  });

  return {
    ...query,
    currentClinic: query.data ?? null,
    isLoading: authLoading || query.isLoading,
    updateClinic,
    generateSummary,
  };
}

/**
 * Hook to fetch clinic dashboard stats
 */
export function useClinicStats(clinicId: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['clinic-stats', clinicId],
    queryFn: async (): Promise<ClinicStats> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<ClinicStats>(`/clinics/${clinicId}/stats`, {
        token,
      });
    },
    enabled: !!clinicId,
    staleTime: 60 * 1000, // Refresh every minute
    refetchInterval: 60 * 1000,
  });
}
