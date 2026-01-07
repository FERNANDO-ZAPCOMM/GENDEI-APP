'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  List,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useAppointments } from '@/hooks/use-appointments';
import { useProfessionals } from '@/hooks/use-professionals';
import { useTimeBlocks, CreateTimeBlockInput } from '@/hooks/use-time-blocks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import type { Appointment, AppointmentStatus } from '@/lib/clinic-types';

const statusConfig: Record<AppointmentStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  awaiting_confirmation: { label: 'Aguardando', color: 'bg-orange-100 text-orange-700', icon: Clock },
  confirmed_presence: { label: 'Presenca Confirmada', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  completed: { label: 'Concluido', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
  no_show: { label: 'Nao Compareceu', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export default function AppointmentsPage() {
  const t = useTranslations();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: professionals = [] } = useProfessionals(clinic?.id || '');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(selectedDate, { locale: ptBR }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(selectedDate, { locale: ptBR }), 'yyyy-MM-dd');

  const { data: appointments = [], isLoading, updateStatus, cancel } = useAppointments(
    clinic?.id || '',
    viewMode === 'day'
      ? { date: dateStr, professionalId: selectedProfessional !== 'all' ? selectedProfessional : undefined }
      : { startDate: weekStart, endDate: weekEnd, professionalId: selectedProfessional !== 'all' ? selectedProfessional : undefined }
  );

  const { timeBlocks, createBlock, deleteBlock } = useTimeBlocks(
    clinic?.id || '',
    viewMode === 'day'
      ? { startDate: dateStr, endDate: dateStr }
      : { startDate: weekStart, endDate: weekEnd }
  );

  const stats = useMemo(() => {
    const todayAppts = appointments.filter(a => a.date === format(new Date(), 'yyyy-MM-dd'));
    return {
      today: todayAppts.length,
      confirmed: todayAppts.filter(a => a.status === 'confirmed' || a.status === 'confirmed_presence').length,
      pending: todayAppts.filter(a => a.status === 'pending' || a.status === 'awaiting_confirmation').length,
    };
  }, [appointments]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, [appointments]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    sortedAppointments.forEach(apt => {
      if (!groups[apt.date]) groups[apt.date] = [];
      groups[apt.date].push(apt);
    });
    return groups;
  }, [sortedAppointments]);

  const handlePrevDay = () => {
    setSelectedDate(prev => addDays(prev, viewMode === 'week' ? -7 : -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, viewMode === 'week' ? 7 : 1));
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      await updateStatus.mutateAsync({ id: appointmentId, status: newStatus });
      toast.success('Status atualizado!');
      setDetailsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar status');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta consulta?')) return;

    try {
      await cancel.mutateAsync({ id: appointmentId });
      toast.success('Consulta cancelada!');
      setDetailsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar consulta');
    }
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDetailsDialogOpen(true);
  };

  const handleBlockTime = async (block: CreateTimeBlockInput) => {
    try {
      await createBlock.mutateAsync(block);
      toast.success('Horario bloqueado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao bloquear horario');
    }
  };

  const handleRemoveBlock = async (blockId: string) => {
    try {
      await deleteBlock.mutateAsync(blockId);
      toast.success('Bloqueio removido!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover bloqueio');
    }
  };

  if (clinicLoading || !clinic) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Gerencie as consultas agendadas
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={displayMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDisplayMode('calendar')}
          >
            <LayoutGrid className="w-4 h-4 mr-1" />
            Calendario
          </Button>
          <Button
            variant={displayMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDisplayMode('list')}
          >
            <List className="w-4 h-4 mr-1" />
            Lista
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">Hoje</p>
              <p className="text-2xl font-bold text-blue-700">{stats.today}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-emerald-600 font-medium">Confirmados</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.confirmed}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-100">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-yellow-600 font-medium">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevDay}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="font-semibold text-lg">
                  {viewMode === 'day'
                    ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
                    : `${format(startOfWeek(selectedDate, { locale: ptBR }), 'd MMM', { locale: ptBR })} - ${format(endOfWeek(selectedDate, { locale: ptBR }), 'd MMM', { locale: ptBR })}`
                  }
                </p>
                {isToday(selectedDate) && viewMode === 'day' && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Hoje</Badge>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={handleNextDay}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isToday(selectedDate) && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                  Hoje
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week')}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar or List View */}
      {displayMode === 'calendar' ? (
        <CalendarGrid
          selectedDate={selectedDate}
          viewMode={viewMode}
          appointments={appointments}
          timeBlocks={timeBlocks}
          professionals={professionals}
          selectedProfessional={selectedProfessional}
          onAppointmentClick={handleAppointmentClick}
          onBlockTime={handleBlockTime}
          onRemoveBlock={handleRemoveBlock}
        />
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Consultas
            </CardTitle>
            <CardDescription>
              {appointments.length === 0
                ? 'Nenhuma consulta agendada'
                : `${appointments.length} consulta(s) encontrada(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma consulta para este periodo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedByDate).map(([date, dayAppointments]) => (
                  <div key={date}>
                    {viewMode === 'week' && (
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-sm font-semibold text-gray-700">
                          {format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                        {isSameDay(parseISO(date), new Date()) && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Hoje</Badge>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {dayAppointments.map((appointment) => {
                        const status = statusConfig[appointment.status] || statusConfig.pending;
                        const StatusIcon = status.icon;

                        return (
                          <div
                            key={appointment.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-white hover:shadow-sm transition-shadow cursor-pointer"
                            onClick={() => handleAppointmentClick(appointment)}
                          >
                            <div className="flex items-center gap-4">
                              {/* Time */}
                              <div className="text-center min-w-[60px]">
                                <p className="text-lg font-bold text-gray-900">{appointment.time}</p>
                                <p className="text-xs text-muted-foreground">{appointment.duration}min</p>
                              </div>

                              {/* Patient & Service */}
                              <div>
                                <p className="font-medium text-gray-900">{appointment.patientName}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="w-3 h-3" />
                                  {appointment.professionalName}
                                  {appointment.serviceName && (
                                    <>
                                      <span>-</span>
                                      <span>{appointment.serviceName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Status Badge */}
                              <Badge className={`${status.color} border-0 flex items-center gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appointment Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Consulta</DialogTitle>
            <DialogDescription>
              Visualize e gerencie esta consulta
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Paciente</p>
                  <p className="font-medium">{selectedAppointment.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedAppointment.patientPhone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                  <p className="font-medium">{selectedAppointment.professionalName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Servico</p>
                  <p className="font-medium">{selectedAppointment.serviceName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(parseISO(selectedAppointment.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Horario</p>
                  <p className="font-medium">{selectedAppointment.time} ({selectedAppointment.duration}min)</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <Badge className={`${statusConfig[selectedAppointment.status]?.color || statusConfig.pending.color} border-0`}>
                  {statusConfig[selectedAppointment.status]?.label || 'Pendente'}
                </Badge>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observacoes</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedAppointment && selectedAppointment.status === 'pending' && (
              <Button onClick={() => handleStatusChange(selectedAppointment.id, 'confirmed')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            )}
            {selectedAppointment && (selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'confirmed_presence') && (
              <Button onClick={() => handleStatusChange(selectedAppointment.id, 'completed')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Marcar Concluido
              </Button>
            )}
            {selectedAppointment && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
              <>
                <Button variant="outline" onClick={() => handleStatusChange(selectedAppointment.id, 'no_show')}>
                  Nao Compareceu
                </Button>
                <Button variant="destructive" onClick={() => handleCancel(selectedAppointment.id)}>
                  Cancelar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
