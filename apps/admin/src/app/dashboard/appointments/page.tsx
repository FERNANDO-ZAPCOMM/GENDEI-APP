'use client';

import { useState } from 'react';
import { useAllAppointments } from '@/hooks/use-appointments';
import { useClinics } from '@/hooks/use-clinics';
import { Search, Download, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function AppointmentsPage() {
  const { data: appointments, isLoading } = useAllAppointments(100);
  const { data: clinics } = useClinics();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clinicFilter, setClinicFilter] = useState<string>('all');

  const filteredAppointments = (appointments || []).filter(apt => {
    const matchesSearch = !search ||
      apt.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      apt.patientPhone?.includes(search) ||
      apt.professionalName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    const matchesClinic = clinicFilter === 'all' || apt.clinicId === clinicFilter;

    return matchesSearch && matchesStatus && matchesClinic;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Clinic', 'Patient', 'Phone', 'Professional', 'Status', 'Deposit'];
    const rows = filteredAppointments.map(apt => [
      apt.date,
      apt.time,
      apt.clinicName || '',
      apt.patientName,
      apt.patientPhone,
      apt.professionalName,
      apt.status,
      apt.depositPaid ? formatCurrency(apt.depositAmount || 0) : 'Pending',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    awaiting_confirmation: 'bg-orange-100 text-orange-700',
    confirmed_presence: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-700',
  };

  // Stats
  const completed = appointments?.filter(a => a.status === 'completed').length || 0;
  const noShow = appointments?.filter(a => a.status === 'no_show').length || 0;
  const pending = appointments?.filter(a => a.status === 'pending').length || 0;
  const depositsPaid = appointments?.filter(a => a.depositPaid).length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-foreground">Appointments</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            All appointments across all clinics
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <p className="text-xl font-medium mt-1">{appointments?.length || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <p className="text-xl font-medium text-green-600 mt-1">{completed}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <p className="text-xs text-muted-foreground">No-Show</p>
          </div>
          <p className="text-xl font-medium text-red-600 mt-1">{noShow}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <p className="text-xs text-muted-foreground">Deposits Paid</p>
          </div>
          <p className="text-xl font-medium text-yellow-600 mt-1">{depositsPaid}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by patient, phone, or professional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-Show</option>
        </select>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="all">All Clinics</option>
          {clinics?.map(clinic => (
            <option key={clinic.id} value={clinic.id}>{clinic.name || 'Unnamed'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No appointments found</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Date/Time</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Clinic</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Professional</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      <div>
                        <p className="font-medium">{apt.date}</p>
                        <p className="text-muted-foreground">{apt.time}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground truncate max-w-[120px]">
                      {apt.clinicName || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{apt.patientPhone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {apt.professionalName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-normal',
                        statusColors[apt.status] || 'bg-gray-100 text-gray-700'
                      )}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-normal',
                        apt.depositPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {apt.depositPaid ? formatCurrency(apt.depositAmount || 0) : 'Pending'}
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
  );
}
