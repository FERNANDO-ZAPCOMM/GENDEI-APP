import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

export interface OrderItem {
  productId: string;
  productTitle?: string;
  title?: string;  // Legacy field - some orders use 'title' instead of 'productTitle'
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  price?: number;  // Legacy field
}

export interface Order {
  id: string;
  creatorId: string;
  waUserId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'paid' | 'failed' | 'refunded';
  status: 'pending' | 'created' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed';
  paymentMethod?: string;
  paymentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  // Free product fields
  isFree?: boolean;
  product_title?: string;  // Direct product title for free products
  product_id?: string;     // Direct product ID for free products
}

export interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageOrderValue: number;
}

export interface OrderFilters {
  startDate?: string;
  endDate?: string;
  paymentStatus?: string;
  status?: string;
  search?: string;
}

export const useOrders = (creatorId: string, filters?: OrderFilters) => {
  const queryClient = useQueryClient();
  const { getIdToken } = useAuth();

  const buildQueryParams = (filters?: OrderFilters) => {
    if (!filters) return '';
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', creatorId, filters],
    queryFn: async () => {
      if (!creatorId) return [];
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const queryParams = buildQueryParams(filters);
      const response = await fetch(`/api/orders/creator/${creatorId}${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const result = await response.json();
      return result.data as Order[];
    },
    enabled: !!creatorId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const create = useMutation({
    mutationFn: async (orderData: Partial<Order>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create order');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', creatorId] });
      queryClient.invalidateQueries({ queryKey: ['order-stats', creatorId] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Order> }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/orders/${creatorId}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', creatorId] });
      queryClient.invalidateQueries({ queryKey: ['order-stats', creatorId] });
    },
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    create,
    update,
  };
};

export const useOrderStats = (creatorId: string, filters?: Pick<OrderFilters, 'startDate' | 'endDate'>) => {
  const { getIdToken } = useAuth();

  const buildQueryParams = (filters?: Pick<OrderFilters, 'startDate' | 'endDate'>) => {
    if (!filters) return '';
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  };

  const defaultStats: OrderStats = {
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    averageOrderValue: 0,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order-stats', creatorId, filters ?? null],
    queryFn: async (): Promise<OrderStats> => {
      if (!creatorId) {
        return defaultStats;
      }
      const token = await getIdToken();
      if (!token) {
        return defaultStats;
      }

      const queryParams = buildQueryParams(filters);
      const response = await fetch(`/api/orders/creator/${creatorId}/stats${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        // Return default stats instead of throwing to avoid undefined
        return defaultStats;
      }
      const result = await response.json();
      // Ensure we never return undefined
      return result ?? defaultStats;
    },
    enabled: !!creatorId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};
