'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useClinics } from '@/hooks/use-clinics';
import { Building2, Search, Smartphone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClinicsPage() {
  const { data: clinics, isLoading } = useClinics();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [whatsappFilter, setWhatsappFilter] = useState<string>('all');

  const filteredClinics = (clinics || []).filter(clinic => {
    const matchesSearch = !search ||
      clinic.name?.toLowerCase().includes(search.toLowerCase()) ||
      clinic.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || clinic.status === statusFilter;

    const matchesWhatsapp = whatsappFilter === 'all' ||
      (whatsappFilter === 'connected' && clinic.whatsappConnected) ||
      (whatsappFilter === 'disconnected' && !clinic.whatsappConnected);

    return matchesSearch && matchesStatus && matchesWhatsapp;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-medium text-foreground">Clinics</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Manage all registered clinics on the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clinics..."
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
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={whatsappFilter}
          onChange={(e) => setWhatsappFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="all">All WhatsApp</option>
          <option value="connected">Connected</option>
          <option value="disconnected">Disconnected</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-medium">{clinics?.length || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-xl font-medium text-green-600">
            {clinics?.filter(c => c.status === 'active').length || 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-xs text-muted-foreground">WhatsApp Connected</p>
          <p className="text-xl font-medium text-blue-600">
            {clinics?.filter(c => c.whatsappConnected).length || 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-medium text-yellow-600">
            {clinics?.filter(c => !c.status || c.status === 'pending').length || 0}
          </p>
        </div>
      </div>

      {/* Clinics Table */}
      <div className="bg-white border border-gray-200 p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filteredClinics.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No clinics found</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Clinic</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">WhatsApp</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Joined</th>
                  <th className="text-left py-3 px-4 text-sm font-normal text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClinics.map((clinic) => (
                  <tr key={clinic.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{clinic.name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{clinic.email || clinic.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-normal',
                        clinic.status === 'active' && 'bg-green-100 text-green-700',
                        clinic.status === 'suspended' && 'bg-red-100 text-red-700',
                        (!clinic.status || clinic.status === 'pending') && 'bg-yellow-100 text-yellow-700',
                      )}>
                        {clinic.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-normal',
                        clinic.whatsappConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                      )}>
                        <Smartphone className="w-3 h-3" />
                        {clinic.whatsappConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground capitalize">
                        {clinic.plan || 'free'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(clinic.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/clinics/${clinic.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
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
