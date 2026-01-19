import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Professional } from '@/lib/clinic-types';

/**
 * Hook to fetch a single professional by ID
 */
export function useProfessional(clinicId: string, professionalId: string) {
  const { getIdToken } = useAuth();

  const query = useQuery({
    queryKey: ['professional', clinicId, professionalId],
    queryFn: async (): Promise<Professional | null> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      try {
        return await apiClient<Professional>(
          `/professionals/${professionalId}?clinicId=${clinicId}`,
          { token }
        );
      } catch (error) {
        return null;
      }
    },
    enabled: !!clinicId && !!professionalId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    data: query.data ?? null,
  };
}

/**
 * Hook to fetch and manage professionals for a clinic
 */
export function useProfessionals(clinicId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['professionals', clinicId],
    queryFn: async (): Promise<Professional[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Professional[]>(`/professionals?clinicId=${clinicId}`, {
        token,
      });
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Professional, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Professional>(`/professionals`, {
        method: 'POST',
        token,
        body: JSON.stringify({ ...data, clinicId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', clinicId] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Professional> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Professional>(`/professionals/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ ...data, clinicId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', clinicId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<void>(`/professionals/${id}?clinicId=${clinicId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', clinicId] });
    },
  });

  return {
    ...query,
    data: query.data ?? [],
    create,
    update,
    remove,
  };
}
