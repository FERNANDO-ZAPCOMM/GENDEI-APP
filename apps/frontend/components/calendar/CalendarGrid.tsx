'use client';

import { useMemo, useState } from 'react';
import { format, addDays, isSameDay, addMinutes, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Clock, User, X, Plus, Phone, FileText, MoreHorizontal } from 'lucide-react';
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
  startHour?: number;
  endHour?: number;
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
  onBlockTime?: (block: Omit<TimeBlock, 'id'>) => void;
  onRemoveBlock?: (blockId: string) => void;
}

const HOUR_HEIGHT = 64; // pixels per hour
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

export function CalendarGrid({
  selectedDate,
  viewMode,
  appointments,
  timeBlocks,
  professionals,
  selectedProfessional,
  startHour = 7,
  endHour = 20,
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
  });
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

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
  const weekDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    }
    // Get Monday of the week containing selectedDate
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selectedDate, viewMode]);

  // Calculate position and height for an appointment
  const getAppointmentStyle = (apt: Appointment) => {
    const [hours, minutes] = apt.time.split(':').map(Number);
    const top = (hours - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    const height = (apt.duration / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(height, 36) };
  };

  // Calculate position for a time block
  const getBlockStyle = (block: TimeBlock) => {
    const [startHours, startMinutes] = block.startTime.split(':').map(Number);
    const [endHours, endMinutes] = block.endTime.split(':').map(Number);
    const top = (startHours - startHour) * HOUR_HEIGHT + (startMinutes / 60) * HOUR_HEIGHT;
    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    const height = (duration / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(height, 36) };
  };

  // Handle slot click for blocking
  const handleSlotClick = (date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');

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
    setBlockForm({
      endTime: format(endDate, 'HH:mm'),
      reason: '',
      professionalId: selectedProfessional !== 'all' ? selectedProfessional : 'all',
    });

    setBlockDialogOpen(true);
  };

  // Handle block creation
  const handleCreateBlock = () => {
    if (!selectedSlot || !onBlockTime) return;

    onBlockTime({
      date: selectedSlot.date,
      startTime: selectedSlot.time,
      endTime: blockForm.endTime,
      reason: blockForm.reason || 'Bloqueado',
      professionalId: blockForm.professionalId !== 'all' ? blockForm.professionalId : undefined,
      professionalName: blockForm.professionalId !== 'all'
        ? professionals.find(p => p.id === blockForm.professionalId)?.name
        : undefined,
    });

    setBlockDialogOpen(false);
    setSelectedSlot(null);
  };

  // Filter appointments and blocks for a specific day
  const getItemsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

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

  const isToday = (date: Date) => isSameDay(date, new Date());
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours < startHour || hours >= endHour) return null;
    return (hours - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  }, [startHour, endHour]);

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
                  {format(day, 'EEE', { locale: ptBR })}
                </p>
                <p className={cn(
                  'text-sm font-semibold',
                  isToday(day) ? 'text-white' : 'text-gray-900'
                )}>
                  {format(day, 'dd/MM')}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="flex overflow-auto flex-1">
            {/* Time labels column */}
            <div className="w-20 flex-shrink-0 border-r bg-gray-50/50">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <div
                  key={i}
                  className="relative border-b border-gray-100"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2.5 right-3 text-xs font-medium text-gray-400 bg-gray-50/50 px-1">
                    {`${(startHour + i).toString().padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>

            {/* Days columns */}
            {weekDays.map((day) => {
              const { appointments: dayAppts, blocks: dayBlocks } = getItemsForDay(day);
              const showCurrentTime = isToday(day) && currentTimePosition !== null;
              const dateStr = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    `flex-1 ${columnWidth} relative border-r last:border-r-0`,
                    isToday(day) && 'bg-blue-50/20'
                  )}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: endHour - startHour }, (_, i) => (
                    <div
                      key={i}
                      className="border-b border-gray-100"
                      style={{ height: HOUR_HEIGHT }}
                    >
                      {/* Half hour line */}
                      <div
                        className="border-b border-dashed border-gray-100"
                        style={{ height: HOUR_HEIGHT / 2 }}
                      />
                    </div>
                  ))}

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
                    const top = (hours - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
                    const slotKey = `${dateStr}-${time}`;
                    const isHovered = hoveredSlot === slotKey;

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
                          !isOccupied && 'cursor-pointer hover:bg-blue-50/70',
                          isHovered && !isOccupied && 'bg-blue-50/70'
                        )}
                        style={{ top, height: HOUR_HEIGHT / 2 }}
                        onClick={() => !isOccupied && handleSlotClick(day, time)}
                        onMouseEnter={() => setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        {isHovered && !isOccupied && (
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
                    const config = statusConfig[apt.status] || statusConfig.pending;

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
          </div>
        </div>

        {/* Block Time Dialog */}
        <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
          <DialogContent className="sm:max-w-md">
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBlock} disabled={!blockForm.endTime}>
                Bloquear Horario
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
