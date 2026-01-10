import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Patient } from '@/lib/clinic-types';

interface PatientFilters {
  search?: string;
  tag?: string;
  professionalId?: string;
}

/**
 * Hook to fetch and manage patients for a clinic
 */
export function usePatients(clinicId: string, filters?: PatientFilters) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['patients', clinicId, filters],
    queryFn: async (): Promise<Patient[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('clinicId', clinicId);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.tag) params.append('tag', filters.tag);
      if (filters?.professionalId) params.append('professionalId', filters.professionalId);

      return apiClient<Patient[]>(`/patients?${params.toString()}`, { token });
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Patient, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Patient>(`/patients`, {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', clinicId] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Patient> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Patient>(`/patients/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', clinicId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<void>(`/patients/${id}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', clinicId] });
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

/**
 * Hook to fetch a single patient by phone number
 */
export function usePatientByPhone(clinicId: string, phone: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['patient', clinicId, phone],
    queryFn: async (): Promise<Patient | null> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      try {
        return await apiClient<Patient>(`/patients/by-phone/${phone}`, {
          token,
          suppressErrorLog: true,
        });
      } catch {
        return null;
      }
    },
    enabled: !!clinicId && !!phone,
    staleTime: 5 * 60 * 1000,
  });
}
