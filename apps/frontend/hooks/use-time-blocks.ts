import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';

export interface TimeBlock {
  id: string;
  clinicId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  professionalId?: string;
  professionalName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTimeBlockInput {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  professionalId?: string;
  professionalName?: string;
}

interface UseTimeBlocksOptions {
  startDate?: string;
  endDate?: string;
  professionalId?: string;
}

interface TimeBlocksResponse {
  timeBlocks: TimeBlock[];
}

export function useTimeBlocks(clinicId: string, options: UseTimeBlocksOptions = {}) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['timeBlocks', clinicId, options];

  const { data = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<TimeBlock[]> => {
      if (!clinicId) return [];

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      if (options.professionalId) params.append('professionalId', options.professionalId);

      const queryString = params.toString();
      const url = `/clinics/${clinicId}/time-blocks${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient<TimeBlocksResponse>(url, { token });
      return response.timeBlocks || [];
    },
    enabled: !!clinicId,
  });

  const createBlock = useMutation({
    mutationFn: async (input: CreateTimeBlockInput) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<TimeBlock>(`/clinics/${clinicId}/time-blocks`, {
        method: 'POST',
        token,
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeBlocks', clinicId] });
    },
  });

  const deleteBlock = useMutation({
    mutationFn: async (blockId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      await apiClient(`/clinics/${clinicId}/time-blocks/${blockId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeBlocks', clinicId] });
    },
  });

  return {
    timeBlocks: data as TimeBlock[],
    isLoading,
    error,
    createBlock,
    deleteBlock,
  };
}
