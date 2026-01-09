'use client';

import { useState, useEffect } from 'react';
import { Plus, X, CreditCard, Percent, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { PaymentSettings } from '@/lib/clinic-types';

interface PaymentSettingsFormProps {
  initialSettings?: Partial<PaymentSettings>;
  onChange: (settings: PaymentSettings) => void;
  disabled?: boolean;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  acceptsConvenio: false,
  convenioList: [],
  acceptsParticular: true,
  requiresDeposit: false,
  depositPercentage: 30,
  pixKey: '',
};

const COMMON_CONVENIOS = [
  'Unimed',
  'Bradesco Saúde',
  'SulAmérica',
  'Amil',
  'NotreDame Intermédica',
  'Hapvida',
  'Porto Seguro',
  'Cassi',
  'Geap',
  'São Francisco',
];

export function PaymentSettingsForm({
  initialSettings,
  onChange,
  disabled = false,
}: PaymentSettingsFormProps) {
  const [settings, setSettings] = useState<PaymentSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [newConvenio, setNewConvenio] = useState('');

  useEffect(() => {
    if (initialSettings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...initialSettings,
      });
    }
  }, [initialSettings]);

  const updateSettings = (updates: Partial<PaymentSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    onChange(newSettings);
  };

  const handleAddConvenio = () => {
    if (!newConvenio.trim()) return;
    if (settings.convenioList.includes(newConvenio.trim())) return;

    updateSettings({
      convenioList: [...settings.convenioList, newConvenio.trim()],
    });
    setNewConvenio('');
  };

  const handleRemoveConvenio = (convenio: string) => {
    updateSettings({
      convenioList: settings.convenioList.filter((c) => c !== convenio),
    });
  };

  const handleAddCommonConvenio = (convenio: string) => {
    if (settings.convenioList.includes(convenio)) return;
    updateSettings({
      convenioList: [...settings.convenioList, convenio],
    });
  };

  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Formas de Pagamento
          </CardTitle>
          <CardDescription>
            Selecione as formas de pagamento aceitas pela clínica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Particular */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">Particular</Label>
              <p className="text-sm text-muted-foreground">
                Aceita pagamento direto do paciente
              </p>
            </div>
            <Switch
              checked={settings.acceptsParticular}
              onCheckedChange={(checked) => updateSettings({ acceptsParticular: checked })}
              disabled={disabled}
            />
          </div>

          {/* Convênio */}
          <div
            className={cn(
              'p-4 border rounded-lg transition-all',
              settings.acceptsConvenio ? 'border-blue-200 bg-blue-50/30' : ''
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Convênio</Label>
                <p className="text-sm text-muted-foreground">
                  Aceita planos de saúde
                </p>
              </div>
              <Switch
                checked={settings.acceptsConvenio}
                onCheckedChange={(checked) => updateSettings({ acceptsConvenio: checked })}
                disabled={disabled}
              />
            </div>

            {/* Convenio List */}
            {settings.acceptsConvenio && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <Label className="text-sm">Convênios Aceitos</Label>

                {/* Current convenios */}
                {settings.convenioList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {settings.convenioList.map((convenio) => (
                      <Badge
                        key={convenio}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        {convenio}
                        <button
                          type="button"
                          onClick={() => handleRemoveConvenio(convenio)}
                          className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                          disabled={disabled}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Add convenio input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do convênio"
                    value={newConvenio}
                    onChange={(e) => setNewConvenio(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddConvenio()}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddConvenio}
                    disabled={disabled || !newConvenio.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Common convenios suggestions */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
                  <div className="flex flex-wrap gap-1">
                    {COMMON_CONVENIOS.filter(
                      (c) => !settings.convenioList.includes(c)
                    ).map((convenio) => (
                      <Button
                        key={convenio}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddCommonConvenio(convenio)}
                        disabled={disabled}
                      >
                        + {convenio}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deposit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="w-4 h-4" />
            Sinal / Depósito
          </CardTitle>
          <CardDescription>
            Configure se deseja solicitar um sinal para confirmar agendamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              'p-4 border rounded-lg transition-all',
              settings.requiresDeposit ? 'border-green-200 bg-green-50/30' : ''
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Exigir Sinal</Label>
                <p className="text-sm text-muted-foreground">
                  Solicitar pagamento antecipado para confirmar consulta
                </p>
              </div>
              <Switch
                checked={settings.requiresDeposit}
                onCheckedChange={(checked) => updateSettings({ requiresDeposit: checked })}
                disabled={disabled}
              />
            </div>

            {settings.requiresDeposit && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div>
                  <Label className="text-sm">Porcentagem do Sinal</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[settings.depositPercentage]}
                      onValueChange={([value]) =>
                        updateSettings({ depositPercentage: value })
                      }
                      min={10}
                      max={100}
                      step={5}
                      className="flex-1"
                      disabled={disabled}
                    />
                    <span className="w-16 text-center font-medium">
                      {settings.depositPercentage}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Porcentagem do valor da consulta a ser cobrada como sinal
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PIX Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Chave PIX
          </CardTitle>
          <CardDescription>
            Informe a chave PIX para recebimento de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="pixKey">Chave PIX</Label>
            <Input
              id="pixKey"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              value={settings.pixKey || ''}
              onChange={(e) => updateSettings({ pixKey: e.target.value })}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Esta chave será usada para gerar QR codes de pagamento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
