'use client';

import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TypingDots } from '@/components/PageLoader';
import {
  Phone,
  Clock,
  MapPin,
  Info,
  CheckCircle2,
  Save,
  Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AddressAutocomplete, AddressDetails } from '@/components/AddressAutocomplete';
import { ClinicWhatsAppPreview } from '@/components/chat/ClinicWhatsAppPreview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ClinicAddress } from '@/lib/clinic-types';
import { clinicCategories } from '@/lib/clinic-categories';

// Days of the week
const DAYS = [
  { key: 'seg', label: 'Seg', full: 'Segunda' },
  { key: 'ter', label: 'Ter', full: 'Terça' },
  { key: 'qua', label: 'Qua', full: 'Quarta' },
  { key: 'qui', label: 'Qui', full: 'Quinta' },
  { key: 'sex', label: 'Sex', full: 'Sexta' },
  { key: 'sab', label: 'Sáb', full: 'Sábado' },
  { key: 'dom', label: 'Dom', full: 'Domingo' },
] as const;

type DayKey = typeof DAYS[number]['key'];
type TabKey = 'basic' | 'contact' | 'location' | 'hours';

// Format selected days into readable string
const formatDaysString = (selectedDays: Record<DayKey, boolean>): string => {
  const enabledDays = DAYS.filter(d => selectedDays[d.key]);
  if (enabledDays.length === 0) return '';
  if (enabledDays.length === 7) return 'Todos os dias';
  if (enabledDays.length === 5 &&
      selectedDays.seg && selectedDays.ter && selectedDays.qua &&
      selectedDays.qui && selectedDays.sex && !selectedDays.sab && !selectedDays.dom) {
    return 'Seg-Sex';
  }
  if (enabledDays.length === 6 && !selectedDays.dom) {
    return 'Seg-Sáb';
  }
  return enabledDays.map(d => d.label).join(', ');
};

// Phone formatting helper
const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

// Email validation helper
const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate time options (every 30 min)
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

