'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAllAppointments } from '@/lib/firestore';

export function useAllAppointments(limitCount = 50) {
  return useQuery({
    queryKey: ['all-appointments', limitCount],
    queryFn: () => fetchAllAppointments(limitCount),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
