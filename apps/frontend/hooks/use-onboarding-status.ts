import { useMemo } from 'react';
import { useClinic } from './use-clinic';
import { useProfessionals } from './use-professionals';
import { useMetaStatus } from './use-meta-status';
import type { ClinicSetupStatus, OnboardingStep } from '@/lib/onboarding-types';
import type { Professional } from '@/lib/clinic-types';

/**
 * Hook to aggregate onboarding completion status from all sources
 * Returns a unified status object for the 4-step onboarding process
 */
export function useOnboardingStatus() {
  const { currentClinic, isLoading: clinicLoading } = useClinic();
  const clinicId = currentClinic?.id || '';

  const { data: professionals, isLoading: professionalsLoading } = useProfessionals(clinicId);
  const { status: metaStatus, isLoading: metaLoading } = useMetaStatus(clinicId);

  const setupStatus = useMemo((): ClinicSetupStatus => {
    // Step 1: Clinic info is complete if clinic has a name (not the default "Nova Clínica")
    const clinicInfoComplete = Boolean(
      currentClinic?.name &&
      currentClinic.name !== 'Nova Clínica' &&
      currentClinic.name.trim().length > 0
    );

    // Step 2: Professionals complete if at least 1 active professional exists
    const activeProfessionals = (professionals || []).filter((p: Professional) => p.active);
    const professionalsComplete = activeProfessionals.length > 0;

    // Step 3: Payment complete if payment settings are configured
    const paymentComplete = Boolean(
      currentClinic?.depositPercentage !== undefined ||
      (currentClinic as unknown as { paymentSettings?: unknown })?.paymentSettings
    );

    // Step 4: WhatsApp complete if status is CONNECTED or READY
    const whatsappComplete = Boolean(
      metaStatus?.whatsappStatus === 'CONNECTED' ||
      metaStatus?.whatsappStatus === 'READY'
    );

    // Calculate completion (4 steps total)
    // New order: Clinic -> Payment -> WhatsApp -> Professionals
    const steps = [
      clinicInfoComplete,
      paymentComplete,
      whatsappComplete,
      professionalsComplete,
    ];

    const completedSteps = steps.filter(Boolean).length;
    const completionPercentage = Math.round((completedSteps / 4) * 100);

    // Find next incomplete step (following new order)
    let nextStep: OnboardingStep | null = null;
    if (!clinicInfoComplete) nextStep = 1;
    else if (!paymentComplete) nextStep = 2;
    else if (!whatsappComplete) nextStep = 3;
    else if (!professionalsComplete) nextStep = 4;

    return {
      clinicInfoComplete,
      professionalsComplete,
      paymentComplete,
      whatsappComplete,
      completionPercentage,
      nextStep,
      completedSteps,
    };
  }, [currentClinic, professionals, metaStatus]);

  const isLoading = clinicLoading || professionalsLoading || metaLoading;
  const isSetupComplete = setupStatus.completionPercentage === 100;

  return {
    ...setupStatus,
    isLoading,
    isSetupComplete,
    clinicId,
  };
}
