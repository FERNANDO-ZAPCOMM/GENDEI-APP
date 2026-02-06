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
  Loader2,
  Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { getNextStepUrl } from '@/hooks/use-onboarding';
import { AddressAutocomplete, AddressDetails } from '@/components/AddressAutocomplete';
import { ClinicWhatsAppPreview } from '@/components/chat/ClinicWhatsAppPreview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ClinicAddress, PaymentSettings } from '@/lib/clinic-types';
import { useVertical } from '@/lib/vertical-provider';
import { X, CreditCard, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Days of the week - label/full are for parsing saved data, UI uses translations
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
type TabKey = 'basic' | 'contact' | 'location' | 'hours' | 'atendimento';

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

// Name formatting helper - capitalize first letter of each word
// Portuguese prepositions/articles stay lowercase (except when first word)
const LOWERCASE_WORDS = ['de', 'do', 'da', 'dos', 'das', 'com', 'e', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para'];
const formatName = (value: string): string => {
  return value
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && LOWERCASE_WORDS.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
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
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';
  const { currentClinic, isLoading, updateClinic, generateSummary } = useClinic();
  const vertical = useVertical();

  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    openingHours: '',
    greetingSummary: '',
  });
  const [dayHours, setDayHours] = useState<Record<DayKey, { enabled: boolean; open: string; close: string }>>({
    seg: { enabled: false, open: '08:00', close: '18:00' },
    ter: { enabled: false, open: '08:00', close: '18:00' },
    qua: { enabled: false, open: '08:00', close: '18:00' },
    qui: { enabled: false, open: '08:00', close: '18:00' },
    sex: { enabled: false, open: '08:00', close: '18:00' },
    sab: { enabled: false, open: '08:00', close: '18:00' },
    dom: { enabled: false, open: '08:00', close: '18:00' },
  });
  const [hoursConfigured, setHoursConfigured] = useState(false);
  const [addressData, setAddressData] = useState<ClinicAddress | undefined>();
  const [emailError, setEmailError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState({
    acceptsParticular: false,
    acceptsConvenio: false,
    convenioList: [] as string[],
  });
  const [newConvenio, setNewConvenio] = useState('');

  useEffect(() => {
    if (currentClinic) {
      const clinicData = currentClinic as any;

      setFormData({
        name: currentClinic.name || '',
        description: clinicData.description || '',
        address: currentClinic.address || currentClinic.addressData?.formatted || '',
        phone: currentClinic.phone || '',
        email: currentClinic.email || '',
        website: clinicData.website || '',
        openingHours: currentClinic.openingHours || '',
        greetingSummary: clinicData.greetingSummary || '',
      });
      setAddressData(currentClinic.addressData);

      // Load payment settings
      const existingPaymentSettings = (currentClinic as unknown as { paymentSettings?: PaymentSettings }).paymentSettings;
      if (existingPaymentSettings) {
        setPaymentSettings({
          acceptsParticular: existingPaymentSettings.acceptsParticular ?? true,
          acceptsConvenio: existingPaymentSettings.acceptsConvenio ?? false,
          convenioList: existingPaymentSettings.convenioList ?? [],
        });
      }

      // Parse opening hours - supports both old format and new per-day format
      if (currentClinic.openingHours) {
        const hoursStr = currentClinic.openingHours;
        const newDayHours = { ...dayHours };

        // Try to parse new format: "Seg: 08:00-18:00, Ter: 09:00-17:00, ..."
        const dayPatterns = hoursStr.match(/([A-Za-zá]+):\s*(\d{2}:\d{2})-(\d{2}:\d{2})/g);
        if (dayPatterns && dayPatterns.length > 0) {
          dayPatterns.forEach((pattern) => {
            const match = pattern.match(/([A-Za-zá]+):\s*(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (match) {
              const dayName = match[1].toLowerCase();
              const dayKey = DAYS.find(d => d.label.toLowerCase() === dayName || d.full.toLowerCase() === dayName)?.key;
              if (dayKey) {
                newDayHours[dayKey] = { enabled: true, open: match[2], close: match[3] };
              }
            }
          });
        } else {
          // Fallback: parse old format with single time for all days
          const match = hoursStr.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
          const defaultOpen = match ? match[1] : '08:00';
          const defaultClose = match ? match[2] : '18:00';

          const isSegSex = hoursStr.includes('Seg-Sex');
          const isSegSab = hoursStr.includes('Seg-Sáb') || hoursStr.includes('Seg-Sab');
          const isTodos = hoursStr.includes('Todos');

          if (hoursStr.includes('Seg') || isTodos) newDayHours.seg = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Ter') || isSegSex || isSegSab || isTodos) newDayHours.ter = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Qua') || isSegSex || isSegSab || isTodos) newDayHours.qua = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Qui') || isSegSex || isSegSab || isTodos) newDayHours.qui = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Sex') || isSegSex || isSegSab || isTodos) newDayHours.sex = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Sáb') || hoursStr.includes('Sab') || isSegSab || isTodos) newDayHours.sab = { enabled: true, open: defaultOpen, close: defaultClose };
          if (hoursStr.includes('Dom') || isTodos) newDayHours.dom = { enabled: true, open: defaultOpen, close: defaultClose };
        }

        setDayHours(newDayHours);
        setHoursConfigured(Object.values(newDayHours).some(d => d.enabled));
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
      setEmailError('invalid');
    } else {
      setEmailError('');
    }
  };

  const updateOpeningHoursFromDayHours = (hours: Record<DayKey, { enabled: boolean; open: string; close: string }>) => {
    const enabledDays = DAYS.filter(d => hours[d.key].enabled);
    if (enabledDays.length === 0) {
      setFormData((prev) => ({ ...prev, openingHours: '' }));
      setHoursConfigured(false);
      return;
    }
    // Format: "Seg: 08:00-18:00, Ter: 09:00-17:00, ..."
    const hoursStr = enabledDays
      .map(d => `${d.label}: ${hours[d.key].open}-${hours[d.key].close}`)
      .join(', ');
    setFormData((prev) => ({ ...prev, openingHours: hoursStr }));
    setHoursConfigured(true);
  };

  const handleDayToggle = (day: DayKey) => {
    const newDayHours = {
      ...dayHours,
      [day]: { ...dayHours[day], enabled: !dayHours[day].enabled }
    };
    setDayHours(newDayHours);
    updateOpeningHoursFromDayHours(newDayHours);
  };

  const handleDayTimeChange = (day: DayKey, type: 'open' | 'close', value: string) => {
    const newDayHours = {
      ...dayHours,
      [day]: { ...dayHours[day], [type]: value }
    };
    setDayHours(newDayHours);
    updateOpeningHoursFromDayHours(newDayHours);
  };

  const handleAddConvenio = () => {
    if (!newConvenio.trim()) return;
    if (paymentSettings.convenioList.includes(newConvenio.trim())) return;
    setPaymentSettings({
      ...paymentSettings,
      convenioList: [...paymentSettings.convenioList, newConvenio.trim()],
    });
    setNewConvenio('');
  };

  const handleRemoveConvenio = (convenio: string) => {
    setPaymentSettings({
      ...paymentSettings,
      convenioList: paymentSettings.convenioList.filter((c) => c !== convenio),
    });
  };

  const handleAddCommonConvenio = (convenio: string) => {
    if (paymentSettings.convenioList.includes(convenio)) return;
    setPaymentSettings({
      ...paymentSettings,
      convenioList: [...paymentSettings.convenioList, convenio],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (emailError) {
      toast.error(t('clinicPage.toasts.fixErrors'));
      return;
    }

    try {
      // Get existing payment settings to preserve PIX and deposit settings
      const existingPaymentSettings = (currentClinic as unknown as { paymentSettings?: PaymentSettings }).paymentSettings;
      const mergedPaymentSettings: PaymentSettings = {
        requiresDeposit: existingPaymentSettings?.requiresDeposit ?? true,
        depositPercentage: existingPaymentSettings?.depositPercentage ?? 30,
        pixKey: existingPaymentSettings?.pixKey,
        acceptsParticular: paymentSettings.acceptsParticular,
        acceptsConvenio: paymentSettings.acceptsConvenio,
        convenioList: paymentSettings.convenioList,
      };

      await updateClinic.mutateAsync({
        ...formData,
        vertical: vertical.slug,
        addressData,
        paymentSettings: mergedPaymentSettings,
      });
      toast.success(t('clinicPage.toasts.saveSuccess'));

      // Check if all tabs will be complete after this save
      const willHaveBasicInfo = !!(formData.name && formData.description);
      const willHaveContact = !!formData.phone;
      const willHaveLocation = !!(formData.address || addressData?.formatted);
      const willHaveHours = hoursConfigured && Object.values(dayHours).some(d => d.enabled);
      const willHaveAtendimento = paymentSettings.acceptsParticular || paymentSettings.acceptsConvenio;

      // If all tabs complete, redirect to payments page
      if (willHaveBasicInfo && willHaveContact && willHaveLocation && willHaveHours && willHaveAtendimento) {
        router.push(getNextStepUrl('clinic', locale));
      }
    } catch (error) {
      toast.error(t('clinicPage.toasts.saveError'));
    }
  };

  // Check completion status for each tab
  const hasBasicInfo = !!(formData.name && formData.description);
  const hasContact = !!(formData.phone);
  const hasLocation = !!(formData.address || addressData?.formatted || currentClinic?.addressData?.formatted);
  const hasHours = hoursConfigured && Object.values(dayHours).some(d => d.enabled);
  const hasAtendimento = paymentSettings.acceptsParticular || paymentSettings.acceptsConvenio;

  const completedTabs = [hasBasicInfo, hasContact, hasLocation, hasHours, hasAtendimento].filter(Boolean).length;

  const tabs: { key: TabKey; icon: React.ReactNode; label: string; completed: boolean }[] = [
    { key: 'basic', icon: <Info className="h-4 w-4" />, label: t('clinicPage.tabs.basic'), completed: hasBasicInfo },
    { key: 'contact', icon: <Phone className="h-4 w-4" />, label: t('clinicPage.tabs.contact'), completed: hasContact },
    { key: 'location', icon: <MapPin className="h-4 w-4" />, label: t('clinicPage.tabs.location'), completed: hasLocation },
    { key: 'hours', icon: <Clock className="h-4 w-4" />, label: t('clinicPage.tabs.hours'), completed: hasHours },
    { key: 'atendimento', icon: <CreditCard className="h-4 w-4" />, label: t('clinicPage.tabs.service'), completed: hasAtendimento },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">{t('clinicPage.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('clinicPage.description')}</p>
      </div>

      {/* Main Content - Side by side layout on desktop */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Side - Settings */}
        <div className="flex-1 space-y-6">
          {/* Business Profile Card */}
          <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{t('clinicPage.profileCard.title')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('clinicPage.profileCard.description')}</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              {completedTabs}/5
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Horizontal Tabs - scrollable on mobile */}
          <div className="flex flex-row gap-1 pb-2 border-b overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-shrink-0 sm:flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
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
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                ) : (
                  <span className="flex-shrink-0">{tab.icon}</span>
                )}
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <form id="clinic-form" onSubmit={handleSubmit}>
            <div className="h-[520px] sm:h-[560px] py-2 overflow-y-auto pr-1">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {t('clinicPage.basicInfo.nameLabel')} *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: formatName(e.target.value) })}
                      placeholder={t('clinicPage.basicInfo.namePlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('clinicPage.basicInfo.nameHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      {t('clinicPage.basicInfo.descriptionLabel')} *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('clinicPage.basicInfo.descriptionPlaceholder')}
                      rows={3}
                      maxLength={750}
                      className="resize-none min-h-[80px] sm:min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.description.length}/750
                    </p>
                  </div>

                  {/* AI Summary Generation */}
                  {formData.description.length >= 50 && (
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {t('clinicPage.basicInfo.summaryLabel')}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const result = await generateSummary.mutateAsync({
                                description: formData.description,
                                clinicName: formData.name,
                              });
                              setFormData({ ...formData, greetingSummary: result.summary });
                              toast.success(t('clinicPage.toasts.summaryGenerated'));
                            } catch (error) {
                              toast.error(t('clinicPage.toasts.summaryError'));
                            }
                          }}
                          disabled={generateSummary.isPending}
                        >
                          {generateSummary.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          {t('clinicPage.basicInfo.generateButton')}
                        </Button>
                      </div>
                      {formData.greetingSummary ? (
                        <div className="p-2 bg-white rounded border text-sm text-gray-700">
                          {formData.greetingSummary}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t('clinicPage.basicInfo.summaryHelp')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Contact Tab */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      {t('clinicPage.contact.phoneLabel')} *
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
                      {t('clinicPage.contact.emailLabel')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder={t('clinicPage.contact.emailPlaceholder')}
                      className={emailError ? 'border-red-500' : ''}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500">{t('clinicPage.contact.invalidEmail')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">
                      {t('clinicPage.contact.websiteLabel')}
                    </Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder={t('clinicPage.contact.websitePlaceholder')}
                    />
                  </div>
                </div>
              )}

              {/* Location Tab */}
              {activeTab === 'location' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">
                      {t('clinicPage.location.addressLabel')} *
                    </Label>
                    <AddressAutocomplete
                      value={formData.address}
                      addressData={addressData}
                      onChange={handleAddressChange}
                      placeholder={t('clinicPage.location.addressPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('clinicPage.location.addressHelp')}
                    </p>
                    {/* Show address details from local state OR from saved clinic data */}
                    <AddressDetails addressData={addressData || currentClinic?.addressData} />
                  </div>
                </div>
              )}

              {/* Hours Tab */}
              {activeTab === 'hours' && (
                <div className="space-y-2">
                  <Label className="text-sm">{t('clinicPage.hours.title')}</Label>
                  <div className="space-y-2">
                    {DAYS.map((day) => (
                      <div
                        key={day.key}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        <div className="w-28">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={dayHours[day.key].enabled}
                              onCheckedChange={() => handleDayToggle(day.key)}
                            />
                            <Label className={`text-sm ${dayHours[day.key].enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                              {t(`clinicPage.days.${day.key}Full`)}
                            </Label>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={dayHours[day.key].open}
                            onValueChange={(v) => handleDayTimeChange(day.key, 'open', v)}
                            disabled={!dayHours[day.key].enabled}
                          >
                            <SelectTrigger className={cn("w-[90px] h-8 text-sm", !dayHours[day.key].enabled && "opacity-50")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className={cn("text-muted-foreground text-sm", !dayHours[day.key].enabled && "opacity-50")}>{t('clinicPage.hours.to')}</span>
                          <Select
                            value={dayHours[day.key].close}
                            onValueChange={(v) => handleDayTimeChange(day.key, 'close', v)}
                            disabled={!dayHours[day.key].enabled}
                          >
                            <SelectTrigger className={cn("w-[90px] h-8 text-sm", !dayHours[day.key].enabled && "opacity-50")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atendimento Tab */}
              {activeTab === 'atendimento' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('clinicPage.service.description')}
                  </p>

                  {/* Particular */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="font-medium">{t('clinicPage.service.particularLabel')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('clinicPage.service.particularDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={paymentSettings.acceptsParticular}
                      onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, acceptsParticular: checked })}
                    />
                  </div>

                  {/* Convênio - hidden for verticals that don't use it */}
                  {vertical.features.showConvenio && <div
                    className={cn(
                      'p-4 border rounded-lg transition-all',
                      paymentSettings.acceptsConvenio ? 'border-blue-200 bg-blue-50/30' : ''
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">{t('clinicPage.service.insuranceLabel')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('clinicPage.service.insuranceDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={paymentSettings.acceptsConvenio}
                        onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, acceptsConvenio: checked })}
                      />
                    </div>

                    {/* Convenio List */}
                    {paymentSettings.acceptsConvenio && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <Label className="text-sm">{t('clinicPage.service.acceptedInsurance')}</Label>

                        {/* Current convenios */}
                        {paymentSettings.convenioList.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {paymentSettings.convenioList.map((convenio) => (
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
                            placeholder={t('clinicPage.service.insurancePlaceholder')}
                            value={newConvenio}
                            onChange={(e) => setNewConvenio(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddConvenio())}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddConvenio}
                            disabled={!newConvenio.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Common convenios suggestions */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{t('clinicPage.service.suggestions')}:</p>
                          <div className="flex flex-wrap gap-1">
                            {COMMON_CONVENIOS.filter(
                              (c) => !paymentSettings.convenioList.includes(c)
                            ).map((convenio) => (
                              <Button
                                key={convenio}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleAddCommonConvenio(convenio)}
                              >
                                + {convenio}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>}
                </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" form="clinic-form" disabled={updateClinic.isPending}>
              {updateClinic.isPending ? (
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
        </div>

        {/* WhatsApp Preview - Hidden on mobile, sticky on desktop */}
        <div className="hidden lg:block w-[360px] flex-shrink-0">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('clinicPage.preview.title')}</CardTitle>
                <CardDescription>{t('clinicPage.preview.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <ClinicWhatsAppPreview
                  clinicData={{
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    openingHours: formData.openingHours,
                    address: formData.address,
                    addressData: addressData || currentClinic?.addressData,
                    greetingSummary: formData.greetingSummary,
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
