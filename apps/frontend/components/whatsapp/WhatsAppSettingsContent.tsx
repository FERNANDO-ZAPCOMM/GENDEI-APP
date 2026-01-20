'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useMetaStatus } from '@/hooks/use-meta-status';
import { useClinic } from '@/hooks/use-clinic';
import { Loader2, ChevronDown, ChevronUp, Wifi, User, QrCode, MessageSquare, Workflow, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectMetaButton } from './ConnectMetaButton';
import { ConnectionStatusCardContent } from './ConnectionStatusCard';
import { DisconnectButton } from './DisconnectButton';
import { BusinessProfileCardContent } from './BusinessProfileCard';
import { QRCodesCardContent } from './QRCodesCard';
import { TemplateStatusCardContent } from './TemplateStatusCard';
import { FlowsStatusCardContent } from './FlowsStatusCard';

// Status types for visual indicators
type SectionStatus = 'ready' | 'processing' | 'missing';

// Collapsible Card Component - header and content in one card
interface CollapsibleCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  status: SectionStatus;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleCard({ title, description, icon, status, isExpanded, onToggle, children }: CollapsibleCardProps) {
  // Status-based styling
  const statusStyles = {
    ready: {
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      border: isExpanded ? 'border-green-200' : 'border-gray-200',
    },
    processing: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      border: isExpanded ? 'border-blue-200' : 'border-gray-200',
    },
    missing: {
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      border: isExpanded ? 'border-orange-200' : 'border-gray-200',
    },
  };

  const style = statusStyles[status];

  return (
    <Card className={`${style.border} transition-colors`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${style.iconBg} ${style.iconColor}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
        </div>
        <button className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
      {isExpanded && (
        <CardContent className="pt-0 border-t">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

interface WhatsAppSettingsContentProps {
  onConnected?: () => void;
}

/**
 * Shared WhatsApp settings content component
 * Used across dashboard/whatsapp, settings/whatsapp, and onboarding/whatsapp pages
 */
export function WhatsAppSettingsContent({ onConnected }: WhatsAppSettingsContentProps) {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'pt-BR';
  const { currentUser } = useAuth();
  const { currentClinic: clinic } = useClinic();
  const hasCalledOnConnected = useRef(false);

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    connection: true,
    businessProfile: false,
    qrCodes: false,
    templates: false,
    flows: false,
    disconnect: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const {
    status,
    isLoading,
    error,
    refetch,
    sync,
    disconnect,
    isSyncing,
    isDisconnecting,
  } = useMetaStatus(currentUser?.uid || '');

  // Call onConnected when WhatsApp becomes ready
  useEffect(() => {
    if (
      onConnected &&
      status?.whatsappStatus === 'READY' &&
      !hasCalledOnConnected.current
    ) {
      hasCalledOnConnected.current = true;
      onConnected();
    }
  }, [status?.whatsappStatus, onConnected]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-900">
            {t('settings.whatsapp.error') ||
              'Failed to load WhatsApp settings. Please try again.'}
          </p>
          <p className="text-sm text-red-700 mt-2">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  // No status yet
  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isDisconnected = status.whatsappStatus === 'DISCONNECTED';
  const isConnected = status.whatsappStatus === 'CONNECTED';
  const needsVerification = status.whatsappStatus === 'NEEDS_VERIFICATION';
  const isReady = status.whatsappStatus === 'READY';
  const phoneNumberId = status.meta?.phoneNumberId;

  return (
    <div className="space-y-6">
      {/* DISCONNECTED STATE: Show connect button */}
      {isDisconnected && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('settings.whatsapp.connectCard.title') ||
                'Connect WhatsApp Business Account'}
            </CardTitle>
            <CardDescription>
              {t('settings.whatsapp.connectCard.description') ||
                'Connect your Meta Business Manager to start using WhatsApp for your business'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectMetaButton
              onSuccess={() => {
                refetch();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* CONNECTED/NEEDS_VERIFICATION/READY: Show connection status */}
      {!isDisconnected && (
        <>
          {/* Connection Status - Collapsible */}
          <CollapsibleCard
            title={t('settings.whatsapp.connection.title') || 'Status da Conexão'}
            description={t('settings.whatsapp.connection.subtitle') || 'Detalhes da sua conta WhatsApp Business'}
            icon={<Wifi className="h-5 w-5" />}
            status={isReady ? 'ready' : needsVerification ? 'processing' : 'processing'}
            isExpanded={expandedSections.connection}
            onToggle={() => toggleSection('connection')}
          >
            <ConnectionStatusCardContent
              status={status}
              onSync={sync}
              isSyncing={isSyncing}
            />
          </CollapsibleCard>

          {/* Business Profile Section - Collapsible */}
          {phoneNumberId && (
            <CollapsibleCard
              title={t('whatsapp.businessProfile.title') || 'Perfil do Negócio'}
              description={t('whatsapp.businessProfile.description') || 'Configure como sua empresa aparece no WhatsApp'}
              icon={<User className="h-5 w-5" />}
              status="ready"
              isExpanded={expandedSections.businessProfile}
              onToggle={() => toggleSection('businessProfile')}
            >
              <BusinessProfileCardContent phoneNumberId={phoneNumberId} />
            </CollapsibleCard>
          )}

          {/* QR Codes Section - Collapsible */}
          {phoneNumberId && (
            <CollapsibleCard
              title={t('whatsapp.qrCodes.title') || 'QR Codes'}
              description={t('whatsapp.qrCodes.description') || 'Gere QR codes para iniciar conversas'}
              icon={<QrCode className="h-5 w-5" />}
              status="ready"
              isExpanded={expandedSections.qrCodes}
              onToggle={() => toggleSection('qrCodes')}
            >
              <QRCodesCardContent phoneNumberId={phoneNumberId} />
            </CollapsibleCard>
          )}

          {/* Message Templates Section - Collapsible */}
          {status.meta?.wabaId && (
            <CollapsibleCard
              title={t('whatsapp.templates.title') || 'Modelos de Mensagem'}
              description={t('whatsapp.templates.description') || 'Templates pré-aprovados pelo WhatsApp'}
              icon={<MessageSquare className="h-5 w-5" />}
              status="ready"
              isExpanded={expandedSections.templates}
              onToggle={() => toggleSection('templates')}
            >
              <TemplateStatusCardContent wabaId={status.meta.wabaId} />
            </CollapsibleCard>
          )}

          {/* WhatsApp Flows Section - Collapsible */}
          {status.meta?.wabaId && (
            <CollapsibleCard
              title={t('whatsapp.flows.title') || 'WhatsApp Flows'}
              description={t('whatsapp.flows.description') || 'Fluxos interativos de agendamento'}
              icon={<Workflow className="h-5 w-5" />}
              status="processing"
              isExpanded={expandedSections.flows}
              onToggle={() => toggleSection('flows')}
            >
              <FlowsStatusCardContent wabaId={status.meta.wabaId} />
            </CollapsibleCard>
          )}

          {/* Disconnect Section - Collapsible */}
          <CollapsibleCard
            title={t('settings.whatsapp.disconnect.sectionTitle') || 'Desconectar'}
            description={t('settings.whatsapp.disconnect.sectionDescription') || 'Desconecte sua conta do WhatsApp Business'}
            icon={<LogOut className="h-5 w-5" />}
            status="missing"
            isExpanded={expandedSections.disconnect}
            onToggle={() => toggleSection('disconnect')}
          >
            <div className="pt-4">
              <DisconnectButton
                onDisconnect={async () => {
                  disconnect();
                }}
                isDisconnecting={isDisconnecting}
              />
            </div>
          </CollapsibleCard>
        </>
      )}
    </div>
  );
}
