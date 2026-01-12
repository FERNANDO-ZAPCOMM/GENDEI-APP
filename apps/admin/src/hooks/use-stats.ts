'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPlatformStats } from '@/lib/firestore';

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: fetchPlatformStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
