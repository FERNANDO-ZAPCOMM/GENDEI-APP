'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceStyleOption {
  id: 'friendly_coach' | 'professional_expert' | 'formal_consultant';
  titleKey: string;
  descriptionKey: string;
}

const VOICE_STYLES: VoiceStyleOption[] = [
  {
    id: 'friendly_coach',
    titleKey: 'clone.voiceStyles.friendlyCoach.title',
    descriptionKey: 'clone.voiceStyles.friendlyCoach.description',
  },
  {
    id: 'professional_expert',
    titleKey: 'clone.voiceStyles.professionalExpert.title',
    descriptionKey: 'clone.voiceStyles.professionalExpert.description',
  },
  {
    id: 'formal_consultant',
    titleKey: 'clone.voiceStyles.formalConsultant.title',
    descriptionKey: 'clone.voiceStyles.formalConsultant.description',
  },
];

interface VoiceStyleCardsProps {
  onSelect: (styleId: string, styleTitle: string) => void;
  disabled?: boolean;
  selectedStyle?: string;
  className?: string;
}

export function VoiceStyleCards({ onSelect, disabled, selectedStyle, className }: VoiceStyleCardsProps) {
  const t = useTranslations();

  return (
    <div className={cn('grid grid-cols-1 gap-3 w-[420px] max-w-[90%]', className)}>
      {VOICE_STYLES.map((style) => {
        const isSelected = selectedStyle === style.id;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style.id, t(style.titleKey))}
            disabled={disabled}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              'hover:shadow-md hover:border-emerald-400',
              isSelected
                ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-white',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{t(style.titleKey)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t(style.descriptionKey)}</div>
              </div>
              {/* Checkmark indicator */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all',
                isSelected
                  ? 'bg-emerald-600'
                  : 'border-2 border-slate-200'
              )}>
                {isSelected && <Check className="h-4 w-4 text-white" />}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Yes/No Buttons Component for products/services
interface YesNoButtonsProps {
  onSelect: (value: boolean) => void;
  disabled?: boolean;
}

export function YesNoButtons({ onSelect, disabled }: YesNoButtonsProps) {
  const t = useTranslations();

  return (
    <div className="flex gap-2 mt-1 mb-0">
      <button
        type="button"
        onClick={() => onSelect(true)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all',
          'border-slate-300 bg-white text-slate-600',
          'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Check className="h-4 w-4" />
        {t('common.yes')}
      </button>
      <button
        type="button"
        onClick={() => onSelect(false)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all',
          'border-slate-300 bg-white text-slate-600',
          'hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <X className="h-4 w-4" />
        {t('common.no')}
      </button>
    </div>
  );
}
