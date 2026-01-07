import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Workflow, WorkflowPreset } from '@/lib/types';

export function useWorkflows(creatorId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all workflows for the creator
  const query = useQuery({
    queryKey: ['creator', creatorId, 'workflows'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow[]>(`/workflows/creator/${creatorId}`, { token });
    },
    enabled: !!creatorId,
  });

  // Fetch workflow presets
  const presetsQuery = useQuery({
    queryKey: ['workflow-presets'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<WorkflowPreset[]>(`/workflows/presets`, { token });
    },
    staleTime: 1000 * 60 * 60, // Cache presets for 1 hour
  });

  // Fetch the active workflow
  const activeWorkflowQuery = useQuery({
    queryKey: ['creator', creatorId, 'workflows', 'active'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow | null>(`/workflows/creator/${creatorId}/active`, { token });
    },
    enabled: !!creatorId,
  });

  // Create workflow mutation
  const createMutation = useMutation({
    mutationFn: async (data: { presetId?: string; workflow?: Partial<Workflow> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow>(`/workflows`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  // Update workflow mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Workflow> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow>(`/workflows/${creatorId}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  // Activate workflow mutation
  const activateMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<{ success: boolean }>(`/workflows/${creatorId}/${workflowId}/activate`, {
        method: 'POST',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  // Deactivate workflow mutation
  const deactivateMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<{ success: boolean }>(`/workflows/${creatorId}/${workflowId}/deactivate`, {
        method: 'POST',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  // Duplicate workflow mutation
  const duplicateMutation = useMutation({
    mutationFn: async ({ workflowId, name }: { workflowId: string; name?: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow>(`/workflows/${creatorId}/${workflowId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name }),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  // Delete workflow mutation
  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<void>(`/workflows/${creatorId}/${workflowId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'workflows'] });
    },
  });

  return {
    // Workflows list
    ...query,
    // Presets
    presets: presetsQuery.data || [],
    presetsLoading: presetsQuery.isLoading,
    presetsError: presetsQuery.error,
    refetchPresets: presetsQuery.refetch,
    // Active workflow
    activeWorkflow: activeWorkflowQuery.data,
    activeWorkflowLoading: activeWorkflowQuery.isLoading,
    // Mutations
    create: createMutation,
    update: updateMutation,
    activate: activateMutation,
    deactivate: deactivateMutation,
    duplicate: duplicateMutation,
    remove: deleteMutation,
  };
}

/**
 * Hook to fetch a single workflow
 */
export function useWorkflow(creatorId: string, workflowId: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['creator', creatorId, 'workflows', workflowId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Workflow>(`/workflows/${creatorId}/${workflowId}`, { token });
    },
    enabled: !!creatorId && !!workflowId,
  });
}
