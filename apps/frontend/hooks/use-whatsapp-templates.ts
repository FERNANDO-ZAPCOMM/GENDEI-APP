import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Use /api prefix to route through Next.js rewrite proxy (avoids CORS)
const API_URL = '/api';

export interface MessageTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
}

export interface TemplatesResponse {
  success: boolean;
  wabaId: string;
  templates: MessageTemplate[];
}

export interface CreateTemplatesResponse {
  success: boolean;
  wabaId: string;
  spmTemplate?: { id: string; status: string };
  carouselTemplate?: { id: string; status: string };
  errors: string[];
}

/**
 * Hook for fetching and managing WhatsApp message templates
 */
export function useWhatsAppTemplates(creatorId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-templates', creatorId],
    queryFn: async (): Promise<TemplatesResponse> => {
      if (!creatorId) throw new Error('Creator ID is required');

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${API_URL}/meta/templates/${creatorId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to fetch templates' }));
          throw new Error(error.error || 'Failed to fetch templates');
        }

        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw error;
      }
    },
    enabled: !!creatorId,
    retry: 1,
    retryDelay: 1000,
    staleTime: 60000, // Consider data stale after 1 minute
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  const createTemplatesMutation = useMutation({
    mutationFn: async (): Promise<CreateTemplatesResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/meta/templates/${creatorId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create templates' }));
        throw new Error(error.error || 'Failed to create templates');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refetch templates after creation
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates', creatorId] });
    },
  });

  // Find ZapComm templates
  const templates = query.data?.templates || [];
  const spmTemplate = templates.find(t => t.name === 'zapcomm_produto');
  const carouselTemplate = templates.find(t => t.name === 'zapcomm_produtos_v2');

  return {
    templates,
    spmTemplate,
    carouselTemplate,
    wabaId: query.data?.wabaId,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTemplates: createTemplatesMutation.mutate,
    isCreating: createTemplatesMutation.isPending,
    createError: createTemplatesMutation.error,
    createResult: createTemplatesMutation.data,
  };
}
