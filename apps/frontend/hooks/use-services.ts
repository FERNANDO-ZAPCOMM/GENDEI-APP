import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Service } from '@/lib/clinic-types';

/**
 * Hook to fetch and manage services for a clinic
 */
export function useServices(clinicId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['services', clinicId],
    queryFn: async (): Promise<Service[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Service[]>(`/services?clinicId=${clinicId}`, {
        token,
      });
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Service, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Service>(`/services`, {
        method: 'POST',
        token,
        body: JSON.stringify({ ...data, clinicId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', clinicId] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Service>(`/services/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ ...data, clinicId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', clinicId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<void>(`/services/${id}?clinicId=${clinicId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', clinicId] });
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
