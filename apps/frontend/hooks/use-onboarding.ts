import { useMemo } from 'react';
import { useClinic } from './use-clinic';
import type { Clinic, PaymentSettings } from '@/lib/clinic-types';

export type OnboardingStep = 'clinic' | 'faq' | 'payments' | 'whatsapp' | 'complete';

interface OnboardingState {
  currentStep: OnboardingStep;
  isComplete: boolean;
  isClinicComplete: boolean;
  isFaqComplete: boolean;
  isPaymentsComplete: boolean;
  isWhatsAppComplete: boolean;
  nextStepUrl: string | null;
  completedSteps: number;
  totalSteps: number;
}

/**
 * Check if clinic basic info is complete
 */
function isClinicInfoComplete(clinic: Clinic | null): boolean {
  if (!clinic) return false;

  const clinicData = clinic as Clinic & {
    categories?: string[];
    category?: string;
    paymentSettings?: PaymentSettings;
  };

  // Check name
  if (!clinic.name || clinic.name === 'Nova Clínica') return false;

  // Check categories (new format) or category (old format)
  const hasCategories = (clinicData.categories && clinicData.categories.length > 0) || !!clinicData.category;
  if (!hasCategories) return false;

  // Check phone
  if (!clinic.phone) return false;

  // Check address
  if (!clinic.address && !clinic.addressData?.formatted) return false;

  // Check opening hours
  if (!clinic.openingHours) return false;

  return true;
}

/**
 * Check if FAQ information is complete
 */
function isFaqInfoComplete(clinic: Clinic | null): boolean {
  if (!clinic) return false;
  const clinicData = clinic as Clinic & { workflowFaqs?: Array<{ question: string; answer: string }> };
  const faqs = Array.isArray(clinicData.workflowFaqs) ? clinicData.workflowFaqs : [];
  return faqs.some((item) => item?.question?.trim() && item?.answer?.trim());
}

/**
 * Check if payment settings are complete
 */
function isPaymentsInfoComplete(clinic: Clinic | null): boolean {
  if (!clinic) return false;

  const clinicData = clinic as Clinic & { paymentSettings?: PaymentSettings };

  // Payment is complete if:
  // 1. They have paymentSettings saved, OR
  // 2. They have depositPercentage set (even if 0, means they've configured it)

  if (clinicData.paymentSettings) {
    // If they require deposit, they need a PIX key
    if (clinicData.paymentSettings.requiresDeposit && !clinicData.paymentSettings.pixKey) {
      return false;
    }
    return true;
  }

  // Legacy check - if depositPercentage is explicitly set
  if (clinic.depositPercentage !== undefined) {
    return true;
  }

  return false;
}

/**
 * Check if WhatsApp is connected
 */
function isWhatsAppConnected(clinic: Clinic | null): boolean {
  if (!clinic) return false;
  return clinic.whatsappConnected === true;
}

/**
 * Hook to manage onboarding flow
 * Flow: Clinic Settings -> FAQ -> Payment Settings -> WhatsApp Connection -> Dashboard
 */
export function useOnboarding(): OnboardingState {
  const { currentClinic, isLoading } = useClinic();

  return useMemo(() => {
    // Default state while loading
    if (isLoading || !currentClinic) {
      return {
        currentStep: 'clinic' as OnboardingStep,
        isComplete: false,
        isClinicComplete: false,
        isFaqComplete: false,
        isPaymentsComplete: false,
        isWhatsAppComplete: false,
        nextStepUrl: null,
        completedSteps: 0,
        totalSteps: 4,
      };
    }

    const clinicComplete = isClinicInfoComplete(currentClinic);
    const faqComplete = isFaqInfoComplete(currentClinic);
    const paymentsComplete = isPaymentsInfoComplete(currentClinic);
    const whatsappComplete = isWhatsAppConnected(currentClinic);

    // Determine current step based on what's NOT complete
    let currentStep: OnboardingStep = 'complete';
    let nextStepUrl: string | null = null;

    if (!clinicComplete) {
      currentStep = 'clinic';
      nextStepUrl = null; // Already on first step
    } else if (!faqComplete) {
      currentStep = 'faq';
      nextStepUrl = '/dashboard/faq';
    } else if (!paymentsComplete) {
      currentStep = 'payments';
      nextStepUrl = '/dashboard/payments';
    } else if (!whatsappComplete) {
      currentStep = 'whatsapp';
      nextStepUrl = '/dashboard/whatsapp';
    } else {
      currentStep = 'complete';
      nextStepUrl = '/dashboard';
    }

    const completedSteps = [clinicComplete, faqComplete, paymentsComplete, whatsappComplete].filter(Boolean).length;

    return {
      currentStep,
      isComplete: currentStep === 'complete',
      isClinicComplete: clinicComplete,
      isFaqComplete: faqComplete,
      isPaymentsComplete: paymentsComplete,
      isWhatsAppComplete: whatsappComplete,
      nextStepUrl,
      completedSteps,
      totalSteps: 4,
    };
  }, [currentClinic, isLoading]);
}

/**
 * Get the URL for the next onboarding step after the given step
 */
export function getNextStepUrl(afterStep: OnboardingStep, locale: string = 'pt-BR'): string {
  switch (afterStep) {
    case 'clinic':
      return `/${locale}/dashboard/faq`;
    case 'faq':
      return `/${locale}/dashboard/payments`;
    case 'payments':
      return `/${locale}/dashboard/whatsapp`;
    case 'whatsapp':
      return `/${locale}/dashboard`;
    default:
      return `/${locale}/dashboard`;
  }
}
