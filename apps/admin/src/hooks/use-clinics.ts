'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchAllClinics,
  fetchClinicById,
  fetchClinicProfessionals,
  fetchClinicPatients,
  fetchClinicAppointments,
} from '@/lib/firestore';

export function useClinics() {
  return useQuery({
    queryKey: ['clinics'],
    queryFn: fetchAllClinics,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useClinic(clinicId: string | null) {
  return useQuery({
    queryKey: ['clinic', clinicId],
    queryFn: () => (clinicId ? fetchClinicById(clinicId) : null),
    enabled: !!clinicId,
  });
}

export function useClinicProfessionals(clinicId: string | null) {
  return useQuery({
    queryKey: ['clinic-professionals', clinicId],
    queryFn: () => (clinicId ? fetchClinicProfessionals(clinicId) : []),
    enabled: !!clinicId,
  });
}

export function useClinicPatients(clinicId: string | null) {
  return useQuery({
    queryKey: ['clinic-patients', clinicId],
    queryFn: () => (clinicId ? fetchClinicPatients(clinicId) : []),
    enabled: !!clinicId,
  });
}

export function useClinicAppointments(clinicId: string | null) {
  return useQuery({
    queryKey: ['clinic-appointments', clinicId],
    queryFn: () => (clinicId ? fetchClinicAppointments(clinicId) : []),
    enabled: !!clinicId,
  });
}
