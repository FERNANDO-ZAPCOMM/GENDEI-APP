'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { BookOpen, Users, Video, Check } from 'lucide-react';

interface ProductTypeOption {
  id: 'ebook' | 'mentoring' | 'community';
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}

const PRODUCT_TYPES: ProductTypeOption[] = [
  {
    id: 'ebook',
    titleKey: 'clone.productTypes.ebook.title',
    descriptionKey: 'clone.productTypes.ebook.description',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: 'mentoring',
    titleKey: 'clone.productTypes.mentoring.title',
    descriptionKey: 'clone.productTypes.mentoring.description',
    icon: <Video className="h-5 w-5" />,
  },
  {
    id: 'community',
    titleKey: 'clone.productTypes.community.title',
    descriptionKey: 'clone.productTypes.community.description',
    icon: <Users className="h-5 w-5" />,
  },
];

interface ProductTypeCardsProps {
  onSelect: (productTypes: string[]) => void;
  disabled?: boolean;
  selectedTypes?: string[];
  className?: string;
}

export function ProductTypeCards({ onSelect, disabled, selectedTypes = [], className }: ProductTypeCardsProps) {
  const t = useTranslations();

  const handleToggle = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      // Remove if already selected
      onSelect(selectedTypes.filter(t => t !== typeId));
    } else {
      // Add if not selected
      onSelect([...selectedTypes, typeId]);
    }
  };

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', className)}>
      {PRODUCT_TYPES.map((type) => {
        const isSelected = selectedTypes.includes(type.id);
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => handleToggle(type.id)}
            disabled={disabled}
            className={cn(
              'p-4 rounded-lg border text-left transition-all relative',
              'hover:shadow-md hover:border-emerald-400',
              isSelected
                ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-white',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="flex flex-col items-center text-center gap-3">
              <div className={cn(
                'h-12 w-12 rounded-full flex items-center justify-center',
                isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
              )}>
                {type.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">{t(type.titleKey)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t(type.descriptionKey)}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
