'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getNextStepUrl } from '@/hooks/use-onboarding';
import {
  Percent,
  Key,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { usePayments } from '@/hooks/use-payments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TypingDots } from '@/components/PageLoader';
import type { PaymentSettings } from '@/lib/clinic-types';

export default function PaymentsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';

  const { currentClinic, isLoading: clinicLoading, updateClinic } = useClinic();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(currentClinic?.id || '');

  const [settings, setSettings] = useState<PaymentSettings>({
    acceptsConvenio: false,
    convenioList: [],
    acceptsParticular: true,
    requiresDeposit: true, // Always enabled - business model charges 6% from signal
    depositPercentage: 30,
    pixKey: '',
    pixKeyType: 'cpf',
  });
  const [confirmPixKey, setConfirmPixKey] = useState('');
  const [pixKeyError, setPixKeyError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize settings from clinic data
  useEffect(() => {
    if (currentClinic) {
      const existingSettings = (currentClinic as unknown as { paymentSettings?: PaymentSettings }).paymentSettings;
      if (existingSettings) {
        // Always ensure requiresDeposit is true (business model requirement)
        setSettings({
          ...existingSettings,
          requiresDeposit: true,
        });
        // Pre-fill confirm field if pixKey already exists
        if (existingSettings.pixKey) {
          setConfirmPixKey(existingSettings.pixKey);
        }
      } else if (currentClinic.depositPercentage !== undefined) {
        setSettings((prev) => ({
          ...prev,
          requiresDeposit: true, // Always true
          depositPercentage: currentClinic.depositPercentage || 30,
        }));
      }
    }
  }, [currentClinic]);

  const updateSettings = (updates: Partial<PaymentSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    // Validate PIX key is required
    if (!settings.pixKey || !settings.pixKey.trim()) {
      setPixKeyError(t('paymentSettings.pixKeyRequired'));
      toast.error(t('paymentSettings.pixKeyRequiredDesc'));
      return;
    }

    // Validate PIX key confirmation
    if (settings.pixKey !== confirmPixKey) {
      setPixKeyError(t('paymentSettings.pixKeyMismatch'));
      toast.error(t('paymentSettings.pixKeyMismatchDesc'));
      return;
    }
    setPixKeyError('');

    setIsSaving(true);
    try {
      // Always ensure requiresDeposit is true (business model requirement)
      const settingsToSave = {
        ...settings,
        requiresDeposit: true,
      };
      await updateClinic.mutateAsync({
        paymentSettings: settingsToSave,
        pixKey: settings.pixKey, // Also save at root level for easier access
        depositPercentage: settings.depositPercentage, // Always save since deposit is always required
      } as Record<string, unknown>);
      toast.success(t('paymentSettings.savedSuccess'));

      // Redirect to WhatsApp page after saving
      router.push(getNextStepUrl('payments', locale));
    } catch {
      toast.error(t('paymentSettings.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'BRL' });

  const formatDateTime = (raw?: string | Date | Record<string, unknown>) => {
    if (!raw) return '-';
    const value = typeof raw === 'string' ? raw : '';
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const statusLabel = (status: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed' || normalized === 'paid') return 'Pago';
    if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled') return 'Falhou';
    if (normalized === 'expired') return 'Expirado';
    return 'Pendente';
  };

  const statusVariant = (status: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed' || normalized === 'paid') return 'default';
    if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled' || normalized === 'expired') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('paymentSettings.title')}</h1>
        <p className="text-gray-600 mt-1">{t('paymentSettings.description')}</p>
      </div>

      {/* Content wrapper - 75% width on large screens */}
      <div className="w-full lg:w-3/4 space-y-6">
      {/* Deposit Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="w-4 h-4" />
            {t('paymentSettings.depositCard.title')}
          </CardTitle>
          <CardDescription>{t('paymentSettings.depositCard.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg border-green-200 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">{t('paymentSettings.depositRequired')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('paymentSettings.depositDesc')}
                </p>
              </div>
              <Badge variant="default" className="bg-green-600">{t('paymentSettings.active')}</Badge>
            </div>

            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('paymentSettings.depositPercentage')}</Label>
                <Select
                  value={String(settings.depositPercentage)}
                  onValueChange={(value) => updateSettings({ depositPercentage: Number(value) })}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full max-w-[200px]">
                    <SelectValue placeholder={t('paymentSettings.selectPercentage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="30">30%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('paymentSettings.depositHelp')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PIX Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            {t('paymentSettings.pixCard.title')}
            <span className="text-red-500">*</span>
          </CardTitle>
          <CardDescription>{t('paymentSettings.pixCard.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de Chave - alone at top, same width as fields below */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pixKeyType">
                {t('paymentSettings.pixCard.keyType')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={settings.pixKeyType || 'cpf'}
                onValueChange={(value) => updateSettings({ pixKeyType: value as PaymentSettings['pixKeyType'] })}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('paymentSettings.pixCard.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">{t('paymentSettings.pixCard.phone')}</SelectItem>
                  <SelectItem value="random">{t('paymentSettings.pixCard.randomKey')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chave PIX and Confirmation - side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pixKey">
                {t('paymentSettings.pixCard.pixKey')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pixKey"
                placeholder={
                  settings.pixKeyType === 'cpf' ? '000.000.000-00' :
                  settings.pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                  settings.pixKeyType === 'email' ? 'exemplo@email.com' :
                  settings.pixKeyType === 'phone' ? '+55 11 99999-9999' :
                  t('paymentSettings.pixCard.randomKey')
                }
                value={settings.pixKey || ''}
                onChange={(e) => {
                  updateSettings({ pixKey: e.target.value });
                  setPixKeyError('');
                }}
                disabled={isSaving}
                className={pixKeyError ? 'border-red-500' : ''}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPixKey">
                {t('paymentSettings.pixCard.confirmPixKey')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPixKey"
                placeholder={t('paymentSettings.pixCard.confirmPlaceholder')}
                value={confirmPixKey}
                onChange={(e) => {
                  setConfirmPixKey(e.target.value);
                  setPixKeyError('');
                }}
                disabled={isSaving}
                className={pixKeyError ? 'border-red-500' : ''}
                required
              />
            </div>
          </div>
          {pixKeyError && (
            <p className="text-sm text-red-500">{pixKeyError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('paymentSettings.pixCard.help')}
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('common.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('common.save')}
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações</CardTitle>
          <CardDescription>
            Histórico de pagamentos com método, fonte e modo de transferência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="py-10 flex items-center justify-center">
              <TypingDots />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Transferência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                    <TableCell>{formatMoney(payment.amountCents || 0)}</TableCell>
                    <TableCell>{payment.paymentMethod === 'card' ? 'Cartão' : 'PIX'}</TableCell>
                    <TableCell className="uppercase text-xs">{payment.paymentSource || '-'}</TableCell>
                    <TableCell>{payment.transferMode === 'automatic' ? 'Automática' : 'Manual'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payment.paymentStatus) as any}>
                        {statusLabel(payment.paymentStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
