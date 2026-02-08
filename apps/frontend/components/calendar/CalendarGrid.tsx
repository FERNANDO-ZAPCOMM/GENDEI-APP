'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, addDays, addMinutes, getDay, parseISO, isAfter } from 'date-fns';
import { isTodayInTimezone, nowInTimezone, formatDateInTimezone, formatWeekdayInTimezone, formatDayMonthInTimezone } from '@/lib/timezone';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Clock, User, X, Plus, Phone, FileText, MoreHorizontal, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Appointment, AppointmentStatus } from '@/lib/clinic-types';
import { getPendingPaymentHoldInfo, isPendingPaymentAppointment } from '@/lib/appointment-status';

interface TimeBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  professionalId?: string;
  professionalName?: string;
}

interface CalendarGridProps {
  selectedDate: Date;
  viewMode: 'day' | 'week';
  appointments: Appointment[];
  timeBlocks: TimeBlock[];
  professionals: { id: string; name: string }[];
  selectedProfessional: string;
  clinicTimezone?: string;
  startHour?: number;
  endHour?: number;
  businessStartHour?: number;
  businessEndHour?: number;
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
  onBlockTime?: (block: Omit<TimeBlock, 'id'>) => void;
  onRemoveBlock?: (blockId: string) => void;
}

const HOUR_HEIGHT = 64; // pixels per hour (business hours)
const OFF_HOUR_HEIGHT = 40; // pixels per hour (off hours)
const SLOT_DURATION = 30; // minutes per slot

const statusConfig: Record<AppointmentStatus, {
  bg: string;
  border: string;
  text: string;
  dot: string;
  label: string;
}> = {
  pending: {
    bg: 'bg-amber-50',
    border: 'border-l-4 border-l-amber-400 border-amber-200',
    text: 'text-amber-900',
    dot: 'bg-amber-400',
    label: 'Pendente'
  },
  confirmed: {
    bg: 'bg-blue-50',
    border: 'border-l-4 border-l-blue-500 border-blue-200',
    text: 'text-blue-900',
    dot: 'bg-blue-500',
    label: 'Confirmado'
  },
  awaiting_confirmation: {
    bg: 'bg-orange-50',
    border: 'border-l-4 border-l-orange-400 border-orange-200',
    text: 'text-orange-900',
    dot: 'bg-orange-400',
    label: 'Aguardando'
  },
  confirmed_presence: {
    bg: 'bg-emerald-50',
    border: 'border-l-4 border-l-emerald-500 border-emerald-200',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    label: 'Presenca Confirmada'
  },
  completed: {
    bg: 'bg-green-50',
    border: 'border-l-4 border-l-green-500 border-green-200',
    text: 'text-green-900',
    dot: 'bg-green-500',
    label: 'Concluido'
  },
  cancelled: {
    bg: 'bg-gray-50 opacity-60',
    border: 'border-l-4 border-l-gray-400 border-gray-200',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    label: 'Cancelado'
  },
  no_show: {
    bg: 'bg-red-50 opacity-60',
    border: 'border-l-4 border-l-red-400 border-red-200',
    text: 'text-red-800',
    dot: 'bg-red-400',
    label: 'Nao Compareceu'
  },
};

function getCalendarStatusConfig(appointment: Appointment) {
  if (!isPendingPaymentAppointment(appointment)) {
    return statusConfig[appointment.status] || statusConfig.pending;
  }

  const hold = getPendingPaymentHoldInfo(appointment);
  if (hold?.isExpired) {
    return {
      bg: 'bg-red-50',
      border: 'border-l-4 border-l-red-500 border-red-200',
      text: 'text-red-900',
      dot: 'bg-red-500',
      label: 'Expirado',
    };
  }

  return {
    bg: 'bg-amber-50',
    border: 'border-l-4 border-l-amber-500 border-amber-200',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    label: 'Pendente Pagamento',
  };
}

