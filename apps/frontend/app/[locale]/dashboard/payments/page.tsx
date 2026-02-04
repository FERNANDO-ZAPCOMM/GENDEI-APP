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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TypingDots } from '@/components/PageLoader';
import type { PaymentSettings } from '@/lib/clinic-types';

export default function PaymentsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';

  const { currentClinic, isLoading: clinicLoading, updateClinic } = useClinic();

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
      setPixKeyError('A chave PIX é obrigatória');
      toast.error('A chave PIX é obrigatória para receber pagamentos.');
      return;
    }

    // Validate PIX key confirmation
    if (settings.pixKey !== confirmPixKey) {
      setPixKeyError('As chaves PIX não coincidem');
      toast.error('As chaves PIX não coincidem. Por favor, verifique.');
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
      toast.success('Configurações de pagamento salvas!');

      // Redirect to WhatsApp page after saving
      router.push(getNextStepUrl('payments', locale));
    } catch {
      toast.error('Erro ao salvar configurações');
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

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configurações de Pagamento</h1>
        <p className="text-gray-600 mt-1">Configure as formas de pagamento e opções de cobrança</p>
      </div>

      {/* Content wrapper - 75% width on large screens */}
      <div className="w-full lg:w-3/4 space-y-6">
      {/* Deposit Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="w-4 h-4" />
            Sinal / Depósito
          </CardTitle>
          <CardDescription>Configure o sinal para confirmar agendamentos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg border-green-200 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Sinal Obrigatório</Label>
                <p className="text-sm text-muted-foreground">
                  Pagamento antecipado para confirmar consulta
                </p>
              </div>
              <Badge variant="default" className="bg-green-600">Ativo</Badge>
            </div>

            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Porcentagem do Sinal</Label>
                <Select
                  value={String(settings.depositPercentage)}
                  onValueChange={(value) => updateSettings({ depositPercentage: Number(value) })}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full max-w-[200px]">
                    <SelectValue placeholder="Selecione a porcentagem" />
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
                  Porcentagem do valor da consulta a ser cobrada como sinal
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
            Chave PIX
            <span className="text-red-500">*</span>
          </CardTitle>
          <CardDescription>Informe a chave PIX para recebimento de pagamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de Chave - alone at top, same width as fields below */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pixKeyType">
                Tipo de Chave <span className="text-red-500">*</span>
              </Label>
              <Select
                value={settings.pixKeyType || 'cpf'}
                onValueChange={(value) => updateSettings({ pixKeyType: value as PaymentSettings['pixKeyType'] })}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chave PIX and Confirmation - side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pixKey">
                Chave PIX <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pixKey"
                placeholder={
                  settings.pixKeyType === 'cpf' ? '000.000.000-00' :
                  settings.pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                  settings.pixKeyType === 'email' ? 'exemplo@email.com' :
                  settings.pixKeyType === 'phone' ? '+55 11 99999-9999' :
                  'Chave aleatória'
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
                Confirme a Chave PIX <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPixKey"
                placeholder="Digite a chave PIX novamente"
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
            Esta chave será usada para gerar QR codes de pagamento. Digite duas vezes para confirmar.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('common.save') || 'Salvar'}
            </>
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}
