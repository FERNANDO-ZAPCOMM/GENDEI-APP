import { useMemo } from 'react';
import { useClinic } from './use-clinic';
import { useProfessionals } from './use-professionals';
import { useServices } from './use-services';
import { useMetaStatus } from './use-meta-status';
import type { ClinicSetupStatus, OnboardingStep } from '@/lib/onboarding-types';
import type { Professional } from '@/lib/clinic-types';

/**
 * Hook to aggregate onboarding completion status from all sources
 * Returns a unified status object for the 5-step onboarding process
 */
export function useOnboardingStatus() {
  const { currentClinic, isLoading: clinicLoading } = useClinic();
  const clinicId = currentClinic?.id || '';

  const { data: professionals, isLoading: professionalsLoading } = useProfessionals(clinicId);
  const { data: services, isLoading: servicesLoading } = useServices(clinicId);
  const { status: metaStatus, isLoading: metaLoading } = useMetaStatus(clinicId);

  const setupStatus = useMemo((): ClinicSetupStatus => {
    // Step 1: Clinic info is complete if clinic has a name (not default) AND category
    const clinicCategory = (currentClinic as unknown as { category?: string })?.category;
    const clinicInfoComplete = Boolean(
      currentClinic?.name &&
      currentClinic.name !== 'Nova Clínica' &&
      currentClinic.name.trim().length > 0 &&
      clinicCategory &&
      clinicCategory.trim().length > 0
    );

    // Step 2: Professionals complete if at least 1 active professional exists with schedule
    const activeProfessionals = (professionals || []).filter((p: Professional) => p.active);
    // Professional is considered complete if they have working hours configured
    const professionalsWithSchedule = activeProfessionals.filter((p: Professional) => {
      if (!p.workingHours) return false;
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
      return days.some(day => {
        const schedule = p.workingHours?.[day];
        return schedule && schedule.start && schedule.end;
      });
    });
    const professionalsComplete = professionalsWithSchedule.length > 0;

    // Step 3: Services complete if at least 1 active service exists
    const activeServices = (services || []).filter((s) => s.active);
    const servicesComplete = activeServices.length > 0;

    // Step 4: Payment complete if payment settings are configured
    const paymentComplete = Boolean(
      currentClinic?.depositPercentage !== undefined ||
      (currentClinic as unknown as { paymentSettings?: unknown })?.paymentSettings
    );

    // Step 5: WhatsApp complete if status is CONNECTED or READY
    const whatsappComplete = Boolean(
      metaStatus?.whatsappStatus === 'CONNECTED' ||
      metaStatus?.whatsappStatus === 'READY'
    );

    // Calculate completion
    const steps = [
      clinicInfoComplete,
      professionalsComplete,
      servicesComplete,
      paymentComplete,
      whatsappComplete,
    ];

    const completedSteps = steps.filter(Boolean).length;
    const completionPercentage = Math.round((completedSteps / 5) * 100);

    // Find next incomplete step
    let nextStep: OnboardingStep | null = null;
    if (!clinicInfoComplete) nextStep = 1;
    else if (!professionalsComplete) nextStep = 2;
    else if (!servicesComplete) nextStep = 3;
    else if (!paymentComplete) nextStep = 4;
    else if (!whatsappComplete) nextStep = 5;

    return {
      clinicInfoComplete,
      professionalsComplete,
      servicesComplete,
      paymentComplete,
      whatsappComplete,
      completionPercentage,
      nextStep,
      completedSteps,
    };
  }, [currentClinic, professionals, services, metaStatus]);

  const isLoading = clinicLoading || professionalsLoading || servicesLoading || metaLoading;
  const isSetupComplete = setupStatus.completionPercentage === 100;

  return {
    ...setupStatus,
    isLoading,
    isSetupComplete,
    clinicId,
  };
}
