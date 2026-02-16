import { useMemo } from 'react';
import { useClinic } from './use-clinic';
import { useMetaStatus } from './use-meta-status';
import type { ClinicSetupStatus, OnboardingStep } from '@/lib/onboarding-types';

/**
 * Hook to aggregate onboarding completion status from all sources
 * Returns a unified status object for the 4-step onboarding process
 */
export function useOnboardingStatus() {
  const { currentClinic, isLoading: clinicLoading } = useClinic();
  const clinicId = currentClinic?.id || '';

  const { status: metaStatus, isLoading: metaLoading } = useMetaStatus(clinicId);

  const setupStatus = useMemo((): ClinicSetupStatus => {
    // Step 1: Clinic info is complete if clinic has name, phone, address, and vertical
    const clinicData = currentClinic as any;
    const clinicInfoComplete = Boolean(
      clinicData?.name &&
      clinicData.name !== 'Nova Clínica' &&
      clinicData.name.trim().length > 0 &&
      clinicData?.phone &&
      clinicData?.vertical &&
      clinicData?.addressData?.formatted
    );

    // Step 2: FAQ complete if at least one FAQ item has question + answer
    const workflowFaqs = Array.isArray(clinicData?.workflowFaqs) ? clinicData.workflowFaqs : [];
    const faqComplete = workflowFaqs.some((item: any) =>
      item &&
      typeof item.question === 'string' &&
      item.question.trim().length > 0 &&
      typeof item.answer === 'string' &&
      item.answer.trim().length > 0
    );

    // Step 3: Payment complete if payment method is configured (particular or convênio)
    const paymentSettings = clinicData?.paymentSettings;
    const paymentComplete = Boolean(
      paymentSettings &&
      (paymentSettings.acceptsParticular || paymentSettings.acceptsConvenio)
    );

    // Step 4: WhatsApp complete if status is CONNECTED or READY
    const whatsappComplete = Boolean(
      metaStatus?.whatsappStatus === 'CONNECTED' ||
      metaStatus?.whatsappStatus === 'READY'
    );

    // Calculate completion (4 steps total)
    // New order: Clinic -> FAQ -> Payment -> WhatsApp
    const steps = [
      clinicInfoComplete,
      faqComplete,
      paymentComplete,
      whatsappComplete,
    ];

    const completedSteps = steps.filter(Boolean).length;
    const completionPercentage = Math.round((completedSteps / 4) * 100);

    // Find next incomplete step (following new order)
    let nextStep: OnboardingStep | null = null;
    if (!clinicInfoComplete) nextStep = 1;
    else if (!faqComplete) nextStep = 2;
    else if (!paymentComplete) nextStep = 3;
    else if (!whatsappComplete) nextStep = 4;

    return {
      clinicInfoComplete,
      faqComplete,
      paymentComplete,
      whatsappComplete,
      completionPercentage,
      nextStep,
      completedSteps,
    };
  }, [currentClinic, metaStatus]);

  const isLoading = clinicLoading || metaLoading;
  const isSetupComplete = setupStatus.completionPercentage === 100;

  return {
    ...setupStatus,
    isLoading,
    isSetupComplete,
    clinicId,
  };
}
