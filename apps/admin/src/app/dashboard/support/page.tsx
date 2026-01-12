'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useClinics } from '@/hooks/use-clinics';
import { useAllAppointments } from '@/hooks/use-appointments';
import {
  Search,
  Phone,
  Building2,
  ExternalLink,
  Calendar,
  MessageCircle,
  Users,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SupportPage() {
  const { data: clinics } = useClinics();
  const { data: appointments } = useAllAppointments(100);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [clinicSearch, setClinicSearch] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<any>(null);

  // Search for patient by phone
  const matchingAppointments = phoneSearch.length >= 4
    ? (appointments || []).filter(apt =>
        apt.patientPhone?.includes(phoneSearch)
      )
    : [];

  // Search for clinics
  const matchingClinics = clinicSearch.length >= 2
    ? (clinics || []).filter(clinic =>
        clinic.name?.toLowerCase().includes(clinicSearch.toLowerCase()) ||
        clinic.email?.toLowerCase().includes(clinicSearch.toLowerCase()) ||
        clinic.id.includes(clinicSearch)
      )
    : [];

  const handleSelectClinic = (clinic: any) => {
    setSelectedClinic(clinic);
    setClinicSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-medium text-foreground">Support Tools</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Quick access to patient and clinic information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phone Number Lookup */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium">Patient Lookup</h2>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {phoneSearch.length >= 4 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {matchingAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No patients found with this phone number
                </p>
              ) : (
                matchingAppointments.map(apt => (
                  <div key={apt.id} className="p-3 bg-gray-50 rounded">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{apt.patientPhone}</p>
                      </div>
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs',
                        apt.status === 'completed' && 'bg-green-100 text-green-700',
                        apt.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                        apt.status === 'cancelled' && 'bg-red-100 text-red-700',
                      )}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span>{apt.clinicName}</span>
                      <span>•</span>
                      <Calendar className="w-3 h-3" />
                      <span>{apt.date} {apt.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Clinic Quick Access */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium">Clinic Quick Access</h2>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clinics..."
              value={clinicSearch}
              onChange={(e) => setClinicSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Search Results */}
          {clinicSearch.length >= 2 && matchingClinics.length > 0 && (
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto border border-gray-100 rounded p-2">
              {matchingClinics.map(clinic => (
                <button
                  key={clinic.id}
                  onClick={() => handleSelectClinic(clinic)}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm"
                >
                  <p className="font-medium">{clinic.name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{clinic.email}</p>
                </button>
              ))}
            </div>
          )}

          {/* Selected Clinic */}
          {selectedClinic && (
            <div className="border border-gray-200 rounded p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{selectedClinic.name || 'Unnamed'}</h3>
                  <p className="text-sm text-muted-foreground">{selectedClinic.email}</p>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2 text-xs">
                      <Smartphone className={cn(
                        'w-3 h-3',
                        selectedClinic.whatsappConnected ? 'text-green-600' : 'text-gray-400'
                      )} />
                      <span>{selectedClinic.whatsappConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        selectedClinic.status === 'active' && 'bg-green-500',
                        (!selectedClinic.status || selectedClinic.status === 'pending') && 'bg-yellow-500',
                        selectedClinic.status === 'suspended' && 'bg-red-500',
                      )} />
                      <span className="capitalize">{selectedClinic.status || 'pending'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Plan: {selectedClinic.plan || 'free'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Joined: {new Date(selectedClinic.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/dashboard/clinics/${selectedClinic.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      View Full Profile <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50">
                      <MessageCircle className="w-3 h-3" />
                      Conversations
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50">
                      <Calendar className="w-3 h-3" />
                      Appointments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 text-center">
          <Building2 className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-2xl font-medium">{clinics?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Total Clinics</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 text-center">
          <Users className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-2xl font-medium">
            {new Set((appointments || []).map(a => a.patientPhone)).size}
          </p>
          <p className="text-xs text-muted-foreground">Unique Patients</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 text-center">
          <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-2xl font-medium">{appointments?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Total Appointments</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 text-center">
          <Smartphone className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-2xl font-medium">
            {clinics?.filter(c => c.whatsappConnected).length || 0}
          </p>
          <p className="text-xs text-muted-foreground">WhatsApp Connected</p>
        </div>
      </div>
    </div>
  );
}
