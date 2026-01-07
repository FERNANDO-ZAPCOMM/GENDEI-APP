import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Professional } from '@/lib/clinic-types';

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

      return apiClient<Professional[]>(`/professionals/clinic/${clinicId}`, {
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

      return apiClient<Professional>(`/professionals/clinic/${clinicId}`, {
        method: 'POST',
        token,
        body: JSON.stringify(data),
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
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
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

      return apiClient<void>(`/professionals/${id}`, {
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
