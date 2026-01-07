import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Clinic, ClinicStats } from '@/lib/clinic-types';

/**
 * Hook to fetch and manage clinic data
 * Similar to useCreator but for clinic context
 */
export function useClinic() {
  const { currentUser, getIdToken, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clinic', currentUser?.uid],
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
        // New user or no clinic exists - return minimal object
        return {
          id: '',
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
      queryClient.setQueryData(['clinic', currentUser?.uid], updatedClinic);
    },
  });

  return {
    ...query,
    currentClinic: query.data ?? null,
    isLoading: authLoading || query.isLoading,
    updateClinic,
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
