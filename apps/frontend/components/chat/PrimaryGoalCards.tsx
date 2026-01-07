'use client';

import { cn } from '@/lib/utils';
import { Target, Calendar, Mail, Sprout } from 'lucide-react';

interface GoalOption {
  id: 'sell' | 'schedule' | 'capture' | 'nurture';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const GOALS: GoalOption[] = [
  {
    id: 'sell',
    title: 'Vender Produtos',
    description: 'Vender e-books, cursos, mentorias ou serviços',
    icon: <Target className="h-5 w-5" />,
    color: 'text-green-600',
  },
  {
    id: 'schedule',
    title: 'Agendar Reuniões',
    description: 'Qualificar e agendar calls ou consultas',
    icon: <Calendar className="h-5 w-5" />,
    color: 'text-blue-600',
  },
  {
    id: 'capture',
    title: 'Capturar Leads',
    description: 'Coletar contatos para nutrir depois',
    icon: <Mail className="h-5 w-5" />,
    color: 'text-purple-600',
  },
  {
    id: 'nurture',
    title: 'Educar e Nutrir',
    description: 'Enviar conteúdo e construir relacionamento',
    icon: <Sprout className="h-5 w-5" />,
    color: 'text-amber-600',
  },
];

interface PrimaryGoalCardsProps {
  onSelect: (goalId: string) => void;
  disabled?: boolean;
  selectedGoal?: string;
  className?: string;
}

export function PrimaryGoalCards({ onSelect, disabled, selectedGoal, className }: PrimaryGoalCardsProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      {GOALS.map((goal) => (
        <button
          key={goal.id}
          type="button"
          onClick={() => onSelect(goal.id)}
          disabled={disabled}
          className={cn(
            'p-4 rounded-lg border text-left transition-all',
            'hover:shadow-md hover:border-slate-400',
            selectedGoal === goal.id
              ? 'border-slate-900 bg-slate-50 shadow-sm'
              : 'border-slate-200 bg-white',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5', goal.color)}>{goal.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">{goal.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{goal.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
