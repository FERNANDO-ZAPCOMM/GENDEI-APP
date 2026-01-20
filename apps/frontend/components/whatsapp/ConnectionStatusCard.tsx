'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Pencil } from 'lucide-react';
import type { WhatsAppStatus } from '@/lib/types';

/**
 * Format phone number for display (add spaces for readability)
 */
function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Format as: +X XXX XXX XXXX or similar
  if (digits.length >= 11) {
    const countryCode = digits.slice(0, digits.length - 10);
    const rest = digits.slice(-10);
    return `+${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return phone;
}

interface ConnectionStatusCardProps {
  status: WhatsAppStatus;
  onSync?: () => void;
  isSyncing?: boolean;
}

// Content-only version for use inside CollapsibleCard
export function ConnectionStatusCardContent({
  status,
  onSync,
  isSyncing = false,
}: ConnectionStatusCardProps) {
  const t = useTranslations();

  const hasBusinessManager = !!status.meta?.businessManagerId;
  const hasWABA = !!status.meta?.wabaId;
  const hasPhone = !!status.meta?.phoneNumberId;
  const isVerified = status.whatsappConfig?.isVerified || false;

  // Get the phone number for display
  const rawPhoneNumber = status.meta?.displayPhoneNumber || status.meta?.phoneNumber || '';
  const displayPhoneNumber = formatPhoneForDisplay(rawPhoneNumber);

  return (
    <div className="space-y-4 pt-4">
      {/* Sync button */}
      {onSync && (
        <div className="flex justify-end -mt-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}
        {/* Business Manager Status */}
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              {hasBusinessManager ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
              <span className="text-sm font-medium">
                {t('settings.whatsapp.connection.businessManager') ||
                  'Meta Business Manager'}
              </span>
            </div>
            {hasBusinessManager && status.meta?.businessManagerName && (
              <p className="text-sm text-gray-600 mt-1 ml-7">
                {status.meta.businessManagerName}
              </p>
            )}
          </div>
          {hasBusinessManager && (
            <span className="text-xs text-green-600 font-medium">Connected</span>
          )}
        </div>

        {/* WABA Status */}
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              {hasWABA ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
              <span className="text-sm font-medium">
                {t('settings.whatsapp.connection.waba') ||
                  'WhatsApp Business Account'}
              </span>
            </div>
            {hasWABA && status.meta?.wabaName && (
              <p className="text-sm text-gray-600 mt-1 ml-7">
                {status.meta.wabaName}
              </p>
            )}
          </div>
          {hasWABA && (
            <span className="text-xs text-green-600 font-medium">Connected</span>
          )}
        </div>

        {/* Phone Number Status */}
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              {hasPhone && isVerified ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : hasPhone ? (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
              <span className="text-sm font-medium">
                {t('settings.whatsapp.connection.phone') || 'Número de Telefone'}
              </span>
            </div>
            {hasPhone && (
              <div className="mt-1 ml-7">
                <p className="text-sm text-gray-600">
                  {displayPhoneNumber}
                </p>
              </div>
            )}
          </div>
          {hasPhone && (
            <span
              className={`text-xs font-medium ${
                isVerified ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {isVerified ? 'Verified' : 'Needs Verification'}
            </span>
          )}
        </div>

        {/* Display Name - Editable via WhatsApp Manager */}
        {hasPhone && (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">
                  {t('settings.whatsapp.connection.displayName') || 'Nome de Exibição'}
                </span>
              </div>
              <div className="mt-1 ml-7">
                <p className="text-sm text-gray-600">
                  {status.meta?.verifiedName || status.meta?.wabaName || t('settings.whatsapp.connection.displayNameNotSet') || 'Não configurado'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('settings.whatsapp.connection.displayNameHint') || 'O nome exibido nas conversas do WhatsApp'}
                </p>
              </div>
            </div>
            <a
              href={`https://business.facebook.com/wa/manage/phone-numbers/${status.meta?.businessManagerId ? `?business_id=${status.meta.businessManagerId}` : ''}${status.meta?.wabaId ? `&waba_id=${status.meta.wabaId}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" />
              {t('settings.whatsapp.connection.editDisplayName') || 'Editar'}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Connection Date */}
        {status.meta?.connectedAt && (
          <div className="pt-3 border-t">
            <p className="text-xs text-gray-500">
              {t('settings.whatsapp.connection.connectedAt') || 'Connected:'}{' '}
              {new Date(status.meta.connectedAt).toLocaleString()}
            </p>
          </div>
        )}
    </div>
  );
}

// Full card version (for backwards compatibility)
export function ConnectionStatusCard({
  status,
  onSync,
  isSyncing = false,
}: ConnectionStatusCardProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {t('settings.whatsapp.connection.title') || 'Connection Status'}
            </CardTitle>
            <CardDescription>
              {t('settings.whatsapp.connection.subtitle') ||
                'Your WhatsApp Business Account connection details'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ConnectionStatusCardContent status={status} onSync={onSync} isSyncing={isSyncing} />
      </CardContent>
    </Card>
  );
}
