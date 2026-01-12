'use client';

import { usePlatformStats } from '@/hooks/use-stats';
import { useAllAppointments } from '@/hooks/use-appointments';
import { useClinics } from '@/hooks/use-clinics';
import { DollarSign, TrendingUp, Clock, XCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function PaymentsPage() {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: appointments } = useAllAppointments(100);
  const { data: clinics } = useClinics();

  // Calculate revenue by clinic
  const revenueByClinic = clinics?.map(clinic => {
    const clinicAppointments = appointments?.filter(apt => apt.clinicId === clinic.id) || [];
    const revenue = clinicAppointments
      .filter(apt => apt.depositPaid && apt.depositAmount)
      .reduce((sum, apt) => sum + (apt.depositAmount || 0), 0);
    return {
      clinic,
      revenue,
      appointmentCount: clinicAppointments.length,
      paidCount: clinicAppointments.filter(apt => apt.depositPaid).length,
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10) || [];

  // Recent paid appointments
  const recentPaidAppointments = (appointments || [])
    .filter(apt => apt.depositPaid)
    .slice(0, 10);

  // Failed/pending deposits
  const pendingDeposits = (appointments || [])
    .filter(apt => !apt.depositPaid && apt.depositAmount)
    .slice(0, 10);

  const paidRate = stats?.totalAppointments
    ? ((appointments?.filter(a => a.depositPaid).length || 0) / stats.totalAppointments * 100)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-medium text-foreground">Payments & Revenue</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Track deposits and revenue across all clinics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              {statsLoading ? (
                <div className="h-7 w-24 bg-gray-100 animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-medium text-green-600">{formatCurrency(stats?.totalRevenue || 0)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Deposits</p>
              {statsLoading ? (
                <div className="h-7 w-24 bg-gray-100 animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-medium text-yellow-600">{formatCurrency(stats?.pendingDeposits || 0)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No-Show Lost</p>
              {statsLoading ? (
                <div className="h-7 w-24 bg-gray-100 animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-medium text-red-600">
                  {formatCurrency(
                    (appointments || [])
                      .filter(a => a.status === 'no_show' && a.depositAmount)
                      .reduce((sum, a) => sum + (a.depositAmount || 0), 0)
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Rate</p>
              {statsLoading ? (
                <div className="h-7 w-24 bg-gray-100 animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-medium text-blue-600">{paidRate.toFixed(0)}%</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Clinic */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="text-lg font-medium mb-4">Revenue by Clinic</h2>
          {revenueByClinic.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No data</p>
          ) : (
            <div className="space-y-3">
              {revenueByClinic.map(({ clinic, revenue, paidCount }) => (
                <div key={clinic.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">{clinic.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{paidCount} deposits paid</p>
                  </div>
                  <p className="text-sm font-medium text-green-600">{formatCurrency(revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="text-lg font-medium mb-4">Recent Payments</h2>
          {recentPaidAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payments yet</p>
          ) : (
            <div className="space-y-2">
              {recentPaidAppointments.map(apt => (
                <div key={apt.id} className="flex items-center justify-between p-3 border border-gray-100 rounded">
                  <div>
                    <p className="text-sm font-medium">{apt.patientName}</p>
                    <p className="text-xs text-muted-foreground">{apt.clinicName} - {apt.date}</p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    {formatCurrency(apt.depositAmount || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Deposits */}
        <div className="bg-white border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-medium mb-4">Pending Deposits</h2>
          {pendingDeposits.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending deposits</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Patient</th>
                    <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Clinic</th>
                    <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Amount</th>
                    <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeposits.map(apt => (
                    <tr key={apt.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-sm">{apt.patientName}</td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">{apt.clinicName}</td>
                      <td className="py-2 px-3 text-sm">{apt.date}</td>
                      <td className="py-2 px-3 text-sm font-medium">{formatCurrency(apt.depositAmount || 0)}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                          Pending
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
