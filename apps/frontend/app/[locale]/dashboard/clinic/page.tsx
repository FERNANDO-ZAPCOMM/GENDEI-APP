'use client';

import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TypingDots } from '@/components/PageLoader';
import { Building2, Phone, Mail, Clock, Navigation, Globe } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AddressAutocomplete, AddressDetails } from '@/components/AddressAutocomplete';
import { ClinicWhatsAppPreview } from '@/components/chat/ClinicWhatsAppPreview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClinicAddress } from '@/lib/clinic-types';

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
  // For other combinations, list consecutive ranges
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
  if (!email) return true; // Empty is valid (not required)
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

  const [formData, setFormData] = useState({
    name: '',
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
        address: currentClinic.address || currentClinic.addressData?.formatted || '',
        phone: currentClinic.phone || '',
        email: currentClinic.email || '',
        website: (currentClinic as any).website || '',
        openingHours: currentClinic.openingHours || '',
      });
      setAddressData(currentClinic.addressData);

      // Parse opening hours if available (format: "Seg-Sex: 08:00-18:00")
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  // Data for the preview
  const daysStr = formatDaysString(selectedDays);
  const previewData = {
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    website: formData.website,
    openingHours: formData.openingHours || (daysStr ? `${daysStr}: ${openTime}-${closeTime}` : ''),
    address: formData.address,
    addressData: addressData,
  };

  // Show preview when there's at least a clinic name
  const showPreview = Boolean(formData.name?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Clínica</h1>
        <p className="text-muted-foreground">Gerencie as informações da sua clínica</p>
      </div>

      {/* Main Content - Side-by-side layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* Form Section */}
        <div>
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Informações Básicas
                </CardTitle>
                <CardDescription>
                  Dados de identificação e contato da clínica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Nome da Clínica
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Clínica São Paulo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefone
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
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
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
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://www.suaclinica.com.br"
                    />
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Horário de Funcionamento
                    </Label>

                    {/* Day selection */}
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <label
                          key={day.key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedDays[day.key]
                              ? 'bg-primary/10 border-primary text-primary'
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

                    {/* Time selection */}
                    <div className="flex items-center gap-3">
                      <Select value={openTime} onValueChange={(v) => handleTimeChange('open', v)}>
                        <SelectTrigger className="w-[110px]">
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
                        <SelectTrigger className="w-[110px]">
                          <SelectValue placeholder="Fechamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview of the formatted hours */}
                    {formData.openingHours && (
                      <p className="text-sm text-muted-foreground">
                        Resultado: <span className="font-medium text-foreground">{formData.openingHours}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Endereço Completo
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Digite o endereço e selecione da lista para obter as coordenadas automaticamente (usado para enviar localização no WhatsApp)
                  </p>
                  <AddressAutocomplete
                    value={formData.address}
                    addressData={addressData}
                    onChange={handleAddressChange}
                    placeholder="Rua, número, bairro - cidade/UF"
                  />
                  <AddressDetails addressData={addressData} />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateClinic.isPending}>
                    {updateClinic.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Preview Section - Sticky */}
        <div>
          <div style={{ position: 'sticky', top: '24px' }}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium">Preview do Assistente</CardTitle>
                <CardDescription>Veja como seu assistente aparecerá no WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {showPreview ? (
                  <ClinicWhatsAppPreview clinicData={previewData} />
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center w-full">
                    <FaWhatsapp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      Preencha o nome da clínica para ver o preview
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
