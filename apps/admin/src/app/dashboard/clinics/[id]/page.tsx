'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  useClinic,
  useClinicProfessionals,
  useClinicPatients,
  useClinicAppointments,
} from '@/hooks/use-clinics';
import {
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  Smartphone,
  User,
  DollarSign,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function ClinicDetailPage() {
  const params = useParams();
  const clinicId = params.id as string;

  const { data: clinic, isLoading: clinicLoading } = useClinic(clinicId);
  const { data: professionals } = useClinicProfessionals(clinicId);
  const { data: patients } = useClinicPatients(clinicId);
  const { data: appointments } = useClinicAppointments(clinicId);

  const totalRevenue = (appointments || [])
    .filter(apt => apt.depositPaid && apt.depositAmount)
    .reduce((sum, apt) => sum + (apt.depositAmount || 0), 0);

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 animate-pulse" />
        <div className="h-32 bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Clinic not found</p>
        <Link href="/dashboard/clinics" className="text-primary hover:underline mt-2 inline-block">
          Back to clinics
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/clinics"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to clinics
      </Link>

      {/* Clinic Header */}
      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-medium">{clinic.name || 'Unnamed Clinic'}</h1>
              <span className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-normal',
                clinic.status === 'active' && 'bg-green-100 text-green-700',
                clinic.status === 'suspended' && 'bg-red-100 text-red-700',
                (!clinic.status || clinic.status === 'pending') && 'bg-yellow-100 text-yellow-700',
              )}>
                {clinic.status || 'pending'}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-normal',
                clinic.whatsappConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
              )}>
                <Smartphone className="w-3 h-3" />
                {clinic.whatsappConnected ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">{clinic.email}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {clinic.address} | {clinic.phone}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Joined: {new Date(clinic.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Professionals</p>
              <p className="text-xl font-medium">{professionals?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-full">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Patients</p>
              <p className="text-xl font-medium">{patients?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Appointments</p>
              <p className="text-xl font-medium">{appointments?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-xl font-medium">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Professionals */}
      <div className="bg-white border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-4">Professionals</h2>
        {(professionals?.length || 0) === 0 ? (
          <p className="text-muted-foreground text-center py-4">No professionals</p>
        ) : (
          <div className="space-y-2">
            {professionals?.map(prof => (
              <div key={prof.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-sm">{prof.name?.[0] || 'P'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{prof.name}</p>
                  <p className="text-xs text-muted-foreground">{prof.specialty}</p>
                </div>
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs',
                  prof.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {prof.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Appointments */}
      <div className="bg-white border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-4">Recent Appointments</h2>
        {(appointments?.length || 0) === 0 ? (
          <p className="text-muted-foreground text-center py-4">No appointments</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Patient</th>
                  <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Professional</th>
                  <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-normal text-muted-foreground">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {appointments?.slice(0, 10).map(apt => (
                  <tr key={apt.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm">{apt.patientName}</td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">{apt.professionalName}</td>
                    <td className="py-2 px-3 text-sm">{apt.date} {apt.time}</td>
                    <td className="py-2 px-3">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs',
                        apt.status === 'completed' && 'bg-green-100 text-green-700',
                        apt.status === 'confirmed' && 'bg-blue-100 text-blue-700',
                        apt.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                        apt.status === 'cancelled' && 'bg-red-100 text-red-700',
                        apt.status === 'no_show' && 'bg-gray-100 text-gray-700',
                      )}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs',
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
