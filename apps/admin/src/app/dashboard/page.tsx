'use client';

import { usePlatformStats } from '@/hooks/use-stats';
import { useAllAppointments } from '@/hooks/use-appointments';
import { useClinics } from '@/hooks/use-clinics';
import {
  Building2,
  DollarSign,
  Calendar,
  Clock,
  Smartphone,
  TrendingDown,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue';
}

function StatsCard({ title, value, subtitle, icon, loading, color = 'default' }: StatsCardProps) {
  const colorClasses = {
    default: 'bg-secondary text-foreground',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-white border border-gray-200 p-4 sm:p-6 card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-normal text-muted-foreground">{title}</p>
          {loading ? (
            <div className="h-6 sm:h-8 w-20 sm:w-24 bg-gray-200 animate-pulse mt-1" />
          ) : (
            <p className="text-lg sm:text-2xl font-medium text-foreground mt-1 truncate">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2 sm:p-3 flex-shrink-0 rounded-full', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function RecentAppointmentsTable({ appointments, loading }: { appointments: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!appointments.length) {
    return (
      <p className="text-muted-foreground text-center py-8">No appointments yet</p>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    awaiting_confirmation: 'bg-orange-100 text-orange-700',
    confirmed_presence: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Clinic</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Patient</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Date</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Status</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground hidden sm:table-cell">Deposit</th>
          </tr>
        </thead>
        <tbody>
          {appointments.slice(0, 5).map((apt) => (
            <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-foreground truncate max-w-[120px]">
                {apt.clinicName || 'Unknown'}
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-foreground truncate max-w-[120px]">
                {apt.patientName}
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-foreground">
                {apt.date} {apt.time}
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-normal',
                  statusColors[apt.status] || 'bg-gray-100 text-gray-700'
                )}>
                  {apt.status}
                </span>
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm hidden sm:table-cell">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal',
                  apt.depositPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {apt.depositPaid ? 'Paid' : 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentClinicsTable({ clinics, loading }: { clinics: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!clinics.length) {
    return (
      <p className="text-muted-foreground text-center py-8">No clinics yet</p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Clinic</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground">Status</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground hidden sm:table-cell">WhatsApp</th>
            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal text-muted-foreground hidden lg:table-cell">Joined</th>
          </tr>
        </thead>
        <tbody>
          {clinics.slice(0, 5).map((clinic) => (
            <tr key={clinic.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 sm:py-3 px-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  </div>
                  <span className="text-xs sm:text-sm font-normal text-foreground truncate max-w-[120px] sm:max-w-none">
                    {clinic.name || 'Unnamed Clinic'}
                  </span>
                </div>
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-normal',
                  clinic.status === 'active' && 'bg-green-100 text-green-700',
                  clinic.status === 'suspended' && 'bg-red-100 text-red-700',
                  (!clinic.status || clinic.status === 'pending') && 'bg-yellow-100 text-yellow-700',
                )}>
                  {clinic.status || 'pending'}
                </span>
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4 hidden sm:table-cell">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-normal',
                  clinic.whatsappConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700',
                )}>
                  {clinic.whatsappConnected ? 'Connected' : 'Disconnected'}
                </span>
              </td>
              <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                {new Date(clinic.createdAt).toLocaleDateString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: appointments, isLoading: appointmentsLoading } = useAllAppointments(10);
  const { data: clinics, isLoading: clinicsLoading } = useClinics();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-medium text-foreground">Dashboard Overview</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Welcome to the Gendei admin dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Clinics"
          value={stats?.totalClinics || 0}
          subtitle={`${stats?.activeClinics || 0} active`}
          icon={<Building2 className="w-5 h-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          subtitle="deposits collected"
          icon={<DollarSign className="w-5 h-5" />}
          loading={statsLoading}
          color="green"
        />
        <StatsCard
          title="Appointments"
          value={stats?.totalAppointments || 0}
          subtitle={`${stats?.todayAppointments || 0} today`}
          icon={<Calendar className="w-5 h-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Pending Deposits"
          value={formatCurrency(stats?.pendingDeposits || 0)}
          icon={<Clock className="w-5 h-5" />}
          loading={statsLoading}
          color="yellow"
        />
        <StatsCard
          title="WhatsApp Connected"
          value={stats?.whatsappConnectedCount || 0}
          subtitle={`${stats?.whatsappConnectedRate?.toFixed(0) || 0}% of clinics`}
          icon={<Smartphone className="w-5 h-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="No-Show Rate"
          value={`${stats?.noShowRate?.toFixed(1) || 0}%`}
          subtitle={`${stats?.noShowCount || 0} no-shows`}
          icon={<TrendingDown className="w-5 h-5" />}
          loading={statsLoading}
          color="red"
        />
      </div>

      {/* Recent Data Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Appointments */}
        <div className="bg-white border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-medium text-foreground">Recent Appointments</h2>
            <a
              href="/dashboard/appointments"
              className="text-xs sm:text-sm text-primary hover:underline font-normal"
            >
              View all
            </a>
          </div>
          <RecentAppointmentsTable appointments={appointments || []} loading={appointmentsLoading} />
        </div>

        {/* Recent Clinics */}
        <div className="bg-white border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-medium text-foreground">Recent Clinics</h2>
            <a
              href="/dashboard/clinics"
              className="text-xs sm:text-sm text-primary hover:underline font-normal"
            >
              View all
            </a>
          </div>
          <RecentClinicsTable clinics={clinics || []} loading={clinicsLoading} />
        </div>
      </div>
    </div>
  );
}
