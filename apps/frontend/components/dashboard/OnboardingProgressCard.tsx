'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  UserPlus,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-types';

interface OnboardingProgressCardProps {
  clinicInfoComplete: boolean;
  professionalsComplete: boolean;
  paymentComplete: boolean;
  whatsappComplete: boolean;
  completionPercentage: number;
  nextStep: OnboardingStep | null;
}

const STEP_ICONS = {
  Building2,
  UserPlus,
  CreditCard,
  MessageCircle,
};

export function OnboardingProgressCard({
  clinicInfoComplete,
  professionalsComplete,
  paymentComplete,
  whatsappComplete,
  completionPercentage,
}: OnboardingProgressCardProps) {
  const params = useParams();
  const locale = params.locale as string;

  const completionStatus = [
    clinicInfoComplete,
    professionalsComplete,
    paymentComplete,
    whatsappComplete,
  ];

  const completedCount = completionStatus.filter(Boolean).length;
  const totalSteps = 4;
  const isAllComplete = completedCount === totalSteps;

  // Auto-collapse when all complete
  const [isExpanded, setIsExpanded] = useState(!isAllComplete);

  // Update expansion state when completion changes
  useEffect(() => {
    if (isAllComplete) {
      // Collapse after a short delay to show the completion animation
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsExpanded(true);
    }
  }, [isAllComplete]);

  // Build steps with completion status
  const stepsWithStatus = ONBOARDING_STEPS.map((step, index) => ({
    ...step,
    isComplete: completionStatus[index],
    href: `/${locale}${step.href}`,
  }));

  // If all complete and collapsed, show minimal view
  if (isAllComplete && !isExpanded) {
    return (
      <Card>
        <CardContent className="py-3">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Configuração Completa!</p>
                <p className="text-xs text-gray-600">Sua clínica está pronta para receber agendamentos</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">
              {isAllComplete ? 'Configuração Completa!' : 'Configure sua Clínica'}
            </span>
            <p className="text-xs text-gray-500">
              {isAllComplete
                ? 'Sua clínica está pronta para receber agendamentos'
                : `${completedCount} de ${totalSteps} passos completos`}
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <Progress value={completionPercentage} className="h-1.5" />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-0 pt-0">
          {stepsWithStatus.map((step, index) => {
            const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS];

            return (
              <Link
                key={step.step}
                href={step.href}
                className={cn(
                  'flex items-center gap-3 py-2.5 hover:bg-gray-50 transition-colors -mx-2 px-2 rounded-lg',
                  index < stepsWithStatus.length - 1 && 'border-b'
                )}
              >
                {/* Status indicator */}
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0',
                  step.isComplete
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                )}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>

                {/* Icon */}
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0',
                  step.isComplete
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {step.title}
                  </span>
                  <p className={cn(
                    'text-xs',
                    step.isComplete ? 'text-green-600' : 'text-gray-500'
                  )}>
                    {step.isComplete ? 'Completo' : step.description}
                  </p>
                </div>

                {/* Right status */}
                <div className="flex-shrink-0">
                  <CheckCircle2 className={cn(
                    'h-4 w-4',
                    step.isComplete ? 'text-green-500' : 'text-gray-300'
                  )} />
                </div>
              </Link>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
