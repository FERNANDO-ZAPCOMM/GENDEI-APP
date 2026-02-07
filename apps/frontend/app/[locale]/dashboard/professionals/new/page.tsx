'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Camera, User, DollarSign, Save, Clock, Plus, Trash2, Briefcase, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessionals } from '@/hooks/use-professionals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageLoader } from '@/components/PageLoader';
import { filterSpecialties } from '@/lib/specialties';
import { useVertical } from '@/lib/vertical-provider';
import { uploadFile } from '@/lib/upload';
import type { WorkingHoursBackend } from '@/lib/clinic-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS_OF_WEEK = [
  { key: '0', label: 'Segunda' },
  { key: '1', label: 'Terça' },
  { key: '2', label: 'Quarta' },
  { key: '3', label: 'Quinta' },
  { key: '4', label: 'Sexta' },
  { key: '5', label: 'Sábado' },
  { key: '6', label: 'Domingo' },
];

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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

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

// Service type for the professional
interface ProfessionalService {
  id: string;
  name: string;
  duration: number;
  price: number;
}

type TabKey = 'personal' | 'contact' | 'services' | 'hours';

interface ProfessionalFormData {
  name: string;
  specialties: string[]; // Multiple specialties supported
  email: string;
  phone: string;
  appointmentDuration: number;
  consultationPrice: number;
  active: boolean;
  photoUrl: string;
  bio: string;
  workingHours: WorkingHoursBackend;
  services: ProfessionalService[];
}

