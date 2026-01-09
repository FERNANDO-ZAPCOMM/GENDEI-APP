'use client';

import { useState, useEffect } from 'react';
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
  servicesComplete: boolean;
  scheduleComplete: boolean;
  paymentComplete: boolean;
  whatsappComplete: boolean;
  nextStep: OnboardingStep | null;
}

export function SetupChecklist({
  clinicInfoComplete,
  professionalsComplete,
  servicesComplete,
  scheduleComplete,
  paymentComplete,
  whatsappComplete,
  nextStep,
}: SetupChecklistProps) {
  const completionStatus = [
    clinicInfoComplete,
    professionalsComplete,
    servicesComplete,
    scheduleComplete,
    paymentComplete,
    whatsappComplete,
  ];

  const completedCount = completionStatus.filter(Boolean).length;
  const totalSteps = 6;
  const progressPercent = (completedCount / totalSteps) * 100;
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
                <p className="text-sm font-medium text-gray-900">Configuração Completa</p>
                <p className="text-xs text-gray-600">Sua clínica está pronta para atendimentos</p>
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
              {isAllComplete ? 'Configuração Completa' : 'Configure sua Clínica'}
            </span>
            <p className="text-xs text-gray-500">
              {isAllComplete
                ? 'Sua clínica está pronta para atendimentos'
                : `${completedCount} de ${totalSteps} passos concluídos`}
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
          <Progress value={progressPercent} className="h-1.5" />
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
