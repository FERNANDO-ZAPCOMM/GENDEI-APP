'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CreditCard, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { Button } from '@/components/ui/button';
import { TypingDots } from '@/components/PageLoader';
import { PaymentSettingsForm } from '@/components/settings/PaymentSettingsForm';
import type { PaymentSettings } from '@/lib/clinic-types';

export default function PaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const { currentClinic, isLoading: clinicLoading, updateClinic } = useClinic();
  const { nextStep, paymentComplete } = useOnboardingStatus();

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    acceptsConvenio: false,
    convenioList: [],
    acceptsParticular: true,
    requiresDeposit: false,
    depositPercentage: 30,
    pixKey: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize settings from clinic data
  useEffect(() => {
    if (currentClinic) {
      const existingSettings = (currentClinic as unknown as { paymentSettings?: PaymentSettings }).paymentSettings;
      if (existingSettings) {
        setPaymentSettings(existingSettings);
      } else if (currentClinic.depositPercentage !== undefined) {
        // Legacy: migrate from depositPercentage field
        setPaymentSettings((prev) => ({
          ...prev,
          requiresDeposit: currentClinic.depositPercentage! > 0,
          depositPercentage: currentClinic.depositPercentage || 30,
        }));
      }
    }
  }, [currentClinic]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClinic.mutateAsync({
        paymentSettings: paymentSettings,
        depositPercentage: paymentSettings.requiresDeposit ? paymentSettings.depositPercentage : 0,
      } as Record<string, unknown>);
      toast.success('Configurações de pagamento salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (nextStep && nextStep > 5) {
      router.push(`/${locale}/dashboard/whatsapp`);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Configurações de Pagamento
          </h1>
          <p className="text-muted-foreground">
            Configure as formas de pagamento e opções de cobrança
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
          {!paymentComplete && nextStep && nextStep >= 5 && (
            <Button variant="outline" onClick={handleContinue}>
              Próximo Passo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <PaymentSettingsForm
        initialSettings={paymentSettings}
        onChange={setPaymentSettings}
        disabled={isSaving}
      />

      {/* Save button at bottom for mobile */}
      <div className="flex justify-end pt-4 pb-8 lg:hidden">
        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
