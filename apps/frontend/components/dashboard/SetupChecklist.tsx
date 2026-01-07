'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  Package,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  isComplete: boolean;
}

interface SetupChecklistProps {
  hasProfile: boolean;
  hasWhatsApp: boolean;
  hasProduct: boolean;
}

export function SetupChecklist({
  hasProfile,
  hasWhatsApp,
  hasProduct,
}: SetupChecklistProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  // Calculate completion status
  const steps: SetupStep[] = useMemo(() => [
    {
      id: 'profile',
      title: t('setup.steps.profile.title'),
      description: t('setup.steps.profile.description'),
      icon: <User className="h-4 w-4" />,
      href: `/${locale}/dashboard/clone`,
      isComplete: hasProfile,
    },
    {
      id: 'whatsapp',
      title: t('setup.steps.whatsapp.title'),
      description: t('setup.steps.whatsapp.description'),
      icon: <FaWhatsapp className="h-4 w-4" />,
      href: `/${locale}/dashboard/whatsapp`,
      isComplete: hasWhatsApp,
    },
    {
      id: 'product',
      title: t('setup.steps.product.title'),
      description: t('setup.steps.product.description'),
      icon: <Package className="h-4 w-4" />,
      href: `/${locale}/dashboard/products/new`,
      isComplete: hasProduct,
    },
  ], [hasProfile, hasWhatsApp, hasProduct, locale, t]);

  const completedCount = steps.filter((s) => s.isComplete).length;
  const totalSteps = steps.length;
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

  // Find the next incomplete step
  const nextStep = steps.find((s) => !s.isComplete);

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
                <p className="text-sm font-medium text-gray-900">{t('setup.allComplete')}</p>
                <p className="text-xs text-gray-600">{t('setup.readyToSell')}</p>
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
              {isAllComplete ? t('setup.allComplete') : t('setup.title')}
            </span>
            <p className="text-xs text-gray-500">
              {isAllComplete
                ? t('setup.readyToSell')
                : t('setup.subtitle', { completed: completedCount, total: totalSteps })}
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
          {steps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                'flex items-center gap-3 py-2.5 hover:bg-gray-50 transition-colors -mx-2 px-2 rounded-lg',
                index < steps.length - 1 && 'border-b'
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
                {step.icon}
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
                  {step.isComplete ? t('setup.completed') : step.description}
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
          ))}
        </CardContent>
      )}
    </Card>
  );
}