export default function NewProfessionalPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { create } = useProfessionals(clinic?.id || '');

  // Redirect to clinic settings if profile isn't complete
  useEffect(() => {
    if (!clinicLoading && clinic) {
      const clinicData = clinic as any;
      const hasClinicProfile = !!(
        clinicData?.name &&
        clinicData?.name !== 'Nova Clínica' &&
        clinicData?.phone
      );
      if (!hasClinicProfile) {
        toast.error('Complete o perfil da clínica antes de adicionar profissionais');
        router.push(`/${locale}/dashboard/clinic`);
      }
    }
  }, [clinicLoading, clinic, router, locale]);

  // Get available specialties based on the clinic's vertical
  const vertical = useVertical();
  const availableSpecialties = filterSpecialties(vertical.specialties).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const [formData, setFormData] = useState<ProfessionalFormData>({
    name: '',
    specialties: [], // Multiple specialties
    email: '',
    phone: '',
    appointmentDuration: 30,
    consultationPrice: 0,
    active: true,
    photoUrl: '',
    bio: '',
    workingHours: {},
    services: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone change handler with formatting
  const handlePhoneChange = (value: string) => {
    setFormData({ ...formData, phone: formatPhone(value) });
  };

  // Email change handler with validation
  const handleEmailChange = (value: string) => {
    setFormData({ ...formData, email: value });
    if (value && !isValidEmail(value)) {
      setEmailError('Email inválido');
    } else {
      setEmailError('');
    }
  };

  // Service management
  const addService = () => {
    const newService: ProfessionalService = {
      id: Date.now().toString(),
      name: '',
      duration: 30,
      price: 0,
    };
    setFormData({ ...formData, services: [...formData.services, newService] });
  };

  const updateService = (id: string, updates: Partial<ProfessionalService>) => {
    setFormData({
      ...formData,
      services: formData.services.map(s => s.id === id ? { ...s, ...updates } : s),
    });
  };

  const removeService = (id: string) => {
    setFormData({
      ...formData,
      services: formData.services.filter(s => s.id !== id),
    });
  };

  const handleServicePriceChange = (id: string, value: string) => {
    const numericValue = value.replace(/[^\d,\.]/g, '').replace(',', '.');
    const price = parseFloat(numericValue) || 0;
    updateService(id, { price });
  };

  // Toggle working day on/off
  const toggleWorkingDay = (dayKey: string) => {
    setFormData(prev => {
      const newWorkingHours = { ...prev.workingHours };
      if (newWorkingHours[dayKey] && newWorkingHours[dayKey].length > 0) {
        // Turn off - remove the day
        delete newWorkingHours[dayKey];
      } else {
        // Turn on - add default hours (9-18)
        newWorkingHours[dayKey] = [{ start: '09:00', end: '18:00' }];
      }
      return { ...prev, workingHours: newWorkingHours };
    });
  };

  // Update working hours for a specific day
  const updateWorkingHours = (dayKey: string, start: string, end: string) => {
    setFormData(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [dayKey]: [{ start, end }],
      },
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file || !clinic?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const downloadURL = await uploadFile({
        file,
        creatorId: clinic.id,
        onProgress: () => {},
      });
      setFormData(prev => ({ ...prev, photoUrl: downloadURL }));
      toast.success('Foto enviada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar foto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.specialties || formData.specialties.length === 0) {
      toast.error('Selecione pelo menos uma especialidade');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('E-mail é obrigatório');
      return;
    }
    if (emailError) {
      toast.error('E-mail inválido');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Telefone é obrigatório');
      return;
    }
    if (!formData.appointmentDuration || formData.appointmentDuration <= 0) {
      toast.error('Duração da consulta é obrigatória');
      return;
    }
    if (!formData.consultationPrice || formData.consultationPrice <= 0) {
      toast.error('Valor da consulta é obrigatório');
      return;
    }
    // Validate working hours - at least one day must be configured
    const hasWorkingHours = Object.keys(formData.workingHours).length > 0;
    if (!hasWorkingHours) {
      toast.error('Configure pelo menos um dia de atendimento');
      return;
    }

    setIsSaving(true);
    try {
      await create.mutateAsync(formData);
      toast.success('Profissional adicionado!');
      router.push(`/${locale}/dashboard/professionals`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar profissional');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceChange = (value: string) => {
    const numericValue = value.replace(/[^\d,\.]/g, '').replace(',', '.');
    const price = parseFloat(numericValue) || 0;
    setFormData({ ...formData, consultationPrice: price });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check completion status for each tab
  const hasPersonalInfo = !!(formData.name && formData.specialties.length > 0);
  const hasContact = !!(formData.email && formData.phone && !emailError);
  const hasServices = !!(formData.consultationPrice > 0 && formData.appointmentDuration > 0);
  const hasHours = Object.keys(formData.workingHours).length > 0;

  // Check if all mandatory info is complete (required to be active)
  const canBeActive = hasPersonalInfo && hasContact && hasServices && hasHours;

  const completedTabs = [hasPersonalInfo, hasContact, hasServices, hasHours].filter(Boolean).length;

  const tabs: { key: TabKey; icon: React.ReactNode; label: string; completed: boolean }[] = [
    { key: 'personal', icon: <User className="h-4 w-4" />, label: 'Informações', completed: hasPersonalInfo },
    { key: 'contact', icon: <Phone className="h-4 w-4" />, label: 'Contato', completed: hasContact },
    { key: 'services', icon: <Briefcase className="h-4 w-4" />, label: 'Consultas', completed: hasServices },
    { key: 'hours', icon: <Clock className="h-4 w-4" />, label: 'Horários', completed: hasHours },
  ];

  if (clinicLoading) {
    return <PageLoader message="Carregando..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 page-transition">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/professionals`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Novo Profissional</h1>
          <p className="text-gray-600 mt-1">Adicione um novo profissional à sua clínica</p>
        </div>
      </div>

      {/* Main Card with Tabs */}
      <div className="w-full lg:w-3/4">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Dados do Profissional</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Complete as informações para cadastrar</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              {completedTabs}/4
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Horizontal Tabs */}
          <div className="flex flex-row gap-1 pb-2 border-b overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-shrink-0 sm:flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap relative',
                  activeTab === tab.key
                    ? tab.completed
                      ? 'border-2 border-green-500 bg-green-50 text-green-700'
                      : 'border-2 border-amber-400 bg-amber-50 text-amber-700'
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
                {!tab.completed && activeTab !== tab.key && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="h-[520px] sm:h-[560px] py-2 overflow-y-auto pr-1">
            {/* Personal Info Tab */}
            {activeTab === 'personal' && (
              <div className="space-y-4">
                {/* Profile Photo + Name */}
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-2 border-gray-200">
                        <AvatarImage src={formData.photoUrl} alt={formData.name || 'Foto'} />
                        <AvatarFallback className="text-lg bg-gray-100">
                          {formData.name ? getInitials(formData.name) : <User className="w-6 h-6 text-gray-400" />}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="absolute bottom-0 right-0 p-2 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        ) : (
                          <Camera className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Clique para foto</p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: formatName(e.target.value) })}
                        placeholder="Nome do profissional"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Especialidades <span className="text-red-500">*</span></Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSpecialties.map((specialty) => {
                          const isSelected = formData.specialties.includes(specialty.id);
                          return (
                            <button
                              key={specialty.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setFormData({
                                    ...formData,
                                    specialties: formData.specialties.filter(s => s !== specialty.id)
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    specialties: [...formData.specialties, specialty.id]
                                  });
                                }
                              }}
                              disabled={isSaving}
                              className={cn(
                                "px-3 py-1.5 text-sm rounded-full border transition-colors text-center",
                                isSelected
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                              )}
                            >
                              {specialty.name}
                            </button>
                          );
                        })}
                      </div>
                      {formData.specialties.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selecione pelo menos uma especialidade
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Sobre o profissional</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Breve descrição, formação, experiência..."
                    disabled={isSaving}
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Esta descrição pode ser exibida para os pacientes ao agendar
                  </p>
                </div>

                {/* Active Status */}
                <div className={cn(
                  "flex items-center justify-between p-4 border rounded-lg",
                  !canBeActive && "border-amber-200 bg-amber-50/50"
                )}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">Profissional ativo</Label>
                      {!canBeActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {canBeActive
                        ? 'Disponível para agendamentos'
                        : 'Complete todas as informações obrigatórias para ativar'}
                    </p>
                  </div>
                  <Switch
                    checked={formData.active && canBeActive}
                    onCheckedChange={(checked) => {
                      if (!canBeActive && checked) {
                        toast.error('Complete todas as informações obrigatórias antes de ativar o profissional');
                        return;
                      }
                      setFormData({ ...formData, active: checked });
                    }}
                    disabled={isSaving || !canBeActive}
                  />
                </div>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      disabled={isSaving}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="email@exemplo.com"
                      disabled={isSaving}
                      className={`pl-9 ${emailError ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {emailError && (
                    <p className="text-sm text-red-500">{emailError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Services Tab (Consultas Oferecidas) */}
            {activeTab === 'services' && (
              <div className="space-y-4">
                {/* Main consultation settings */}
                <div className="p-4 border rounded-lg bg-blue-50/50 border-blue-200">
                  <Label className="font-medium text-blue-800 mb-3 block">Consulta Principal</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duração <span className="text-red-500">*</span></Label>
                      <Select
                        value={String(formData.appointmentDuration)}
                        onValueChange={(value) => setFormData({ ...formData, appointmentDuration: parseInt(value) })}
                        disabled={isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a duração" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="20">20 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="40">40 minutos</SelectItem>
                          <SelectItem value="45">45 minutos</SelectItem>
                          <SelectItem value="50">50 minutos</SelectItem>
                          <SelectItem value="60">1 hora</SelectItem>
                          <SelectItem value="90">1h 30min</SelectItem>
                          <SelectItem value="120">2 horas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Valor (R$) <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="price"
                          type="text"
                          inputMode="decimal"
                          value={formData.consultationPrice || ''}
                          onChange={(e) => handlePriceChange(e.target.value)}
                          placeholder="150,00"
                          disabled={isSaving}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional services */}
                <div className="pt-2">
                  <Label className="font-medium mb-3 block">Serviços Adicionais</Label>
                  {formData.services.length === 0 ? (
                    <div className="text-center py-4 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground text-sm mb-2">Nenhum serviço adicional</p>
                      <Button type="button" variant="outline" size="sm" onClick={addService} disabled={isSaving}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Serviço
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.services.map((service, index) => (
                        <div key={service.id} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Serviço {index + 1}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeService(service.id)}
                              disabled={isSaving}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-sm">Nome</Label>
                              <Input
                                value={service.name}
                                onChange={(e) => updateService(service.id, { name: e.target.value })}
                                placeholder="Ex: Retorno"
                                disabled={isSaving}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm">Duração</Label>
                              <Select
                                value={String(service.duration)}
                                onValueChange={(value) => updateService(service.id, { duration: parseInt(value) })}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">15 min</SelectItem>
                                  <SelectItem value="20">20 min</SelectItem>
                                  <SelectItem value="30">30 min</SelectItem>
                                  <SelectItem value="45">45 min</SelectItem>
                                  <SelectItem value="60">1 hora</SelectItem>
                                  <SelectItem value="90">1h30</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm">Valor (R$)</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={service.price || ''}
                                  onChange={(e) => handleServicePriceChange(service.id, e.target.value)}
                                  placeholder="100"
                                  disabled={isSaving}
                                  className="pl-7 h-9"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addService} disabled={isSaving}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Outro
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hours Tab */}
            {activeTab === 'hours' && (
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isEnabled = formData.workingHours[day.key] && formData.workingHours[day.key].length > 0;
                  const hours = formData.workingHours[day.key]?.[0] || { start: '09:00', end: '18:00' };

                  return (
                    <div key={day.key} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-32">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => toggleWorkingDay(day.key)}
                            disabled={isSaving}
                          />
                          <Label className={`text-sm ${isEnabled ? 'font-medium' : 'text-muted-foreground'}`}>
                            {day.label}
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={hours.start}
                          onChange={(e) => updateWorkingHours(day.key, e.target.value, hours.end)}
                          disabled={isSaving || !isEnabled}
                          className={cn("w-28", !isEnabled && "opacity-50")}
                        />
                        <span className={cn("text-muted-foreground", !isEnabled && "opacity-50")}>às</span>
                        <Input
                          type="time"
                          value={hours.end}
                          onChange={(e) => updateWorkingHours(day.key, hours.start, e.target.value)}
                          disabled={isSaving || !isEnabled}
                          className={cn("w-28", !isEnabled && "opacity-50")}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground mt-2">
                  Os horários serão usados pelo agendamento automático via WhatsApp.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isSaving || !formData.name || formData.specialties.length === 0 || !formData.email || !formData.phone || !formData.consultationPrice}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </>
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}
