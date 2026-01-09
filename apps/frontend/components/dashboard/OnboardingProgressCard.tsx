'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  UserPlus,
  ClipboardList,
  Calendar,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-types';

interface OnboardingProgressCardProps {
  clinicInfoComplete: boolean;
  professionalsComplete: boolean;
  servicesComplete: boolean;
  scheduleComplete: boolean;
  paymentComplete: boolean;
  whatsappComplete: boolean;
  completionPercentage: number;
  nextStep: OnboardingStep | null;
}

const STEP_ICONS = {
  Building2,
  UserPlus,
  ClipboardList,
  Calendar,
  CreditCard,
  MessageCircle,
};

export function OnboardingProgressCard({
  clinicInfoComplete,
  professionalsComplete,
  servicesComplete,
  scheduleComplete,
  paymentComplete,
  whatsappComplete,
  completionPercentage,
  nextStep,
}: OnboardingProgressCardProps) {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const completionStatus = [
    clinicInfoComplete,
    professionalsComplete,
    servicesComplete,
    scheduleComplete,
    paymentComplete,
    whatsappComplete,
  ];

  const completedCount = completionStatus.filter(Boolean).length;
  const isAllComplete = completedCount === 6;

  // Find current step info
  const currentStepInfo = nextStep ? ONBOARDING_STEPS.find(s => s.step === nextStep) : null;

  if (isAllComplete) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Configuração Completa!</h3>
              <p className="text-sm text-green-700">
                Sua clínica está pronta para receber agendamentos pelo WhatsApp.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleContinue = () => {
    if (currentStepInfo) {
      router.push(`/${locale}${currentStepInfo.href}`);
    }
  };

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Configure sua Clínica</CardTitle>
            <CardDescription>
              Complete os passos abaixo para começar a receber agendamentos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <span>{completedCount}/6</span>
            <span className="text-gray-400">passos</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={completionPercentage} className="h-2" />
          <p className="text-xs text-gray-500 text-right">{completionPercentage}% completo</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-between">
          {ONBOARDING_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS];
            const isComplete = completionStatus[index];
            const isCurrent = step.step === nextStep;

            return (
              <div key={step.step} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                    isComplete
                      ? 'bg-green-100 text-green-600'
                      : isCurrent
                        ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-300'
                        : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] text-center max-w-[60px] leading-tight',
                    isComplete
                      ? 'text-green-600 font-medium'
                      : isCurrent
                        ? 'text-blue-600 font-medium'
                        : 'text-gray-400'
                  )}
                >
                  {step.title.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current step highlight */}
        {currentStepInfo && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const Icon = STEP_ICONS[currentStepInfo.icon as keyof typeof STEP_ICONS];
                  return <Icon className="h-5 w-5 text-blue-600" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">
                  Próximo passo
                </p>
                <h4 className="font-semibold text-gray-900">{currentStepInfo.title}</h4>
                <p className="text-sm text-gray-500 mt-0.5">{currentStepInfo.description}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleContinue}>
                Continuar Configuração
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
