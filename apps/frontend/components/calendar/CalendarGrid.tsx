'use client';

import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Clock, User, X, Plus } from 'lucide-react';
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

const HOUR_HEIGHT = 60; // pixels per hour
const SLOT_DURATION = 30; // minutes per slot

const statusColors: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
  awaiting_confirmation: 'bg-orange-100 border-orange-300 text-orange-800',
  confirmed_presence: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  completed: 'bg-green-100 border-green-300 text-green-800',
  cancelled: 'bg-red-100 border-red-300 text-red-800 opacity-50',
  no_show: 'bg-gray-100 border-gray-300 text-gray-800 opacity-50',
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

  // Generate days for week view
  const weekDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    }
    const start = startOfWeek(selectedDate, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate, viewMode]);

  // Calculate position and height for an appointment
  const getAppointmentStyle = (apt: Appointment) => {
    const [hours, minutes] = apt.time.split(':').map(Number);
    const top = (hours - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    const height = (apt.duration / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(height, 30) };
  };

  // Calculate position for a time block
  const getBlockStyle = (block: TimeBlock) => {
    const [startHours, startMinutes] = block.startTime.split(':').map(Number);
    const [endHours, endMinutes] = block.endTime.split(':').map(Number);
    const top = (startHours - startHour) * HOUR_HEIGHT + (startMinutes / 60) * HOUR_HEIGHT;
    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    const height = (duration / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(height, 30) };
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

  return (
    <>
      <div className="flex flex-col border rounded-lg bg-white overflow-hidden">
        {/* Header with days */}
        <div className="flex border-b bg-gray-50">
          {/* Time column header */}
          <div className="w-16 flex-shrink-0 border-r p-2">
            <Clock className="w-4 h-4 mx-auto text-muted-foreground" />
          </div>

          {/* Day headers */}
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 p-2 text-center border-r last:border-r-0 min-w-[120px]',
                isToday(day) && 'bg-emerald-50'
              )}
            >
              <p className="text-xs text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <p className={cn(
                'text-lg font-semibold',
                isToday(day) && 'text-emerald-600'
              )}>
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex overflow-auto max-h-[600px]">
          {/* Time labels column */}
          <div className="w-16 flex-shrink-0 border-r bg-gray-50">
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <div
                key={i}
                className="border-b text-xs text-muted-foreground text-right pr-2"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2">
                  {`${(startHour + i).toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Days columns */}
          {weekDays.map((day) => {
            const { appointments: dayAppts, blocks: dayBlocks } = getItemsForDay(day);
            const showCurrentTime = isToday(day) && currentTimePosition !== null;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex-1 relative border-r last:border-r-0 min-w-[120px]',
                  isToday(day) && 'bg-emerald-50/30'
                )}
              >
                {/* Hour grid lines */}
                {Array.from({ length: endHour - startHour }, (_, i) => (
                  <div
                    key={i}
                    className="border-b border-dashed border-gray-200"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {/* Half hour line */}
                    <div
                      className="border-b border-dotted border-gray-100"
                      style={{ height: HOUR_HEIGHT / 2 }}
                    />
                  </div>
                ))}

                {/* Current time indicator */}
                {showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                    style={{ top: currentTimePosition }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                  </div>
                )}

                {/* Click areas for time slots */}
                {timeSlots.map((time) => {
                  const [hours, minutes] = time.split(':').map(Number);
                  const top = (hours - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={time}
                      className="absolute left-0 right-0 cursor-pointer hover:bg-blue-50/50 transition-colors group"
                      style={{ top, height: HOUR_HEIGHT / 2 }}
                      onClick={() => handleSlotClick(day, time)}
                    >
                      <div className="hidden group-hover:flex items-center justify-center h-full">
                        <Plus className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>
                  );
                })}

                {/* Time blocks */}
                {dayBlocks.map((block) => {
                  const style = getBlockStyle(block);
                  return (
                    <div
                      key={block.id}
                      className="absolute left-1 right-1 bg-gray-200 border border-gray-300 rounded-md overflow-hidden z-10 group"
                      style={{ top: style.top, height: style.height }}
                    >
                      <div className="p-1 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {block.reason || 'Bloqueado'}
                          </span>
                          {onRemoveBlock && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveBlock(block.id);
                              }}
                              className="hidden group-hover:block p-0.5 hover:bg-gray-300 rounded"
                            >
                              <X className="w-3 h-3 text-gray-600" />
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {block.startTime} - {block.endTime}
                        </span>
                        {block.professionalName && (
                          <span className="text-xs text-gray-500 truncate">
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
                  const statusColor = statusColors[apt.status] || statusColors.pending;

                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        'absolute left-1 right-1 border rounded-md overflow-hidden cursor-pointer transition-shadow hover:shadow-md z-10',
                        statusColor
                      )}
                      style={{ top: style.top, height: style.height }}
                      onClick={() => onAppointmentClick?.(apt)}
                    >
                      <div className="p-1 h-full flex flex-col">
                        <span className="text-xs font-semibold truncate">
                          {apt.patientName}
                        </span>
                        {style.height > 40 && (
                          <>
                            <span className="text-xs truncate flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {apt.time} ({apt.duration}min)
                            </span>
                            <span className="text-xs truncate flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {apt.professionalName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Block Time Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Horario</DialogTitle>
            <DialogDescription>
              Bloqueie este horario para impedir agendamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input value={selectedSlot?.time || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Select value={blockForm.endTime} onValueChange={(v) => setBlockForm({ ...blockForm, endTime: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {endTimeOptions.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                placeholder="Ex: Almoco, Reuniao, Ferias..."
              />
            </div>

            <div className="space-y-2">
              <Label>Profissional</Label>
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
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
