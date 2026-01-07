import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Product } from '@/lib/types';

export function useProducts(creatorId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['creator', creatorId, 'products'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Product[]>(`/products/creator/${creatorId}`, { token });
    },
    enabled: !!creatorId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Build clean payload with only allowed fields
      const payload: any = {
        creatorId,
        title: data.title,
        description: data.description,
        price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      };

      // Add optional fields only if they have values
      if (data.fileUrl && data.fileUrl.trim()) {
        payload.fileUrl = data.fileUrl;
      }

      if (data.thumbnailUrl && data.thumbnailUrl.trim()) {
        payload.thumbnailUrl = data.thumbnailUrl;
      }

      if (typeof data.active === 'boolean') {
        payload.active = data.active;
      }

      // AI Sales Agent fields
      if (data.type) payload.type = data.type;
      if (data.mainBenefit) payload.mainBenefit = data.mainBenefit;
      if (data.targetAudience) payload.targetAudience = data.targetAudience;
      if (data.tone) payload.tone = data.tone;
      if (data.objections) payload.objections = data.objections;
      if (data.objectionResponses) payload.objectionResponses = data.objectionResponses;
      if (data.ragContext) payload.ragContext = data.ragContext;

      // Delivery configuration for free products
      if (data.delivery) payload.delivery = data.delivery;

      return apiClient<Product>(`/products`, {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<Product>(`/products/${creatorId}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'products'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return apiClient<void>(`/products/${creatorId}/${productId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', creatorId, 'products'] });
    },
  });

  return {
    ...query,
    create: createMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}