export default function ClinicSettingsPage() {
  const t = useTranslations();
  const { currentClinic, isLoading, updateClinic } = useClinic();

  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    openingHours: '',
  });
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [selectedDays, setSelectedDays] = useState<Record<DayKey, boolean>>({
    seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false,
  });
  const [addressData, setAddressData] = useState<ClinicAddress | undefined>();
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (currentClinic) {
      setFormData({
        name: currentClinic.name || '',
        category: (currentClinic as any).category || '',
        description: (currentClinic as any).description || '',
        address: currentClinic.address || currentClinic.addressData?.formatted || '',
        phone: currentClinic.phone || '',
        email: currentClinic.email || '',
        website: (currentClinic as any).website || '',
        openingHours: currentClinic.openingHours || '',
      });
      setAddressData(currentClinic.addressData);

      if (currentClinic.openingHours) {
        const match = currentClinic.openingHours.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        if (match) {
          setOpenTime(match[1]);
          setCloseTime(match[2]);
        }
      }
    }
  }, [currentClinic]);

  const handleAddressChange = (address: string, newAddressData: ClinicAddress | undefined) => {
    setFormData((prev) => ({ ...prev, address }));
    setAddressData(newAddressData);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setFormData((prev) => ({ ...prev, phone: formatted }));
  };

  const handleEmailChange = (value: string) => {
    setFormData((prev) => ({ ...prev, email: value }));
    if (value && !isValidEmail(value)) {
      setEmailError('Email inválido');
    } else {
      setEmailError('');
    }
  };

  const updateOpeningHours = (days: Record<DayKey, boolean>, open: string, close: string) => {
    const daysStr = formatDaysString(days);
    if (!daysStr) {
      setFormData((prev) => ({ ...prev, openingHours: '' }));
      return;
    }
    const newOpeningHours = `${daysStr}: ${open}-${close}`;
    setFormData((prev) => ({ ...prev, openingHours: newOpeningHours }));
  };

  const handleTimeChange = (type: 'open' | 'close', value: string) => {
    const newOpen = type === 'open' ? value : openTime;
    const newClose = type === 'close' ? value : closeTime;
    if (type === 'open') {
      setOpenTime(value);
    } else {
      setCloseTime(value);
    }
    updateOpeningHours(selectedDays, newOpen, newClose);
  };

  const handleDayToggle = (day: DayKey) => {
    const newDays = { ...selectedDays, [day]: !selectedDays[day] };
    setSelectedDays(newDays);
    updateOpeningHours(newDays, openTime, closeTime);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (emailError) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    try {
      await updateClinic.mutateAsync({
        ...formData,
        addressData,
      });
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  // Check completion status for each tab
  const hasBasicInfo = !!(formData.name && formData.category);
  const hasContact = !!(formData.phone);
  const hasLocation = !!(formData.address && addressData);
  const hasHours = !!(selectedDays && Object.values(selectedDays).some(Boolean));

  const completedTabs = [hasBasicInfo, hasContact, hasLocation, hasHours].filter(Boolean).length;

  const tabs: { key: TabKey; icon: React.ReactNode; label: string; completed: boolean }[] = [
    { key: 'basic', icon: <Info className="h-4 w-4" />, label: 'Informações', completed: hasBasicInfo },
    { key: 'contact', icon: <Phone className="h-4 w-4" />, label: 'Contato', completed: hasContact },
    { key: 'location', icon: <MapPin className="h-4 w-4" />, label: 'Localização', completed: hasLocation },
    { key: 'hours', icon: <Clock className="h-4 w-4" />, label: 'Horários', completed: hasHours },
  ];

  if (isLoading) {
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
        <h1 className="text-3xl font-semibold text-gray-900">Configurações da Clínica</h1>
        <p className="text-gray-600 mt-1">Configure as informações do seu negócio</p>
      </div>

      {/* Main Content - Side by side layout */}
      <div className="flex gap-6">
        {/* Business Profile Card */}
        <Card className="flex-1 max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Perfil do Negócio</CardTitle>
              <CardDescription>Complete as informações para aparecer corretamente</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              {completedTabs}/4 completos
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Horizontal Tabs */}
          <div className="flex flex-row gap-1 pb-2 border-b overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? tab.completed
                      ? 'border-2 border-green-500 bg-green-50 text-green-700'
                      : 'border-2 border-gray-400 bg-gray-100 text-gray-700'
                    : tab.completed
                      ? 'border border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                      : 'border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {tab.completed && activeTab !== tab.key ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <span className="flex-shrink-0">{tab.icon}</span>
                )}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <form onSubmit={handleSubmit}>
            <div className="min-h-[280px] py-2">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Nome do Negócio *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Clínica São Paulo"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use o nome oficial como aparece na fachada
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">
                      Categoria *
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinicCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Descrição
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva os serviços oferecidos..."
                      rows={4}
                      maxLength={750}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.description.length}/750
                    </p>
                  </div>
                </div>
              )}

              {/* Contact Tab */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      Telefone *
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="contato@clinica.com"
                      className={emailError ? 'border-red-500' : ''}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500">{emailError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://www.suaclinica.com.br"
                    />
                  </div>
                </div>
              )}

              {/* Location Tab */}
              {activeTab === 'location' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">
                      Endereço Completo *
                    </Label>
                    <AddressAutocomplete
                      value={formData.address}
                      addressData={addressData}
                      onChange={handleAddressChange}
                      placeholder="Digite o endereço e selecione da lista"
                    />
                    <p className="text-xs text-muted-foreground">
                      Selecione da lista para obter as coordenadas automaticamente
                    </p>
                    <AddressDetails addressData={addressData} />
                  </div>
                </div>
              )}

              {/* Hours Tab */}
              {activeTab === 'hours' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dias de Funcionamento</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <label
                          key={day.key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedDays[day.key]
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Checkbox
                            checked={selectedDays[day.key]}
                            onCheckedChange={() => handleDayToggle(day.key)}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <div className="flex items-center gap-3">
                      <Select value={openTime} onValueChange={(v) => handleTimeChange('open', v)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Abertura" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">até</span>
                      <Select value={closeTime} onValueChange={(v) => handleTimeChange('close', v)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Fechamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.openingHours && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Resumo: </span>
                        <span className="font-medium">{formData.openingHours}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <Button type="submit" disabled={updateClinic.isPending}>
              {updateClinic.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                t('common.save') || 'Salvar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

        {/* WhatsApp Preview - Right side, sticky */}
        <div className="hidden lg:block w-[360px] flex-shrink-0">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle>Prévia do WhatsApp</CardTitle>
                <CardDescription>Como seu bot aparece para os pacientes</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <ClinicWhatsAppPreview
                  clinicData={{
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    openingHours: formData.openingHours || (formatDaysString(selectedDays) ? `${formatDaysString(selectedDays)}: ${openTime}-${closeTime}` : ''),
                    address: formData.address,
                    addressData: addressData,
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
