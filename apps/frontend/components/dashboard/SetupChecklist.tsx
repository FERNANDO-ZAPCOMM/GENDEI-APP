'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { OnboardingStepCard } from './OnboardingStepCard';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-types';

interface SetupChecklistProps {
  clinicInfoComplete: boolean;
  professionalsComplete: boolean;
  paymentComplete: boolean;
  whatsappComplete: boolean;
  nextStep: OnboardingStep | null;
}

export function SetupChecklist({
  clinicInfoComplete,
  professionalsComplete,
  paymentComplete,
  whatsappComplete,
  nextStep,
}: SetupChecklistProps) {
  // Order: Clinic -> Payment -> WhatsApp -> Professionals
  const completionStatus = [
    clinicInfoComplete,
    paymentComplete,
    whatsappComplete,
    professionalsComplete,
  ];

  const completedCount = completionStatus.filter(Boolean).length;
  const totalSteps = 4;
  const progressPercent = (completedCount / totalSteps) * 100;
  const isAllComplete = completedCount === totalSteps;

  // Always start expanded, user can collapse
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className={isAllComplete ? 'border-green-200 bg-green-50/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAllComplete && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            <div>
              <span className="text-sm font-medium">
                {isAllComplete ? 'Configuração Completa' : 'Configure sua Clínica'}
              </span>
              <p className="text-xs text-gray-500">
                {isAllComplete
                  ? 'Sua clínica está pronta para atendimentos'
                  : `${completedCount} de ${totalSteps} passos concluídos`}
              </p>
            </div>
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
          <Progress
            value={progressPercent}
            className={`h-1.5 ${isAllComplete ? '[&>div]:bg-green-500' : ''}`}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-0 pt-0">
          {ONBOARDING_STEPS.map((step, index) => (
            <OnboardingStepCard
              key={step.step}
              step={step.step}
              title={step.title}
              description={step.description}
              icon={step.icon}
              href={step.href}
              isComplete={completionStatus[index]}
              isActive={step.step === nextStep}
              isLast={index === ONBOARDING_STEPS.length - 1}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