export function CalendarGrid({
  selectedDate,
  viewMode,
  appointments,
  timeBlocks,
  professionals,
  selectedProfessional,
  clinicTimezone,
  startHour = 0,
  endHour = 24,
  businessStartHour = 7,
  businessEndHour = 20,
  onAppointmentClick,
  onTimeSlotClick,
  onBlockTime,
  onRemoveBlock,
}: CalendarGridProps) {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [blockForm, setBlockForm] = useState({
    endTime: '',
    reason: '',
    professionalId: 'all',
    repeatPattern: 'none' as 'none' | 'weekdays' | 'daily' | 'custom',
    repeatDays: [1, 2, 3, 4, 5] as number[], // 0=Sunday, 1=Monday, etc.
    repeatUntil: '',
  });
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Off-hours helpers
  const isOffHour = (hour: number) => hour < businessStartHour || hour >= businessEndHour;
  const getHourHeight = (hour: number) => isOffHour(hour) ? OFF_HOUR_HEIGHT : HOUR_HEIGHT;
  const getPositionForTime = (hours: number, minutes: number) => {
    let pos = 0;
    for (let h = startHour; h < hours; h++) {
      pos += getHourHeight(h);
    }
    pos += (minutes / 60) * getHourHeight(hours);
    return pos;
  };

  // Generate time slots for the day
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += SLOT_DURATION) {
        slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, [startHour, endHour]);

  // Generate days for week view - always start from Monday
  // Uses UTC arithmetic to avoid browser-timezone day-boundary issues
  const weekDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    }
    const utcDay = selectedDate.getUTCDay(); // 0=Sun … 6=Sat
    const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
    const mondayMs = selectedDate.getTime() + mondayOffset * 86400000;
    return Array.from({ length: 7 }, (_, i) => new Date(mondayMs + i * 86400000));
  }, [selectedDate, viewMode]);

  // Calculate position and height for an appointment
  const getAppointmentStyle = (apt: Appointment) => {
    const [hours, minutes] = apt.time.split(':').map(Number);
    const top = getPositionForTime(hours, minutes);
    const endTotal = hours * 60 + minutes + apt.duration;
    const height = getPositionForTime(Math.floor(endTotal / 60), endTotal % 60) - top;
    return { top, height: Math.max(height, 36) };
  };

  // Calculate position for a time block
  const getBlockStyle = (block: TimeBlock) => {
    const [startHours, startMinutes] = block.startTime.split(':').map(Number);
    const [endHours, endMinutes] = block.endTime.split(':').map(Number);
    const top = getPositionForTime(startHours, startMinutes);
    const height = getPositionForTime(endHours, endMinutes) - top;
    return { top, height: Math.max(height, 36) };
  };

  // Handle slot click for blocking
  const handleSlotClick = (date: Date, time: string) => {
    const dateStr = formatDateInTimezone(date, clinicTimezone);

    // Check if there's already an appointment or block at this time
    const hasAppointment = appointments.some(
      apt => apt.date === dateStr && apt.time === time
    );
    const hasBlock = timeBlocks.some(
      block => block.date === dateStr && block.startTime <= time && block.endTime > time
    );

    if (hasAppointment || hasBlock) return;

    setSelectedSlot({ date: dateStr, time });

    // Calculate default end time (1 hour later)
    const [hours, minutes] = time.split(':').map(Number);
    const endDate = addMinutes(new Date(2000, 0, 1, hours, minutes), 60);
    // Default repeat until: 4 weeks from selected date
    const defaultRepeatUntil = formatDateInTimezone(new Date(date.getTime() + 28 * 86400000), clinicTimezone);
    setBlockForm({
      endTime: format(endDate, 'HH:mm'),
      reason: '',
      professionalId: selectedProfessional !== 'all' ? selectedProfessional : 'all',
      repeatPattern: 'none',
      repeatDays: [1, 2, 3, 4, 5], // Weekdays by default
      repeatUntil: defaultRepeatUntil,
    });

    setBlockDialogOpen(true);
  };

  // Handle block creation
  const handleCreateBlock = () => {
    if (!selectedSlot || !onBlockTime) return;

    const baseBlock = {
      startTime: selectedSlot.time,
      endTime: blockForm.endTime,
      reason: blockForm.reason || 'Bloqueado',
      professionalId: blockForm.professionalId !== 'all' ? blockForm.professionalId : undefined,
      professionalName: blockForm.professionalId !== 'all'
        ? professionals.find(p => p.id === blockForm.professionalId)?.name
        : undefined,
    };

    // If no repeat, create single block
    if (blockForm.repeatPattern === 'none') {
      onBlockTime({
        ...baseBlock,
        date: selectedSlot.date,
      });
    } else {
      // Create blocks for each day in the pattern
      const startDate = parseISO(selectedSlot.date);
      const endDate = parseISO(blockForm.repeatUntil);
      let currentDate = startDate;

      const daysToInclude = blockForm.repeatPattern === 'weekdays'
        ? [1, 2, 3, 4, 5] // Monday to Friday
        : blockForm.repeatPattern === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6] // All days
        : blockForm.repeatDays; // Custom selection

      while (!isAfter(currentDate, endDate)) {
        const dayOfWeek = getDay(currentDate);
        if (daysToInclude.includes(dayOfWeek)) {
          onBlockTime({
            ...baseBlock,
            date: format(currentDate, 'yyyy-MM-dd'),
          });
        }
        currentDate = addDays(currentDate, 1);
      }
    }

    setBlockDialogOpen(false);
    setSelectedSlot(null);
  };

  // Filter appointments and blocks for a specific day
  const getItemsForDay = (date: Date) => {
    const dateStr = formatDateInTimezone(date, clinicTimezone);

    const dayAppointments = appointments.filter(apt => {
      if (apt.date !== dateStr) return false;
      if (selectedProfessional !== 'all' && apt.professionalId !== selectedProfessional) return false;
      return true;
    });

    const dayBlocks = timeBlocks.filter(block => {
      if (block.date !== dateStr) return false;
      if (selectedProfessional !== 'all' && block.professionalId && block.professionalId !== selectedProfessional) return false;
      return true;
    });

    return { appointments: dayAppointments, blocks: dayBlocks };
  };

  // Generate end time options
  const endTimeOptions = useMemo(() => {
    if (!selectedSlot) return [];
    const [hours, minutes] = selectedSlot.time.split(':').map(Number);
    const options: string[] = [];

    for (let h = hours; h <= endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === hours && m <= minutes) continue;
        if (h === endHour && m > 0) continue;
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return options;
  }, [selectedSlot, endHour]);

  const isToday = (date: Date) => isTodayInTimezone(date, clinicTimezone);

  // Update current time indicator every minute
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentTimePosition = useMemo(() => {
    const { hours, minutes } = nowInTimezone(clinicTimezone);
    if (hours < startHour || hours >= endHour) return null;
    return getPositionForTime(hours, minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startHour, endHour, businessStartHour, businessEndHour, clinicTimezone, tick]);

  const columnWidth = viewMode === 'day' ? 'min-w-full' : 'min-w-[70px]';

  return (
    <TooltipProvider>
      <>
        <div className="flex flex-col bg-white border shadow-sm overflow-hidden h-full">
          {/* Header with days */}
          <div className="flex border-b bg-gray-50/80 sticky top-0 z-20">
            {/* Time column header */}
            <div className="w-20 flex-shrink-0 border-r bg-gray-50/80 p-3 flex items-center justify-center">
              <Clock className="w-4 h-4 text-gray-400" />
            </div>

            {/* Day headers - compact format */}
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  `flex-1 ${columnWidth} py-2 px-1 text-center border-r last:border-r-0 transition-colors`,
                  isToday(day) ? 'bg-black text-white' : 'bg-gray-50/80'
                )}
              >
                <p className={cn(
                  'text-[10px] font-medium uppercase tracking-wide',
                  isToday(day) ? 'text-gray-300' : 'text-gray-500'
                )}>
                  {formatWeekdayInTimezone(day, clinicTimezone)}
                </p>
                <p className={cn(
                  'text-sm font-semibold',
                  isToday(day) ? 'text-white' : 'text-gray-900'
                )}>
                  {formatDayMonthInTimezone(day, clinicTimezone)}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="flex overflow-auto flex-1">
            {/* Time labels column */}
            <div className="w-20 flex-shrink-0 border-r bg-gray-50/50">
              {Array.from({ length: endHour - startHour }, (_, i) => {
                const hour = startHour + i;
                const offHour = isOffHour(hour);
                const height = getHourHeight(hour);
                return (
                  <div
                    key={i}
                    className={cn("relative border-b border-gray-100", offHour && "bg-gray-50/80")}
                    style={{ height }}
                  >
                    <span className={cn(
                      "absolute right-3 px-1",
                      offHour
                        ? "-top-2 text-[10px] font-medium text-gray-300 bg-gray-50/80"
                        : "-top-2.5 text-xs font-medium text-gray-400 bg-gray-50/50"
                    )}>
                      {`${hour.toString().padStart(2, '0')}:00`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Days columns */}
            {weekDays.map((day) => {
              const { appointments: dayAppts, blocks: dayBlocks } = getItemsForDay(day);
              const showCurrentTime = isToday(day) && currentTimePosition !== null;
              const dateStr = formatDateInTimezone(day, clinicTimezone);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    `flex-1 ${columnWidth} relative border-r last:border-r-0`,
                    isToday(day) && 'bg-blue-50/20'
                  )}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: endHour - startHour }, (_, i) => {
                    const height = getHourHeight(startHour + i);
                    return (
                      <div
                        key={i}
                        className="border-b border-gray-100"
                        style={{ height }}
                      >
                        <div
                          className="border-b border-dashed border-gray-100"
                          style={{ height: height / 2 }}
                        />
                      </div>
                    );
                  })}

                  {/* Current time indicator */}
                  {showCurrentTime && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: currentTimePosition }}
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-sm" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  )}

                  {/* Click areas for time slots */}
                  {timeSlots.map((time) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const top = getPositionForTime(hours, minutes);
                    const slotHeight = getHourHeight(hours) / 2;
                    const slotKey = `${dateStr}-${time}`;
                    const isHovered = hoveredSlot === slotKey;
                    const offHour = isOffHour(hours);

                    // Check if slot is occupied
                    const hasAppointment = dayAppts.some(apt => apt.time === time);
                    const hasBlock = dayBlocks.some(
                      block => block.startTime <= time && block.endTime > time
                    );
                    const isOccupied = hasAppointment || hasBlock;

                    return (
                      <div
                        key={time}
                        className={cn(
                          'absolute left-0 right-0 transition-all duration-150',
                          !isOccupied && !offHour && 'cursor-pointer hover:bg-blue-50/70',
                          isHovered && !isOccupied && !offHour && 'bg-blue-50/70'
                        )}
                        style={{ top, height: slotHeight }}
                        onClick={() => !isOccupied && handleSlotClick(day, time)}
                        onMouseEnter={() => !offHour && setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        {isHovered && !isOccupied && !offHour && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center gap-1.5 text-blue-500 text-xs font-medium bg-white/90 px-2 py-1 rounded-full shadow-sm border border-blue-100">
                              <Plus className="w-3 h-3" />
                              <span>Bloquear</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Time blocks */}
                  {dayBlocks.map((block) => {
                    const style = getBlockStyle(block);
                    return (
                      <div
                        key={block.id}
                        className="absolute left-1 right-1 bg-gray-100/90 border border-gray-200 rounded-lg overflow-hidden z-10 group backdrop-blur-sm"
                        style={{ top: style.top, height: style.height }}
                      >
                        <div className="p-2 h-full flex flex-col">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-gray-700 block truncate">
                                {block.reason || 'Bloqueado'}
                              </span>
                              <span className="text-xs text-gray-500 block">
                                {block.startTime} - {block.endTime}
                              </span>
                            </div>
                            {onRemoveBlock && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveBlock(block.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                              >
                                <X className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            )}
                          </div>
                          {block.professionalName && style.height > 50 && (
                            <span className="text-xs text-gray-500 truncate mt-auto">
                              {block.professionalName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Appointments */}
                  {dayAppts.map((apt) => {
                    const style = getAppointmentStyle(apt);
                    const config = getCalendarStatusConfig(apt);

                    return (
                      <Tooltip key={apt.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute left-1.5 right-1.5 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:z-20 z-10 group',
                              config.bg,
                              config.border
                            )}
                            style={{ top: style.top, height: style.height }}
                            onClick={() => onAppointmentClick?.(apt)}
                          >
                            <div className="p-2 h-full flex flex-col relative">
                              {/* Quick action menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => onAppointmentClick?.(apt)}>
                                    Ver detalhes
                                  </DropdownMenuItem>
                                  {apt.patientPhone && (
                                    <DropdownMenuItem>
                                      <Phone className="w-3.5 h-3.5 mr-2" />
                                      Ligar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* Status indicator dot */}
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <div className={cn('w-2 h-2 rounded-full', config.dot)} />
                                <span className={cn('text-[10px] font-medium uppercase tracking-wide', config.text)}>
                                  {config.label}
                                </span>
                              </div>

                              {/* Patient name */}
                              <span className={cn('text-sm font-semibold truncate leading-tight', config.text)}>
                                {apt.patientName}
                              </span>

                              {/* Details - only show if enough space */}
                              {style.height > 50 && (
                                <div className="mt-auto space-y-0.5">
                                  <div className={cn('flex items-center gap-1 text-xs', config.text, 'opacity-80')}>
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    <span>{apt.time}</span>
                                    <span className="text-gray-400">({apt.duration}min)</span>
                                  </div>
                                  <div className={cn('flex items-center gap-1 text-xs truncate', config.text, 'opacity-80')}>
                                    <User className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{apt.professionalName}</span>
                                  </div>
                                </div>
                              )}

                              {/* Service name - only if very tall */}
                              {style.height > 80 && apt.serviceName && (
                                <div className={cn('flex items-center gap-1 text-xs truncate mt-1', config.text, 'opacity-70')}>
                                  <FileText className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{apt.serviceName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{apt.patientName}</p>
                            <p className="text-xs text-gray-500">{apt.time} - {apt.duration}min</p>
                            <p className="text-xs text-gray-500">{apt.professionalName}</p>
                            {apt.serviceName && <p className="text-xs text-gray-500">{apt.serviceName}</p>}
                            {apt.patientPhone && <p className="text-xs text-gray-500">{apt.patientPhone}</p>}
                            {isPendingPaymentAppointment(apt) && (
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  const hold = getPendingPaymentHoldInfo(apt);
                                  if (!hold) return 'Aguardando pagamento';
                                  if (hold.isExpired) return 'Reserva expirada';
                                  if (hold.minutesLeft !== null) return `Expira em ${hold.minutesLeft} min`;
                                  return 'Aguardando pagamento';
                                })()}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend - only show main statuses */}
          <div className="flex items-center gap-4 px-4 py-3 border-t bg-gray-50/50 overflow-x-auto">
            <span className="text-xs text-gray-500 font-medium flex-shrink-0">Status:</span>
            {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((key) => (
              <div key={key} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={cn('w-2.5 h-2.5 rounded-full', statusConfig[key].dot)} />
                <span className="text-xs text-gray-600">{statusConfig[key].label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-600">Expirado</span>
            </div>
          </div>
        </div>

        {/* Block Time Dialog */}
        <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Bloquear Horario</DialogTitle>
              <DialogDescription>
                Bloqueie este horario para impedir novos agendamentos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedSlot && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {format(new Date(selectedSlot.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500">Inicio</Label>
                  <Input
                    value={selectedSlot?.time || ''}
                    disabled
                    className="bg-gray-50 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500">Fim</Label>
                  <Select value={blockForm.endTime} onValueChange={(v) => setBlockForm({ ...blockForm, endTime: v })}>
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {endTimeOptions.map((time) => (
                        <SelectItem key={time} value={time} className="font-mono">{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500">Motivo (opcional)</Label>
                <Input
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Ex: Almoco, Reuniao, Ferias..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500">Profissional</Label>
                <Select
                  value={blockForm.professionalId}
                  onValueChange={(v) => setBlockForm({ ...blockForm, professionalId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os profissionais</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Repeat Options */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" />
                  Repetir
                </Label>
                <Select
                  value={blockForm.repeatPattern}
                  onValueChange={(v: 'none' | 'weekdays' | 'daily' | 'custom') => setBlockForm({ ...blockForm, repeatPattern: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não repetir</SelectItem>
                    <SelectItem value="weekdays">Dias úteis (Seg-Sex)</SelectItem>
                    <SelectItem value="daily">Todos os dias</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom days selection */}
              {blockForm.repeatPattern === 'custom' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500">Dias da semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 0, label: 'Dom' },
                      { value: 1, label: 'Seg' },
                      { value: 2, label: 'Ter' },
                      { value: 3, label: 'Qua' },
                      { value: 4, label: 'Qui' },
                      { value: 5, label: 'Sex' },
                      { value: 6, label: 'Sáb' },
                    ].map((day) => (
                      <label
                        key={day.value}
                        className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-full text-xs font-medium cursor-pointer transition-colors',
                          blockForm.repeatDays.includes(day.value)
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={blockForm.repeatDays.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBlockForm({
                                ...blockForm,
                                repeatDays: [...blockForm.repeatDays, day.value].sort(),
                              });
                            } else {
                              setBlockForm({
                                ...blockForm,
                                repeatDays: blockForm.repeatDays.filter((d) => d !== day.value),
                              });
                            }
                          }}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* End date for repeat */}
              {blockForm.repeatPattern !== 'none' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500">Repetir até</Label>
                  <Input
                    type="date"
                    value={blockForm.repeatUntil}
                    min={selectedSlot?.date}
                    onChange={(e) => setBlockForm({ ...blockForm, repeatUntil: e.target.value })}
                    className="font-mono"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBlock}
                disabled={!blockForm.endTime || (blockForm.repeatPattern === 'custom' && blockForm.repeatDays.length === 0)}
              >
                {blockForm.repeatPattern !== 'none' ? 'Bloquear Série' : 'Bloquear Horário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}

// Add missing import
import { Calendar as CalendarIcon } from 'lucide-react';
