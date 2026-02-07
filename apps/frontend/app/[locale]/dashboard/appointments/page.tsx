'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { nowInTimezone, todayInTimezone, formatDateInTimezone, formatDayMonthInTimezone } from '@/lib/timezone';
import { getSpecialtyNames, getProfessionalSpecialties } from '@/lib/specialties';
import type { Appointment, AppointmentStatus } from '@/lib/clinic-types';

const getStatusConfig = (t: (key: string) => string): Record<AppointmentStatus, { label: string; color: string; icon: any }> => ({
  pending: { label: t('appointmentsPage.status.pending'), color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  confirmed: { label: t('appointmentsPage.status.confirmed'), color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  awaiting_confirmation: { label: t('appointmentsPage.status.awaiting'), color: 'bg-orange-100 text-orange-700', icon: Clock },
  confirmed_presence: { label: t('appointmentsPage.status.confirmedPresence'), color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  completed: { label: t('appointmentsPage.status.completed'), color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: t('appointmentsPage.status.cancelled'), color: 'bg-red-100 text-red-700', icon: XCircle },
  no_show: { label: t('appointmentsPage.status.noShow'), color: 'bg-gray-100 text-gray-700', icon: XCircle },
});

// Format price for display
const formatPrice = (price: number) => {
  if (!price) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

// Get initials for avatar fallback
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function AppointmentsPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: professionals = [] } = useProfessionals(clinic?.id || '');

  const statusConfig = getStatusConfig(t);

  const clinicTimezone = clinic?.timezone || 'America/Sao_Paulo';
  const [selectedDate, setSelectedDate] = useState(() => todayInTimezone(clinicTimezone));

  // Get professional from URL query parameter
  const professionalFromUrl = searchParams.get('professional');
  const [selectedProfessional, setSelectedProfessional] = useState<string>(professionalFromUrl || 'all');

  // Update selected professional when URL param changes
  useEffect(() => {
    if (professionalFromUrl) {
      setSelectedProfessional(professionalFromUrl);
    }
  }, [professionalFromUrl]);
  const [viewMode] = useState<'day' | 'week'>('week'); // Always week view
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Compute Monday of the week using UTC arithmetic (avoids browser timezone issues)
  const utcDay = selectedDate.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(selectedDate.getTime() + mondayOffset * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const weekStart = formatDateInTimezone(monday, clinicTimezone);
  const weekEnd = formatDateInTimezone(sunday, clinicTimezone);

  const { data: appointments = [], isLoading, updateStatus, cancel } = useAppointments(
    clinic?.id || '',
    { startDate: weekStart, endDate: weekEnd, professionalId: selectedProfessional !== 'all' ? selectedProfessional : undefined }
  );

  const { timeBlocks, createBlock, deleteBlock } = useTimeBlocks(
    clinic?.id || '',
    { startDate: weekStart, endDate: weekEnd }
  );

  const stats = useMemo(() => {
    const todayStr = nowInTimezone(clinicTimezone).dateString;
    const todayAppts = appointments.filter(a => a.date === todayStr);
    return {
      today: todayAppts.length,
      confirmed: todayAppts.filter(a => a.status === 'confirmed' || a.status === 'confirmed_presence').length,
      pending: todayAppts.filter(a => a.status === 'pending' || a.status === 'awaiting_confirmation').length,
    };
  }, [appointments, clinicTimezone]);

  const handlePrevWeek = () => {
    setSelectedDate(prev => new Date(prev.getTime() - 7 * 86400000));
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => new Date(prev.getTime() + 7 * 86400000));
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      await updateStatus.mutateAsync({ id: appointmentId, status: newStatus });
      toast.success(t('appointmentsPage.statusUpdated'));
      setDetailsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || t('appointmentsPage.statusUpdateError'));
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm(t('appointmentsPage.cancelConfirm'))) return;

    try {
      await cancel.mutateAsync({ id: appointmentId });
      toast.success(t('appointmentsPage.cancelSuccess'));
      setDetailsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || t('appointmentsPage.cancelError'));
    }
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDetailsDialogOpen(true);
  };

  const handleBlockTime = async (block: CreateTimeBlockInput) => {
    try {
      await createBlock.mutateAsync(block);
      toast.success(t('appointmentsPage.blockSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('appointmentsPage.blockError'));
    }
  };

  const handleRemoveBlock = async (blockId: string) => {
    try {
      await deleteBlock.mutateAsync(blockId);
      toast.success(t('appointmentsPage.unblockSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('appointmentsPage.unblockError'));
    }
  };

  const handleProfessionalSelect = (professionalId: string) => {
    setSelectedProfessional(professionalId === selectedProfessional ? 'all' : professionalId);
  };

  // Filter active professionals
  const activeProfessionals = professionals.filter(p => p.active);

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
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">{t('appointmentsPage.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('appointmentsPage.description')}</p>
      </div>

      {/* Stats Cards Row */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xs text-blue-600 font-medium">{t('appointmentsPage.today')}</p>
                <p className="text-2xl font-bold text-blue-700">{stats.today}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xs text-emerald-600 font-medium">{t('appointmentsPage.confirmed')}</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.confirmed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50 to-white">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-violet-600 font-medium">{t('appointmentsPage.pending')}</p>
              <p className="text-2xl font-bold text-violet-700">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Stats Cards */}
      <div className="lg:hidden grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">{t('appointmentsPage.today')}</p>
              <p className="text-2xl font-bold text-blue-700">{stats.today}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-emerald-600 font-medium">{t('appointmentsPage.confirmed')}</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.confirmed}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50 to-white">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-violet-600 font-medium">{t('appointmentsPage.pending')}</p>
              <p className="text-2xl font-bold text-violet-700">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout - Calendar aligned with Hoje+Confirmados, Filter aligned with Pendentes */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        {/* Calendar spans 2 columns - aligned with Hoje + Confirmados */}
        <Card className="col-span-2 h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('appointmentsPage.calendar')}</CardTitle>
                <CardDescription>{t('appointmentsPage.calendarDesc')}</CardDescription>
              </div>
              {/* Date Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center min-w-[120px]">
                  <p className="text-sm font-medium">
                    {formatDayMonthInTimezone(monday, clinicTimezone)} - {formatDayMonthInTimezone(sunday, clinicTimezone)}
                  </p>
                </div>
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayInTimezone(clinicTimezone))}>
                  {t('appointmentsPage.today')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-hidden">
            <CalendarGrid
              selectedDate={selectedDate}
              viewMode={viewMode}
              appointments={appointments}
              timeBlocks={timeBlocks}
              professionals={professionals}
              selectedProfessional={selectedProfessional}
              clinicTimezone={clinicTimezone}
              onAppointmentClick={handleAppointmentClick}
              onBlockTime={handleBlockTime}
              onRemoveBlock={handleRemoveBlock}
            />
          </CardContent>
        </Card>

        {/* Professional Filter - aligned with Pendentes */}
        <Card className="h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-base">{t('appointmentsPage.byProfessional')}</CardTitle>
            <CardDescription>
              {selectedProfessional === 'all'
                ? t('appointmentsPage.selectToFilter')
                : t('appointmentsPage.clickToClear')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 flex-1 overflow-y-auto">
            {activeProfessionals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <User className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{t('appointmentsPage.noProfessionals')}</p>
              </div>
            ) : (
              activeProfessionals.map((professional) => {
                const isSelected = selectedProfessional === professional.id;
                return (
                  <div
                    key={professional.id}
                    onClick={() => handleProfessionalSelect(professional.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'border border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={professional.photoUrl} alt={professional.name} />
                      <AvatarFallback className="text-sm bg-gray-100">
                        {getInitials(professional.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{professional.name}</p>
                      {getProfessionalSpecialties(professional).length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {getSpecialtyNames(getProfessionalSpecialties(professional))}
                        </p>
                      )}
                      {(professional.consultationPrice ?? 0) > 0 && (
                        <p className="text-xs font-medium text-green-600 mt-1">
                          {formatPrice(professional.consultationPrice ?? 0)}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Calendar Card */}
      <div className="lg:hidden">
        <Card className="h-[calc(100vh-280px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('appointmentsPage.calendar')}</CardTitle>
                <CardDescription>{t('appointmentsPage.calendarDesc')}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center min-w-[100px]">
                  <p className="text-xs font-medium">
                    {formatDayMonthInTimezone(monday, clinicTimezone)} - {formatDayMonthInTimezone(sunday, clinicTimezone)}
                  </p>
                </div>
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-hidden">
            <CalendarGrid
              selectedDate={selectedDate}
              viewMode={viewMode}
              appointments={appointments}
              timeBlocks={timeBlocks}
              professionals={professionals}
              selectedProfessional={selectedProfessional}
              clinicTimezone={clinicTimezone}
              onAppointmentClick={handleAppointmentClick}
              onBlockTime={handleBlockTime}
              onRemoveBlock={handleRemoveBlock}
            />
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Professional Filter */}
      <div className="lg:hidden">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('appointmentsPage.byProfessional')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger>
                <SelectValue placeholder={t('appointmentsPage.allProfessionals')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {activeProfessionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('appointmentsPage.appointmentDetails')}</DialogTitle>
            <DialogDescription>
              {t('appointmentsPage.appointmentDetailsDesc')}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.patient')}</p>
                  <p className="font-medium">{selectedAppointment.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.phone')}</p>
                  <p className="font-medium">{selectedAppointment.patientPhone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.professional')}</p>
                  <p className="font-medium">{selectedAppointment.professionalName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.service')}</p>
                  <p className="font-medium">{selectedAppointment.serviceName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.date')}</p>
                  <p className="font-medium">
                    {format(parseISO(selectedAppointment.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.time')}</p>
                  <p className="font-medium">{selectedAppointment.time} ({selectedAppointment.duration}min)</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <Badge className={`${statusConfig[selectedAppointment.status]?.color || statusConfig.pending.color} border-0`}>
                  {statusConfig[selectedAppointment.status]?.label || t('appointmentsPage.status.pending')}
                </Badge>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('appointmentsPage.notes')}</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedAppointment && selectedAppointment.status === 'pending' && (
              <Button onClick={() => handleStatusChange(selectedAppointment.id, 'confirmed')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('appointmentsPage.confirm')}
              </Button>
            )}
            {selectedAppointment && (selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'confirmed_presence') && (
              <Button onClick={() => handleStatusChange(selectedAppointment.id, 'completed')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('appointmentsPage.markCompleted')}
              </Button>
            )}
            {selectedAppointment && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
              <>
                <Button variant="outline" onClick={() => handleStatusChange(selectedAppointment.id, 'no_show')}>
                  {t('appointmentsPage.noShow')}
                </Button>
                <Button variant="destructive" onClick={() => handleCancel(selectedAppointment.id)}>
                  {t('appointmentsPage.cancel')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
