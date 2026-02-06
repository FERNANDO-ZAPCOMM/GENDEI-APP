import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import type { WhatsAppStatus, MetaStatusResponse } from '@/lib/types';

// Use /api prefix to route through Next.js rewrite proxy (avoids CORS)
const API_URL = '/api';

/**
 * Hook for fetching and managing WhatsApp connection status
 * Polls every 30 seconds to keep status fresh
 */
export function useMetaStatus(clinicId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['meta-status', clinicId],
    queryFn: async (): Promise<WhatsAppStatus> => {
      if (!clinicId) throw new Error('Creator ID is required');

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Create an AbortController to timeout the request after 10 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_URL}/meta/status/${clinicId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 404 means no WhatsApp connection yet - return disconnected status
        if (response.status === 404) {
          return {
            whatsappStatus: 'DISCONNECTED',
          } as WhatsAppStatus;
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Failed to fetch connection status' }));
          throw new Error(error.message || 'Failed to fetch connection status');
        }

        const result: MetaStatusResponse = await response.json();
        return result.data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw error;
      }
    },
    enabled: !!clinicId,
    retry: 1, // Only retry once
    retryDelay: 1000, // Wait 1 second before retrying
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce unnecessary calls
    // Return undefined on error instead of throwing
    throwOnError: false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/meta/sync/${clinicId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync connection data');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refetch status after successful sync
      queryClient.invalidateQueries({ queryKey: ['meta-status', clinicId] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/meta/disconnect/${clinicId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to disconnect WhatsApp');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refetch status after disconnect
      queryClient.invalidateQueries({ queryKey: ['meta-status', clinicId] });
    },
  });

  return {
    status: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
