// Gendei Onboarding Types

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface ClinicSetupStatus {
  clinicInfoComplete: boolean;      // Step 1: Clinic name is set
  professionalsComplete: boolean;   // Step 2: At least 1 active professional
  paymentComplete: boolean;         // Step 3: Payment method configured
  whatsappComplete: boolean;        // Step 4: WhatsApp status = READY
  completionPercentage: number;     // 0-100
  nextStep: OnboardingStep | null;  // First incomplete step, null if all complete
  completedSteps: number;           // Count of completed steps (0-4)
}

export interface OnboardingStepInfo {
  step: OnboardingStep;
  title: string;
  description: string;
  icon: string;  // Lucide icon name
  href: string;  // Dashboard route
  isComplete: boolean;
  isActive: boolean;  // Currently working on this step
}

// New order: Clinic -> Payment -> WhatsApp -> Professionals
export const ONBOARDING_STEPS: Omit<OnboardingStepInfo, 'isComplete' | 'isActive'>[] = [
  {
    step: 1,
    title: 'Informações da Clínica',
    description: 'Nome, endereço e telefone',
    icon: 'Building2',
    href: '/dashboard/clinic',
  },
  {
    step: 2,
    title: 'Pagamentos',
    description: 'Convênios, particular e depósito',
    icon: 'CreditCard',
    href: '/dashboard/payments',
  },
  {
    step: 3,
    title: 'WhatsApp',
    description: 'Conecte sua conta comercial',
    icon: 'MessageCircle',
    href: '/dashboard/whatsapp',
  },
  {
    step: 4,
    title: 'Profissionais',
    description: 'Adicione médicos e especialidades',
    icon: 'UserPlus',
    href: '/dashboard/professionals',
  },
];
