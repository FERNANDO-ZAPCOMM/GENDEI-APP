'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Users,
  UserPlus,
  CalendarDays,
  ArrowRight,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useClinic, useClinicStats } from '@/hooks/use-clinic';
import { useTodayAppointments } from '@/hooks/use-appointments';
import { useMetaStatus } from '@/hooks/use-meta-status';
import { useAuth } from '@/hooks/use-auth';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectionAlerts } from '@/components/dashboard/ConnectionAlerts';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { useParams } from 'next/navigation';
import type { AppointmentStatus } from '@/lib/clinic-types';

const statusConfig: Record<AppointmentStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  awaiting_confirmation: { label: 'Aguardando', color: 'bg-orange-100 text-orange-700', icon: Clock },
  confirmed_presence: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  completed: { label: 'Concluido', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
  no_show: { label: 'Faltou', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { currentUser } = useAuth();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: stats, isLoading: statsLoading } = useClinicStats(clinic?.id || '');
  const { data: todayAppointments, isLoading: appointmentsLoading } = useTodayAppointments(clinic?.id || '');
  const { status: metaStatus, error: metaError } = useMetaStatus(currentUser?.uid || '');

  // Onboarding status
  const onboardingStatus = useOnboardingStatus();

  const isWhatsAppConnected = clinic?.whatsappConnected || false;

  // Sort today's appointments by time
  const sortedAppointments = useMemo(() => {
    if (!todayAppointments) return [];
    return [...todayAppointments].sort((a, b) => a.time.localeCompare(b.time));
  }, [todayAppointments]);

  // Show skeleton while clinic is loading
  if (clinicLoading) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">
          {t('dashboard.overview')}
        </h1>
        {clinic?.name && (
          <p className="text-muted-foreground mt-1">{clinic.name}</p>
        )}
      </div>

      {/* Connection Alerts - Only show if we have valid meta status */}
      {metaStatus && !metaError && <ConnectionAlerts status={metaStatus} locale={locale} />}

      {/* Setup Checklist - Always show, with green styling when complete */}
      {!onboardingStatus.isLoading && (
        <SetupChecklist
          clinicInfoComplete={onboardingStatus.clinicInfoComplete}
          professionalsComplete={onboardingStatus.professionalsComplete}
          paymentComplete={onboardingStatus.paymentComplete}
          whatsappComplete={onboardingStatus.whatsappComplete}
          nextStep={onboardingStatus.nextStep}
        />
      )}

      {/* Stats Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Today's Appointments */}
        <Link href={`/${locale}/dashboard/appointments`} className="block h-full">
          <Card className="border-blue-100 cursor-pointer hover:shadow-md transition-shadow h-full" style={{ background: 'linear-gradient(to bottom right, #f0f7ff, white)' }}>
            <CardContent className="p-4 h-full">
              <div className="flex items-center justify-between h-full min-h-[72px]">
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t('dashboard.todayAppointments')}</p>
                  {statsLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-blue-700">{stats?.todayAppointments || 0}</p>
                  )}
                </div>
                <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Week Appointments */}
        <Link href={`/${locale}/dashboard/appointments`} className="block h-full">
          <Card className="border-purple-100 cursor-pointer hover:shadow-md transition-shadow h-full" style={{ background: 'linear-gradient(to bottom right, #fdfaff, white)' }}>
            <CardContent className="p-4 h-full">
              <div className="flex items-center justify-between h-full min-h-[72px]">
                <div>
                  <p className="text-xs text-purple-600 font-medium">{t('dashboard.weekAppointments')}</p>
                  {statsLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-purple-700">{stats?.weekAppointments || 0}</p>
                  )}
                </div>
                <CalendarDays className="w-5 h-5 text-purple-600 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Total Patients */}
        <Link href={`/${locale}/dashboard/patients`} className="block h-full">
          <Card className="border-indigo-100 cursor-pointer hover:shadow-md transition-shadow h-full" style={{ background: 'linear-gradient(to bottom right, #f5f5ff, white)' }}>
            <CardContent className="p-4 h-full">
              <div className="flex items-center justify-between h-full min-h-[72px]">
                <div>
                  <p className="text-xs text-indigo-600 font-medium">{t('dashboard.totalPatients')}</p>
                  {statsLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-indigo-700">{stats?.totalPatients || 0}</p>
                  )}
                </div>
                <Users className="w-5 h-5 text-indigo-600 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* WhatsApp Status */}
        <Link href={`/${locale}/dashboard/whatsapp`} className="block h-full">
          <Card className={`cursor-pointer hover:shadow-md transition-shadow h-full ${isWhatsAppConnected ? 'border-green-100' : 'border-gray-200'}`} style={{ background: isWhatsAppConnected ? 'linear-gradient(to bottom right, #f7fefa, white)' : 'linear-gradient(to bottom right, #fcfcfc, white)' }}>
            <CardContent className="p-4 h-full">
              <div className="flex items-center justify-between h-full min-h-[72px]">
                <div>
                  <p className={`text-xs font-medium ${isWhatsAppConnected ? 'text-green-600' : 'text-gray-500'}`}>{t('dashboard.whatsappStatus')}</p>
                  <p className={`text-lg font-bold ${isWhatsAppConnected ? 'text-green-700' : 'text-gray-600'}`}>
                    {isWhatsAppConnected ? t('whatsapp.connected') : t('whatsapp.notConnected')}
                  </p>
                </div>
                {isWhatsAppConnected ? (
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Appointments */}
      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                {t('dashboard.recentActivity')}
              </CardTitle>
              <CardDescription>
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </CardDescription>
            </div>
            <Link href={`/${locale}/dashboard/appointments`}>
              <Button variant="ghost" size="sm">
                {t('dashboard.viewAll')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {appointmentsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Skeleton className="h-12 w-16" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : sortedAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">{t('dashboard.noRecentActivity')}</p>
              <p className="text-muted-foreground/70 text-xs mt-1">{t('dashboard.noRecentActivityDescription')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAppointments.map((appointment) => {
                const status = statusConfig[appointment.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/${locale}/dashboard/appointments`)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Time */}
                      <div className="text-center min-w-[60px] bg-slate-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-900">{appointment.time}</p>
                        <p className="text-xs text-muted-foreground">{appointment.duration}min</p>
                      </div>

                      {/* Patient & Service */}
                      <div>
                        <p className="font-medium text-gray-900">{appointment.patientName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{appointment.professionalName}</span>
                          {appointment.serviceName && (
                            <>
                              <span className="text-xs">•</span>
                              <span>{appointment.serviceName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge className={`${status.color} border-0 flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          <CardDescription>{t('dashboard.quickActionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href={`/${locale}/dashboard/professionals`}>
            <Button variant="outline">
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Profissional
            </Button>
          </Link>
          <Link href={`/${locale}/dashboard/appointments`}>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Ver Agenda
            </Button>
          </Link>
          {!isWhatsAppConnected && (
            <Link href={`/${locale}/dashboard/whatsapp`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Conectar WhatsApp
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
