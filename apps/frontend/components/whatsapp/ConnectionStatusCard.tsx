'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Pencil, Save, X } from 'lucide-react';
import type { WhatsAppStatus } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

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
  const { getIdToken } = useAuth();

  const hasBusinessManager = !!status.meta?.businessManagerId;
  const hasWABA = !!status.meta?.wabaId;
  const hasPhone = !!status.meta?.phoneNumberId;
  const isVerified = status.whatsappConfig?.isVerified || false;
  const phoneNumberId = status.meta?.phoneNumberId;

  // Get the phone number for display
  const rawPhoneNumber = status.meta?.displayPhoneNumber || status.meta?.phoneNumber || '';
  const displayPhoneNumber = formatPhoneForDisplay(rawPhoneNumber);

  const [displayNameStatus, setDisplayNameStatus] = useState<{
    verified_name?: string;
    name_status?: string;
    new_display_name?: string;
    new_name_status?: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const effectiveDisplayName = useMemo(() => {
    return (
      displayNameStatus?.verified_name ||
      status.meta?.verifiedName ||
      status.meta?.wabaName ||
      t('settings.whatsapp.connection.displayNameNotSet') ||
      'Não configurado'
    );
  }, [displayNameStatus?.verified_name, status.meta?.verifiedName, status.meta?.wabaName, t]);

  const loadDisplayNameStatus = async () => {
    if (!phoneNumberId) return;
    const token = await getIdToken();
    if (!token) return;

    const response = await fetch(
      `/api/whatsapp/display-name?phoneNumberId=${phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('Display name status request failed', {
        status: response.status,
        errorBody,
      });
      const message =
        errorBody.error ||
        errorBody.message ||
        `Failed to fetch display name status (HTTP ${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    setDisplayNameStatus(data);
  };

  useEffect(() => {
    if (!hasPhone) return;
    loadDisplayNameStatus().catch((err) => {
      console.error('Failed to load display name status:', err);
    });
  }, [hasPhone, phoneNumberId]);

  const startEditing = () => {
    setNewDisplayName(
      displayNameStatus?.new_display_name ||
      displayNameStatus?.verified_name ||
      status.meta?.verifiedName ||
      ''
    );
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setNewDisplayName('');
  };

  const saveDisplayName = async () => {
    if (!phoneNumberId) return;
    const trimmed = newDisplayName.trim();
    if (!trimmed) {
      toast.error(t('settings.whatsapp.connection.displayNameEmpty') || 'Nome de exibição é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/display-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumberId,
          newDisplayName: trimmed,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update display name');
      }

      toast.success(t('settings.whatsapp.connection.displayNameUpdated') || 'Display name atualizado');
      await loadDisplayNameStatus();
      setIsEditing(false);
    } catch (err) {
      toast.error((err as Error).message || t('settings.whatsapp.connection.displayNameUpdateError') || 'Erro ao atualizar');
    } finally {
      setIsSaving(false);
    }
  };

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
                  {effectiveDisplayName}
                </p>
                {displayNameStatus?.name_status && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.whatsapp.connection.displayNameStatus') || 'Status'}: {displayNameStatus.name_status}
                  </p>
                )}
                {displayNameStatus?.new_display_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.whatsapp.connection.displayNamePending') || 'Novo nome'}: {displayNameStatus.new_display_name}
                    {displayNameStatus.new_name_status ? ` (${displayNameStatus.new_name_status})` : ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t('settings.whatsapp.connection.displayNameHint') || 'O nome exibido nas conversas do WhatsApp'}
                </p>
                {isEditing && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      maxLength={128}
                      placeholder={t('settings.whatsapp.connection.displayNamePlaceholder') || 'Digite o novo nome de exibição'}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveDisplayName} disabled={isSaving}>
                        {isSaving ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {t('settings.whatsapp.connection.displayNameSave') || 'Salvar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" />
                        {t('settings.whatsapp.connection.displayNameCancel') || 'Cancelar'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.whatsapp.connection.displayNameReviewHint') || 'Após salvar, o nome será revisado pelo WhatsApp.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {!isEditing && (
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="h-3 w-3 mr-2" />
                {t('settings.whatsapp.connection.editDisplayName') || 'Editar'}
              </Button>
            )}
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
