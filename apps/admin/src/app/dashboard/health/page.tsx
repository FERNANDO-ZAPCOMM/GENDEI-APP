'use client';

import { useState, useEffect } from 'react';
import { useClinics } from '@/hooks/use-clinics';
import {
  Activity,
  Server,
  Database,
  MessageCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: Date;
  icon: React.ReactNode;
}

export default function HealthPage() {
  const { data: clinics } = useClinics();
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkServices = async () => {
    setIsChecking(true);

    // Simulate health checks (in production, these would be real API calls)
    await new Promise(resolve => setTimeout(resolve, 1000));

    setServices([
      {
        name: 'API Server',
        status: 'healthy',
        latency: Math.floor(Math.random() * 50) + 20,
        lastCheck: new Date(),
        icon: <Server className="w-5 h-5" />,
      },
      {
        name: 'Firestore Database',
        status: 'healthy',
        latency: Math.floor(Math.random() * 30) + 10,
        lastCheck: new Date(),
        icon: <Database className="w-5 h-5" />,
      },
      {
        name: 'WhatsApp Agent',
        status: Math.random() > 0.1 ? 'healthy' : 'degraded',
        latency: Math.floor(Math.random() * 100) + 50,
        lastCheck: new Date(),
        icon: <MessageCircle className="w-5 h-5" />,
      },
    ]);

    setIsChecking(false);
  };

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const whatsappConnected = clinics?.filter(c => c.whatsappConnected).length || 0;
  const whatsappDisconnected = clinics?.filter(c => !c.whatsappConnected).length || 0;
  const connectionRate = clinics?.length ? (whatsappConnected / clinics.length) * 100 : 0;

  const disconnectedClinics = clinics?.filter(c => !c.whatsappConnected) || [];

  const overallStatus = services.every(s => s.status === 'healthy')
    ? 'healthy'
    : services.some(s => s.status === 'down')
    ? 'down'
    : 'degraded';

  const statusColors = {
    healthy: 'bg-green-100 text-green-700 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    down: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusIcons = {
    healthy: <CheckCircle className="w-5 h-5 text-green-600" />,
    degraded: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    down: <XCircle className="w-5 h-5 text-red-600" />,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-foreground">System Health</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Monitor system status and service health
          </p>
        </div>
        <button
          onClick={checkServices}
          disabled={isChecking}
          className={cn(
            'flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full text-sm hover:bg-gray-50 transition-colors',
            isChecking && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', isChecking && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={cn('p-4 border rounded-lg', statusColors[overallStatus])}>
        <div className="flex items-center gap-3">
          {statusIcons[overallStatus]}
          <div>
            <p className="font-medium">
              {overallStatus === 'healthy' && 'All Systems Operational'}
              {overallStatus === 'degraded' && 'Some Services Degraded'}
              {overallStatus === 'down' && 'System Outage Detected'}
            </p>
            <p className="text-sm opacity-80">
              Last checked: {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {services.map((service) => (
          <div key={service.name} className="bg-white border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-full',
                  service.status === 'healthy' && 'bg-green-100',
                  service.status === 'degraded' && 'bg-yellow-100',
                  service.status === 'down' && 'bg-red-100',
                )}>
                  {service.icon}
                </div>
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.latency}ms latency
                  </p>
                </div>
              </div>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-normal',
                statusColors[service.status]
              )}>
                {service.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* WhatsApp Connections */}
      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-medium">WhatsApp Connections</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded">
            <p className="text-2xl font-medium">{clinics?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Clinics</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded">
            <p className="text-2xl font-medium text-green-600">{whatsappConnected}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded">
            <p className="text-2xl font-medium text-red-600">{whatsappDisconnected}</p>
            <p className="text-xs text-muted-foreground">Disconnected</p>
          </div>
        </div>

        {/* Connection Rate Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Connection Rate</p>
            <p className="text-sm font-medium">{connectionRate.toFixed(0)}%</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${connectionRate}%` }}
            />
          </div>
        </div>

        {/* Disconnected Clinics */}
        {disconnectedClinics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Clinics Needing Reconnection</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {disconnectedClinics.map(clinic => (
                <div key={clinic.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">{clinic.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{clinic.email || clinic.id.slice(0, 8)}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                    Disconnected
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
