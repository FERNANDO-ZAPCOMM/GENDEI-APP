import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';
import type { Appointment, DayAvailability } from '@/lib/clinic-types';

interface AppointmentFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  professionalId?: string;
  status?: string;
}

/**
 * Hook to fetch and manage appointments for a clinic
 */
export function useAppointments(clinicId: string, filters?: AppointmentFilters) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['appointments', clinicId, filters],
    queryFn: async (): Promise<Appointment[]> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters?.date) params.append('date', filters.date);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.professionalId) params.append('professionalId', filters.professionalId);
      if (filters?.status) params.append('status', filters.status);

      const queryString = params.toString();
      const url = `/appointments/clinic/${clinicId}${queryString ? `?${queryString}` : ''}`;

      return apiClient<Appointment[]>(url, { token });
    },
    enabled: !!clinicId,
    staleTime: 30 * 1000, // Refresh more frequently for appointments
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Appointment, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Appointment>(`/appointments/clinic/${clinicId}`, {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', clinicId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Appointment>(`/appointments/${id}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', clinicId] });
    },
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string; time: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Appointment>(`/appointments/${id}/reschedule`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ date, time }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', clinicId] });
    },
  });

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<Appointment>(`/appointments/${id}/cancel`, {
        method: 'POST',
        token,
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', clinicId] });
    },
  });

  return {
    ...query,
    data: query.data ?? [],
    create,
    updateStatus,
    reschedule,
    cancel,
  };
}

/**
 * Hook to fetch today's appointments
 */
export function useTodayAppointments(clinicId: string) {
  const today = new Date().toISOString().split('T')[0];
  return useAppointments(clinicId, { date: today });
}

/**
 * Hook to fetch availability for a professional
 */
export function useAvailability(clinicId: string, professionalId: string, date: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: ['availability', clinicId, professionalId, date],
    queryFn: async (): Promise<DayAvailability> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      return apiClient<DayAvailability>(
        `/appointments/availability/${professionalId}?date=${date}`,
        { token }
      );
    },
    enabled: !!clinicId && !!professionalId && !!date,
    staleTime: 60 * 1000,
  });
}
