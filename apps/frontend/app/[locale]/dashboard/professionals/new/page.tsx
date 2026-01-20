'use client';

import { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Camera, User, DollarSign, Save, Clock } from 'lucide-react';
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
import { getSpecialtiesForCategories } from '@/lib/clinic-categories';
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
  { key: '0', label: 'Segunda-feira' },
  { key: '1', label: 'Terça-feira' },
  { key: '2', label: 'Quarta-feira' },
  { key: '3', label: 'Quinta-feira' },
  { key: '4', label: 'Sexta-feira' },
  { key: '5', label: 'Sábado' },
  { key: '6', label: 'Domingo' },
];

// Default working hours: Monday to Friday 9-18
const defaultWorkingHours: WorkingHoursBackend = {
  '0': [{ start: '09:00', end: '18:00' }],
  '1': [{ start: '09:00', end: '18:00' }],
  '2': [{ start: '09:00', end: '18:00' }],
  '3': [{ start: '09:00', end: '18:00' }],
  '4': [{ start: '09:00', end: '18:00' }],
};

interface ProfessionalFormData {
  name: string;
  specialty: string;
  email: string;
  phone: string;
  appointmentDuration: number;
  consultationPrice: number;
  active: boolean;
  photoUrl: string;
  bio: string;
  workingHours: WorkingHoursBackend;
}

export default function NewProfessionalPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { create } = useProfessionals(clinic?.id || '');

  // Get available specialties based on clinic categories
  const clinicCategories = (clinic as any)?.categories || [];
  const allowedSpecialtyIds = getSpecialtiesForCategories(clinicCategories);
  const availableSpecialties = filterSpecialties(allowedSpecialtyIds);

  const [formData, setFormData] = useState<ProfessionalFormData>({
    name: '',
    specialty: '',
    email: '',
    phone: '',
    appointmentDuration: 30,
    consultationPrice: 0,
    active: true,
    photoUrl: '',
    bio: '',
    workingHours: { ...defaultWorkingHours },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!formData.specialty) {
      toast.error('Especialidade é obrigatória');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('E-mail é obrigatório');
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

  if (clinicLoading) {
    return <PageLoader message="Carregando..." />;
  }

  return (
    <div className="space-y-6 page-transition">
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

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Profissional</CardTitle>
          <CardDescription>
            Preencha os dados do novo profissional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do profissional"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidade <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.specialty}
                  onValueChange={(value) => setFormData({ ...formData, specialty: value })}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSpecialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.id}>
                        {specialty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.specialty && (
                  <p className="text-xs text-muted-foreground">
                    {availableSpecialties.find((s) => s.id === formData.specialty)?.description}
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
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Esta descrição pode ser exibida para os pacientes ao agendar
            </p>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+55 11 99999-9999"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Appointment Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração da Consulta <span className="text-red-500">*</span></Label>
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
              <Label htmlFor="price">Valor da Consulta (R$) <span className="text-red-500">*</span></Label>
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

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">Profissional ativo</Label>
              <p className="text-sm text-muted-foreground">
                Disponível para agendamentos
              </p>
            </div>
            <Switch
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Working Hours Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horários de Atendimento
          </CardTitle>
          <CardDescription>
            Configure os dias e horários que este profissional atende
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {isEnabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={hours.start}
                      onChange={(e) => updateWorkingHours(day.key, e.target.value, hours.end)}
                      disabled={isSaving}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={hours.end}
                      onChange={(e) => updateWorkingHours(day.key, hours.start, e.target.value)}
                      disabled={isSaving}
                      className="w-28"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Não atende</span>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground mt-2">
            Os horários configurados serão usados pelo agendamento automático via WhatsApp.
          </p>
        </CardContent>
      </Card>

      {/* Save Button - Fixed at bottom */}
      <div className="flex justify-end pt-4 pb-6">
        <Button
          onClick={handleSubmit}
          disabled={isSaving || !formData.name || !formData.specialty || !formData.email || !formData.phone || !formData.consultationPrice}
          size="lg"
          className="min-w-[200px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Adicionar Profissional
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
