'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useMetaStatus } from '@/hooks/use-meta-status';
import { useServices } from '@/hooks/use-services';
import { useClinic } from '@/hooks/use-clinic';
import { Loader2, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectMetaButton } from './ConnectMetaButton';
import { ConnectionStatusCard } from './ConnectionStatusCard';
import { DisconnectButton } from './DisconnectButton';
import { BusinessProfileCard } from './BusinessProfileCard';
import { QRCodesCard } from './QRCodesCard';
import { TemplateStatusCard } from './TemplateStatusCard';

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
  const { data: services } = useServices(clinic?.id || '');
  const hasCalledOnConnected = useRef(false);

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

  const hasServices = services && services.length > 0;

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
          {/* Alert to add first service when WhatsApp is connected but no services - TOP OF PAGE */}
          {isReady && !hasServices && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      {t('connections.whatsapp.addServiceAlert') || 'WhatsApp conectado! Agora adicione seu primeiro serviço para começar a agendar.'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/${locale}/dashboard/services`)}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 shrink-0"
                  >
                    {t('connections.whatsapp.addServiceButton') || 'Adicionar Serviço'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <ConnectionStatusCard
            status={status}
            onSync={sync}
            isSyncing={isSyncing}
          />

          {/*
            Note: Phone verification is handled during Meta's Embedded Signup flow.
            The NumberVerificationForm (SMS/Voice code) is no longer needed.
            The TestMessageForm has also been removed - users can test by sending messages directly.
          */}

          {/* Business Profile Section - Show when phone is connected */}
          {phoneNumberId && (
            <BusinessProfileCard phoneNumberId={phoneNumberId} />
          )}

          {/* QR Codes Section - Show when phone is connected */}
          {phoneNumberId && (
            <QRCodesCard phoneNumberId={phoneNumberId} />
          )}

          {/* Message Templates Section - Show when WABA is connected */}
          {status.meta?.wabaId && (
            <TemplateStatusCard wabaId={status.meta.wabaId} />
          )}

          {/* Disconnect Button */}
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-700">
                {t('settings.whatsapp.disconnect.sectionTitle') || 'Desconectar'}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('settings.whatsapp.disconnect.sectionDescription') ||
                  'Desconecte sua conta do WhatsApp Business se necessário'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DisconnectButton
                onDisconnect={async () => {
                  disconnect();
                }}
                isDisconnecting={isDisconnecting}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
