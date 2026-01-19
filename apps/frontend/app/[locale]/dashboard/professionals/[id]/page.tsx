'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Camera, User, DollarSign, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessional, useProfessionals } from '@/hooks/use-professionals';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
}

export default function ProfessionalEditPage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const professionalId = params.id as string;

  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: professional, isLoading: professionalLoading } = useProfessional(
    clinic?.id || '',
    professionalId
  );
  const { update, remove } = useProfessionals(clinic?.id || '');

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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load professional data into form
  useEffect(() => {
    if (professional) {
      setFormData({
        name: professional.name || '',
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        appointmentDuration: professional.appointmentDuration || 30,
        consultationPrice: professional.consultationPrice || 0,
        active: professional.active ?? true,
        photoUrl: professional.photoUrl || '',
        bio: professional.bio || '',
      });
    }
  }, [professional]);

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
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      await update.mutateAsync({
        id: professionalId,
        data: formData,
      });
      toast.success('Profissional atualizado!');
      router.push(`/${locale}/dashboard/professionals`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar profissional');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(professionalId);
      toast.success('Profissional excluído!');
      router.push(`/${locale}/dashboard/professionals`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir profissional');
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

  if (clinicLoading || professionalLoading) {
    return <PageLoader message="Carregando profissional..." />;
  }

  if (!professional) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">Profissional não encontrado</h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/${locale}/dashboard/professionals`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
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
          <h1 className="text-2xl font-semibold text-gray-900">Editar Profissional</h1>
          <p className="text-gray-600 mt-1">Atualize as informações do profissional</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !formData.name}>
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

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Profissional</CardTitle>
          <CardDescription>
            Gerencie os dados e configurações deste profissional
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
                <Label htmlFor="specialty">Especialidade</Label>
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
              <Label htmlFor="email">E-mail</Label>
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
              <Label htmlFor="phone">Telefone</Label>
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
              <Label htmlFor="duration">Duração da Consulta</Label>
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
              <Label htmlFor="price">Valor da Consulta (R$)</Label>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O profissional <strong>{professional.name}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
