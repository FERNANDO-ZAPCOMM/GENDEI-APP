'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Building2,
  UserPlus,
  ClipboardList,
  Calendar,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStep } from '@/lib/onboarding-types';

const STEP_ICONS = {
  Building2,
  UserPlus,
  ClipboardList,
  Calendar,
  CreditCard,
  MessageCircle,
};

interface OnboardingStepCardProps {
  step: OnboardingStep;
  title: string;
  description: string;
  icon: string;
  href: string;
  isComplete: boolean;
  isActive: boolean;
  isLast?: boolean;
}

export function OnboardingStepCard({
  step,
  title,
  description,
  icon,
  href,
  isComplete,
  isActive,
  isLast = false,
}: OnboardingStepCardProps) {
  const params = useParams();
  const locale = params.locale as string;
  const Icon = STEP_ICONS[icon as keyof typeof STEP_ICONS] || Building2;

  return (
    <Link
      href={`/${locale}${href}`}
      className={cn(
        'flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-all',
        'hover:bg-gray-50',
        !isLast && 'border-b border-gray-100',
        isActive && 'bg-blue-50/50 hover:bg-blue-50'
      )}
    >
      {/* Step number or check */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium',
          isComplete
            ? 'bg-green-100 text-green-600'
            : isActive
              ? 'bg-blue-100 text-blue-600'
              : 'bg-gray-100 text-gray-500'
        )}
      >
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          step
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
          isComplete
            ? 'bg-green-50 text-green-500'
            : isActive
              ? 'bg-blue-50 text-blue-500'
              : 'bg-gray-50 text-gray-400'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm font-medium',
            isComplete ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-700'
          )}
        >
          {title}
        </span>
        <p
          className={cn(
            'text-xs truncate',
            isComplete ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-gray-500'
          )}
        >
          {isComplete ? 'Concluído' : description}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isComplete ? 'text-green-400' : isActive ? 'text-blue-400' : 'text-gray-300'
        )}
      />
    </Link>
  );
}
