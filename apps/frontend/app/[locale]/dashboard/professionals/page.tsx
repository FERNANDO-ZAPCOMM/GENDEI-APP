'use client';

import { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Loader2, UserPlus, Camera, User, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessionals } from '@/hooks/use-professionals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { specialties, getSpecialtyName, filterSpecialties } from '@/lib/specialties';
import { getSpecialtiesForCategories } from '@/lib/clinic-categories';
import { uploadFile } from '@/lib/upload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WorkingHoursBackend {
  [dayKey: string]: { start: string; end: string }[];
}

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

// Default working hours: Monday to Friday 9-18
const defaultWorkingHours: WorkingHoursBackend = {
  '0': [{ start: '09:00', end: '18:00' }],
  '1': [{ start: '09:00', end: '18:00' }],
  '2': [{ start: '09:00', end: '18:00' }],
  '3': [{ start: '09:00', end: '18:00' }],
  '4': [{ start: '09:00', end: '18:00' }],
};

const defaultFormData: ProfessionalFormData = {
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
};

const DAYS_OF_WEEK = [
  { key: '0', label: 'Segunda-feira' },
  { key: '1', label: 'Terça-feira' },
  { key: '2', label: 'Quarta-feira' },
  { key: '3', label: 'Quinta-feira' },
  { key: '4', label: 'Sexta-feira' },
  { key: '5', label: 'Sábado' },
  { key: '6', label: 'Domingo' },
];

