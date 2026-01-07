import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

export function useTimeBlocks(clinicId: string, options: UseTimeBlocksOptions = {}) {
  const queryClient = useQueryClient();

  const queryKey = ['timeBlocks', clinicId, options];

  const { data = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return [];

      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      if (options.professionalId) params.append('professionalId', options.professionalId);

      const response = await api.get(`/clinics/${clinicId}/time-blocks?${params.toString()}`);
      return response.data.timeBlocks || [];
    },
    enabled: !!clinicId,
  });

  const createBlock = useMutation({
    mutationFn: async (input: CreateTimeBlockInput) => {
      const response = await api.post(`/clinics/${clinicId}/time-blocks`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeBlocks', clinicId] });
    },
  });

  const deleteBlock = useMutation({
    mutationFn: async (blockId: string) => {
      await api.delete(`/clinics/${clinicId}/time-blocks/${blockId}`);
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
