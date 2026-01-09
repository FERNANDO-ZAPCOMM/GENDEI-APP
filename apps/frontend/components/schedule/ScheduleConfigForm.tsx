'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkingHours, DaySchedule } from '@/lib/clinic-types';

interface ScheduleConfigFormProps {
  initialSchedule?: WorkingHours;
  onChange: (schedule: WorkingHours) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
] as const;

type DayKey = typeof DAYS_OF_WEEK[number]['key'];

const DEFAULT_SCHEDULE: DaySchedule = {
  start: '08:00',
  end: '18:00',
};

export function ScheduleConfigForm({
  initialSchedule,
  onChange,
  disabled = false,
}: ScheduleConfigFormProps) {
  const [schedule, setSchedule] = useState<WorkingHours>(initialSchedule || {});
  const [copyFromDay, setCopyFromDay] = useState<DayKey | null>(null);

  useEffect(() => {
    if (initialSchedule) {
      setSchedule(initialSchedule);
    }
  }, [initialSchedule]);

  const handleToggleDay = (day: DayKey, enabled: boolean) => {
    const newSchedule = { ...schedule };
    if (enabled) {
      newSchedule[day] = DEFAULT_SCHEDULE;
    } else {
      delete newSchedule[day];
    }
    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  const handleTimeChange = (
    day: DayKey,
    field: keyof DaySchedule,
    value: string
  ) => {
    const newSchedule = {
      ...schedule,
      [day]: {
        ...schedule[day],
        [field]: value,
      },
    };
    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  const handleCopyToAll = (sourceDay: DayKey) => {
    const sourceDaySchedule = schedule[sourceDay];
    if (!sourceDaySchedule) return;

    const newSchedule: WorkingHours = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      if (key !== 'saturday' && key !== 'sunday') {
        newSchedule[key] = { ...sourceDaySchedule };
      }
    });
    setSchedule(newSchedule);
    onChange(newSchedule);
    setCopyFromDay(null);
  };

  const handleCopyToWeekdays = (sourceDay: DayKey) => {
    const sourceDaySchedule = schedule[sourceDay];
    if (!sourceDaySchedule) return;

    const newSchedule: WorkingHours = { ...schedule };
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach((day) => {
      newSchedule[day as DayKey] = { ...sourceDaySchedule };
    });
    setSchedule(newSchedule);
    onChange(newSchedule);
    setCopyFromDay(null);
  };

  return (
    <div className="space-y-4">
      {DAYS_OF_WEEK.map(({ key, label, short }) => {
        const daySchedule = schedule[key];
        const isEnabled = !!daySchedule;

        return (
          <Card
            key={key}
            className={cn(
              'transition-all',
              isEnabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Day toggle */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggleDay(key, checked)}
                    disabled={disabled}
                  />
                  <Label
                    className={cn(
                      'font-medium cursor-pointer',
                      isEnabled ? 'text-gray-900' : 'text-gray-500'
                    )}
                  >
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{short}</span>
                  </Label>
                </div>

                {/* Time inputs */}
                {isEnabled ? (
                  <div className="flex flex-1 items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <Input
                        type="time"
                        value={daySchedule?.start || '08:00'}
                        onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                        className="w-[110px]"
                        disabled={disabled}
                      />
                      <span className="text-gray-500">às</span>
                      <Input
                        type="time"
                        value={daySchedule?.end || '18:00'}
                        onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                        className="w-[110px]"
                        disabled={disabled}
                      />
                    </div>

                    {/* Copy button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500 hover:text-blue-600"
                      onClick={() => setCopyFromDay(copyFromDay === key ? null : key)}
                      disabled={disabled}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </Button>

                    {/* Copy options */}
                    {copyFromDay === key && (
                      <div className="flex gap-2 ml-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleCopyToWeekdays(key)}
                          disabled={disabled}
                        >
                          Dias úteis
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleCopyToAll(key)}
                          disabled={disabled}
                        >
                          Todos
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Fechado</span>
                )}
              </div>

              {/* Break time (optional) */}
              {isEnabled && (
                <div className="mt-3 pl-[140px] hidden">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Intervalo:</span>
                    <Input
                      type="time"
                      value={daySchedule?.breakStart || ''}
                      onChange={(e) => handleTimeChange(key, 'breakStart', e.target.value)}
                      placeholder="12:00"
                      className="w-[100px] h-8 text-sm"
                      disabled={disabled}
                    />
                    <span>às</span>
                    <Input
                      type="time"
                      value={daySchedule?.breakEnd || ''}
                      onChange={(e) => handleTimeChange(key, 'breakEnd', e.target.value)}
                      placeholder="13:00"
                      className="w-[100px] h-8 text-sm"
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
