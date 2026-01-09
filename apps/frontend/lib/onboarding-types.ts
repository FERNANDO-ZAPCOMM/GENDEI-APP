// Gendei Onboarding Types

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface ClinicSetupStatus {
  clinicInfoComplete: boolean;      // Step 1: Clinic name is set
  professionalsComplete: boolean;   // Step 2: At least 1 active professional
  servicesComplete: boolean;        // Step 3: At least 1 active service
  scheduleComplete: boolean;        // Step 4: Working hours configured
  paymentComplete: boolean;         // Step 5: Payment method configured
  whatsappComplete: boolean;        // Step 6: WhatsApp status = READY
  completionPercentage: number;     // 0-100
  nextStep: OnboardingStep | null;  // First incomplete step, null if all complete
  completedSteps: number;           // Count of completed steps (0-6)
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

export const ONBOARDING_STEPS: Omit<OnboardingStepInfo, 'isComplete' | 'isActive'>[] = [
  {
    step: 1,
    title: 'Informações da Clínica',
    description: 'Nome, endereço, telefone e horário de funcionamento',
    icon: 'Building2',
    href: '/dashboard/clinic',
  },
  {
    step: 2,
    title: 'Profissionais',
    description: 'Adicione médicos e especialistas',
    icon: 'UserPlus',
    href: '/dashboard/professionals',
  },
  {
    step: 3,
    title: 'Serviços',
    description: 'Configure consultas, preços e duração',
    icon: 'ClipboardList',
    href: '/dashboard/services',
  },
  {
    step: 4,
    title: 'Agenda',
    description: 'Horários de atendimento dos profissionais',
    icon: 'Calendar',
    href: '/dashboard/schedule',
  },
  {
    step: 5,
    title: 'Pagamentos',
    description: 'Convênios, particular e depósito',
    icon: 'CreditCard',
    href: '/dashboard/payments',
  },
  {
    step: 6,
    title: 'WhatsApp',
    description: 'Conecte sua conta comercial',
    icon: 'MessageCircle',
    href: '/dashboard/whatsapp',
  },
];
