'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { getNextStepUrl } from '@/hooks/use-onboarding';
import {
  Percent,
  Loader2,
  Save,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { usePayments } from '@/hooks/use-payments';
import { useStripeConnect } from '@/hooks/use-stripe-connect';
import { useHeldPayments } from '@/hooks/use-held-payments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TypingDots } from '@/components/PageLoader';
import type { PaymentSettings } from '@/lib/clinic-types';

type SectionStatus = 'ready' | 'processing' | 'missing';

interface ExpandableCardProps {
  title: string;
  description?: string;
  icon: ReactNode;
  status: SectionStatus;
  isExpanded: boolean;
  onToggle: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
}

function ExpandableCard({
  title,
  description,
  icon,
  status,
  isExpanded,
  onToggle,
  headerRight,
  children,
}: ExpandableCardProps) {
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
  } as const;

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
        <div className="flex items-center gap-3 text-gray-500">
          {headerRight}
          <div className="p-1.5 rounded-full hover:bg-gray-100">
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
      </div>
      {isExpanded && (
        <CardContent className="pt-0 border-t">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export default function PaymentsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';

  const { currentClinic, isLoading: clinicLoading, updateClinic } = useClinic();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(currentClinic?.id || '');
  const {
    data: stripeStatus,
    isLoading: stripeLoading,
    refetch: refetchStripeStatus,
    startOnboarding,
    refreshOnboarding,
    isStarting,
    isRefreshing,
  } = useStripeConnect(currentClinic?.id || '');
  const {
    heldPayments,
    isLoading: heldLoading,
    transferHeld,
    isTransferring,
  } = useHeldPayments(currentClinic?.id || '');

  const [settings, setSettings] = useState<PaymentSettings>({
    acceptsConvenio: false,
    convenioList: [],
    acceptsParticular: true,
    requiresDeposit: true, // Always enabled - Gendei retains 5% of total consultation value
    depositPercentage: 30,
    pixKey: '',
    pixKeyType: 'cpf',
  });
  const [confirmPixKey, setConfirmPixKey] = useState('');
  const [pixKeyError, setPixKeyError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    stripe: true,
    pix: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
    const effectivePixKeyType = settings.pixKeyType || 'cpf';

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
        pixKeyType: effectivePixKeyType,
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

  const stripeState = stripeStatus?.state;
  const stripeConnected = Boolean(stripeState?.accountId);
  const stripeReadyForSplit = Boolean(
    stripeState?.onboardingComplete && stripeState?.chargesEnabled && stripeState?.payoutsEnabled
  );

  const openStripeOnboarding = (url: string) => {
    if (!url) return;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.assign(url);
    }
  };

  const handleStripeConnect = async () => {
    if (!currentClinic?.id) return;
    try {
      const response = await startOnboarding();
      openStripeOnboarding(response.onboardingUrl);
    } catch (error: any) {
      toast.error(error.message || 'Falha ao iniciar Stripe Connect');
    }
  };

  const handleStripeContinue = async () => {
    if (!currentClinic?.id) return;
    try {
      const response = await refreshOnboarding();
      openStripeOnboarding(response.onboardingUrl);
    } catch (error: any) {
      toast.error(error.message || 'Falha ao continuar onboarding Stripe');
    }
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
          <div className="p-4 border rounded-lg">
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

      {/* Stripe + PIX Cards */}
      <div className="space-y-6">
        {/* Stripe Connect Card */}
        <ExpandableCard
          title="Stripe Connect (Split de Pagamentos)"
          description="Conecte sua conta Stripe para receber pagamentos com divisão automática de repasses."
          icon={<ShieldCheck className="h-5 w-5" />}
          status={stripeReadyForSplit ? 'ready' : stripeConnected ? 'processing' : 'missing'}
          isExpanded={expandedSections.stripe}
          onToggle={() => toggleSection('stripe')}
          headerRight={<Image src="/stripe.png" alt="Stripe" width={64} height={20} className="h-5 w-auto object-contain" />}
        >
          <div className="space-y-4 py-4">
            {stripeLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TypingDots size="sm" /> Verificando status do Stripe Connect...
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {stripeReadyForSplit ? (
                    <Badge variant="default" className="bg-green-600">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Pronto para split
                    </Badge>
                  ) : stripeConnected ? (
                    <Badge variant="secondary">Conectado - onboarding pendente</Badge>
                  ) : (
                    <Badge variant="outline">Não conectado</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="font-medium">Conta Stripe</p>
                    <p className="text-muted-foreground mt-1 break-all">{stripeState?.accountId || '-'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="font-medium">Capacidades</p>
                    <p className="text-muted-foreground mt-1">
                      Cobrança: {stripeState?.chargesEnabled ? 'Ativa' : 'Pendente'} | Repasse:{' '}
                      {stripeState?.payoutsEnabled ? 'Ativo' : 'Pendente'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!stripeConnected && (
                    <Button
                      type="button"
                      onClick={handleStripeConnect}
                      disabled={isStarting}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>Conectar Stripe Connect</>
                      )}
                    </Button>
                  )}

                  {stripeConnected && !stripeReadyForSplit && (
                    <Button
                      type="button"
                      onClick={handleStripeContinue}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Abrindo...
                        </>
                      ) : (
                        <>
                          Continuar onboarding
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}

                  {stripeConnected && (
                    <Button type="button" variant="outline" onClick={() => refetchStripeStatus()}>
                      Atualizar status
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </ExpandableCard>

        {/* PIX Card */}
        <ExpandableCard
          title="Pagamento PIX"
          description={t('paymentSettings.pixCard.description')}
          icon={<Percent className="h-5 w-5" />}
          status="missing"
          isExpanded={expandedSections.pix}
          onToggle={() => toggleSection('pix')}
          headerRight={
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs uppercase tracking-wide">Em breve</Badge>
              <Image src="/pix.png" alt="PIX" width={48} height={20} className="h-5 w-auto object-contain" />
            </div>
          }
        >
          <div className="space-y-4 py-4 opacity-60 pointer-events-none">
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Configuração de Pagamento PIX disponível em breve.
            </div>
            <fieldset disabled className="space-y-4">
              {/* Chave PIX and Confirmation - side by side as before */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pixKey">
                    {t('paymentSettings.pixCard.pixKey')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pixKey"
                    placeholder={t('paymentSettings.pixCard.randomKey')}
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

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled>
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
            </fieldset>
          </div>
        </ExpandableCard>
      </div>

      {/* Held Payments Card - only show when there are held payments */}
      {heldPayments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Pagamentos retidos ({heldPayments.filter(p => p.status === 'held').length})
                </CardTitle>
                <CardDescription>
                  Pagamentos cobrados na conta Gendei aguardando transferencia para a clinica.
                </CardDescription>
              </div>
              {stripeReadyForSplit && heldPayments.some(p => p.status === 'held') && (
                <Button
                  onClick={async () => {
                    try {
                      const result = await transferHeld();
                      if (result.transferred > 0) {
                        toast.success(`${result.transferred} pagamento(s) transferido(s) com sucesso!`);
                      }
                      if (result.failed > 0) {
                        toast.error(`${result.failed} pagamento(s) falharam na transferencia.`);
                      }
                    } catch (error: any) {
                      toast.error(error.message || 'Erro ao transferir pagamentos');
                    }
                  }}
                  disabled={isTransferring}
                  size="sm"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Transferindo...
                    </>
                  ) : (
                    'Transferir para clinica'
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!stripeReadyForSplit && (
              <p className="text-sm text-amber-600 mb-4">
                Complete o onboarding do Stripe Connect acima para transferir estes pagamentos para a clinica.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>Taxa Gendei (5%)</TableHead>
                  <TableHead>Valor clinica</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {heldPayments.map((held) => (
                  <TableRow key={held.id}>
                    <TableCell>{held.patientName || held.patientPhone || '-'}</TableCell>
                    <TableCell>{formatMoney(held.amountCents)}</TableCell>
                    <TableCell>{formatMoney(held.applicationFeeCents)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(held.netAmountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={held.status === 'transferred' ? 'default' : 'secondary'}>
                        {held.status === 'held' ? 'Retido' : held.status === 'transferred' ? 'Transferido' : 'Reembolsado'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(held.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