// Format price for display
const formatPrice = (price: number) => {
  if (!price) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

export default function ProfessionalsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: professionals, isLoading, create, update, remove } = useProfessionals(clinic?.id || '');

  // Get available specialties based on clinic categories
  const clinicCategories = (clinic as any)?.categories || [];
  const allowedSpecialtyIds = getSpecialtiesForCategories(clinicCategories);
  const availableSpecialties = filterSpecialties(allowedSpecialtyIds);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<any>(null);
  const [formData, setFormData] = useState<ProfessionalFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDialog = (professional?: any) => {
    if (professional) {
      setEditingProfessional(professional);
      setFormData({
        name: professional.name,
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        appointmentDuration: professional.appointmentDuration || 30,
        consultationPrice: professional.consultationPrice || 0,
        active: professional.active,
        photoUrl: professional.photoUrl || '',
        bio: professional.bio || '',
        workingHours: professional.workingHours || { ...defaultWorkingHours },
      });
    } else {
      setEditingProfessional(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handlePhotoUpload = async (file: File, isDialog: boolean = false) => {
    if (!file || !clinic?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const downloadURL = await uploadFile({
        file,
        creatorId: clinic.id,
        onProgress: (progress) => {
          // Could show progress if needed
        },
      });
      setFormData(prev => ({ ...prev, photoUrl: downloadURL }));
      toast.success('Foto enviada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar foto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Validate all required fields
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return false;
    }
    if (!formData.specialty) {
      toast.error('Especialidade é obrigatória');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('E-mail é obrigatório');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Telefone é obrigatório');
      return false;
    }
    if (!formData.appointmentDuration || formData.appointmentDuration <= 0) {
      toast.error('Duração da consulta é obrigatória');
      return false;
    }
    if (!formData.consultationPrice || formData.consultationPrice <= 0) {
      toast.error('Valor da consulta é obrigatório');
      return false;
    }
    // Validate working hours - at least one day must be configured
    const hasWorkingHours = Object.keys(formData.workingHours).length > 0;
    if (!hasWorkingHours) {
      toast.error('Configure pelo menos um dia de atendimento');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingProfessional) {
        await update.mutateAsync({
          id: editingProfessional.id,
          data: formData,
        });
        toast.success('Profissional atualizado!');
      } else {
        await create.mutateAsync(formData);
        toast.success('Profissional adicionado!');
      }
      setIsDialogOpen(false);
      setFormData(defaultFormData);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar profissional');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle inline form submission (when no professionals exist)
  const handleInlineSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await create.mutateAsync(formData);
      toast.success('Profissional adicionado!');
      setFormData(defaultFormData);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar profissional');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional?')) return;

    try {
      await remove.mutateAsync(id);
      toast.success('Profissional excluído!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir profissional');
    }
  };

  // Handle price input - accept only numbers
  const handlePriceChange = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d,\.]/g, '').replace(',', '.');
    const price = parseFloat(numericValue) || 0;
    setFormData({ ...formData, consultationPrice: price });
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Toggle working day on/off
  const toggleWorkingDay = (dayKey: string) => {
    setFormData(prev => {
      const newWorkingHours = { ...prev.workingHours };
      if (newWorkingHours[dayKey]) {
        delete newWorkingHours[dayKey];
      } else {
        newWorkingHours[dayKey] = [{ start: '09:00', end: '18:00' }];
      }
      return { ...prev, workingHours: newWorkingHours };
    });
  };

  // Update working hours for a day
  const updateWorkingHours = (dayKey: string, field: 'start' | 'end', value: string) => {
    setFormData(prev => {
      const newWorkingHours = { ...prev.workingHours };
      if (newWorkingHours[dayKey] && newWorkingHours[dayKey][0]) {
        newWorkingHours[dayKey] = [{ ...newWorkingHours[dayKey][0], [field]: value }];
      }
      return { ...prev, workingHours: newWorkingHours };
    });
  };

  // Filters state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  if (clinicLoading || !clinic) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasProfessionals = professionals.length > 0;

  // Filter professionals
  const filteredProfessionals = professionals.filter((p) => {
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.active : !p.active);
    const matchesSpecialty = selectedSpecialty === 'all' || p.specialty === selectedSpecialty;
    return matchesStatus && matchesSpecialty;
  });

  // Get unique specialties from professionals
  const usedSpecialties = [...new Set(professionals.map(p => p.specialty).filter((s): s is string => Boolean(s)))];

  // Stats
  const activeProfessionals = professionals.filter(p => p.active);
  const inactiveProfessionals = professionals.filter(p => !p.active);

  // Avatar upload component
  const AvatarUpload = ({ photoUrl, name, onFileSelect, isUploading, inputRef }: {
    photoUrl: string;
    name: string;
    onFileSelect: (file: File) => void;
    isUploading: boolean;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="w-16 h-16 border-2 border-gray-200">
          <AvatarImage src={photoUrl} alt={name || 'Foto'} />
          <AvatarFallback className="text-sm bg-gray-100">
            {name ? getInitials(name) : <User className="w-5 h-5 text-gray-400" />}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
          ) : (
            <Camera className="w-3 h-3 text-gray-500" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>
      <p className="text-xs text-muted-foreground">Clique para foto</p>
    </div>
  );

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">Profissionais</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os profissionais da sua clínica</p>
        </div>
        {hasProfessionals && (
          <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Novo Profissional
          </Button>
        )}
      </div>

      {/* Statistics Cards - Only show when professionals exist */}
      {hasProfessionals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total</p>
                  <p className="text-2xl font-bold text-blue-700">{professionals.length}</p>
                </div>
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Ativos</p>
                  <p className="text-2xl font-bold text-emerald-700">{activeProfessionals.length}</p>
                </div>
                <UserPlus className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Inativos</p>
                  <p className="text-2xl font-bold text-slate-600">{inactiveProfessionals.length}</p>
                </div>
                <User className="w-5 h-5 text-slate-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Especialidades</p>
                  <p className="text-2xl font-bold text-purple-700">{usedSpecialties.length}</p>
                </div>
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Professional Card - Show when no professionals */}
      {!hasProfessionals && !isLoading && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4" />
              Adicionar Profissional
            </CardTitle>
            <CardDescription>
              Cadastre o primeiro profissional da sua clínica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Photo + Name - inline */}
            <div className="flex items-start gap-4">
              <AvatarUpload
                photoUrl={formData.photoUrl}
                name={formData.name}
                onFileSelect={(file) => handlePhotoUpload(file, false)}
                isUploading={isUploadingPhoto}
                inputRef={fileInputRef}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do profissional"
                  disabled={isSaving}
                />
              </div>
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

            {/* Bio/Summary */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Working Hours Section */}
            <div className="space-y-3">
              <Label className="font-medium">
                Horários de Atendimento <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isActive = !!formData.workingHours[day.key];
                  const hours = formData.workingHours[day.key]?.[0];

                  return (
                    <div key={day.key} className="flex items-center gap-3 p-2 border rounded-lg">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleWorkingDay(day.key)}
                        disabled={isSaving}
                      />
                      <span className={`text-sm font-medium w-28 ${!isActive ? 'text-muted-foreground' : ''}`}>
                        {day.label}
                      </span>
                      {isActive && hours && (
                        <div className="flex items-center gap-2 ml-auto">
                          <Input
                            type="time"
                            value={hours.start}
                            onChange={(e) => updateWorkingHours(day.key, 'start', e.target.value)}
                            className="w-24 h-8 text-sm"
                            disabled={isSaving}
                          />
                          <span className="text-muted-foreground text-sm">até</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(e) => updateWorkingHours(day.key, 'end', e.target.value)}
                            className="w-24 h-8 text-sm"
                            disabled={isSaving}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione os dias e horários de atendimento do profissional
              </p>
            </div>

            <Button onClick={handleInlineSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Profissional
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Professionals List with Horizontal Filters - Show when professionals exist */}
      {hasProfessionals && (
        <>
          {/* Horizontal Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Status:</Label>
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ({professionals.length})</SelectItem>
                      <SelectItem value="active">Ativos ({activeProfessionals.length})</SelectItem>
                      <SelectItem value="inactive">Inativos ({inactiveProfessionals.length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {usedSpecialties.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Especialidade:</Label>
                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {usedSpecialties.map((specialty) => (
                          <SelectItem key={specialty} value={specialty}>
                            {getSpecialtyName(specialty)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(statusFilter !== 'all' || selectedSpecialty !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setSelectedSpecialty('all');
                    }}
                  >
                    Limpar Filtros
                  </Button>
                )}
                <div className="ml-auto text-sm text-muted-foreground">
                  {filteredProfessionals.length === professionals.length
                    ? `${professionals.length} profissional(is)`
                    : `${filteredProfessionals.length} de ${professionals.length}`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full-width Professionals List */}
          <Card className="h-[calc(100vh-320px)] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-base">Lista de Profissionais</CardTitle>
              <CardDescription>
                Gerencie sua equipe e visualize a agenda de cada profissional
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredProfessionals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <User className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhum profissional encontrado</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros para ver mais resultados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProfessionals.map((professional) => (
                    <div
                      key={professional.id}
                      className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/${locale}/dashboard/professionals/${professional.id}`)}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={professional.photoUrl} alt={professional.name} />
                        <AvatarFallback className="text-sm bg-gray-100">
                          {getInitials(professional.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{professional.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {professional.specialty ? getSpecialtyName(professional.specialty) : 'Sem especialidade'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <Badge className={professional.active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-100 border-0 text-xs'
                          }>
                            {professional.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {professional.appointmentDuration || 30}min
                          </span>
                          {(professional.consultationPrice ?? 0) > 0 && (
                            <span className="text-xs font-semibold text-emerald-600">
                              {formatPrice(professional.consultationPrice ?? 0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${locale}/dashboard/appointments?professional=${professional.id}`);
                        }}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Ver Agenda
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/dashboard/appointments?professional=${professional.id}`)}>
                            <Calendar className="w-4 h-4 mr-2" />
                            Ver Agenda
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/dashboard/professionals/${professional.id}`)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(professional.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Dialog - Only for editing existing professionals */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}
            </DialogTitle>
            <DialogDescription>
              {editingProfessional
                ? 'Atualize as informações do profissional'
                : 'Adicione um novo profissional à sua clínica'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Profile Photo + Name - inline */}
            <div className="flex items-start gap-4">
              <AvatarUpload
                photoUrl={formData.photoUrl}
                name={formData.name}
                onFileSelect={(file) => handlePhotoUpload(file, true)}
                isUploading={isUploadingPhoto}
                inputRef={dialogFileInputRef}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="dialog-name">Nome *</Label>
                <Input
                  id="dialog-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do profissional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-specialty">Especialidade <span className="text-red-500">*</span></Label>
              <Select
                value={formData.specialty}
                onValueChange={(value) => setFormData({ ...formData, specialty: value })}
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

            {/* Bio/Summary */}
            <div className="space-y-2">
              <Label htmlFor="dialog-bio">Sobre o profissional</Label>
              <Textarea
                id="dialog-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Breve descrição, formação, experiência..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-email">E-mail <span className="text-red-500">*</span></Label>
                <Input
                  id="dialog-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-phone">Telefone <span className="text-red-500">*</span></Label>
                <Input
                  id="dialog-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-duration">Duração <span className="text-red-500">*</span></Label>
                <Select
                  value={String(formData.appointmentDuration)}
                  onValueChange={(value) => setFormData({ ...formData, appointmentDuration: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Duração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="40">40 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="50">50 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h 30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-price">Valor (R$) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="dialog-price"
                    type="text"
                    inputMode="decimal"
                    value={formData.consultationPrice || ''}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="150,00"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="dialog-active">Profissional ativo</Label>
              <Switch
                id="dialog-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>

            {/* Working Hours Section in Dialog */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="font-medium">
                Horários de Atendimento <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {DAYS_OF_WEEK.map((day) => {
                  const isActive = !!formData.workingHours[day.key];
                  const hours = formData.workingHours[day.key]?.[0];

                  return (
                    <div key={day.key} className="flex items-center gap-2 p-2 border rounded-lg">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleWorkingDay(day.key)}
                      />
                      <span className={`text-xs font-medium w-16 ${!isActive ? 'text-muted-foreground' : ''}`}>
                        {day.label.substring(0, 3)}
                      </span>
                      {isActive && hours && (
                        <div className="flex items-center gap-1 ml-auto">
                          <Input
                            type="time"
                            value={hours.start}
                            onChange={(e) => updateWorkingHours(day.key, 'start', e.target.value)}
                            className="w-20 h-7 text-xs"
                          />
                          <span className="text-muted-foreground text-xs">-</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(e) => updateWorkingHours(day.key, 'end', e.target.value)}
                            className="w-20 h-7 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={create.isPending || update.isPending}
            >
              {create.isPending || update.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
