'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Loader2, UserPlus, Camera, User, DollarSign } from 'lucide-react';
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
};

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

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

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
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

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

  if (clinicLoading || !clinic) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasProfessionals = professionals.length > 0;

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
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Profissionais</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os profissionais da sua clínica</p>
        </div>
        {hasProfessionals && (
          <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Novo Profissional
          </Button>
        )}
      </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <Button onClick={handleInlineSubmit} disabled={isSaving || !formData.name}>
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

      {/* Professionals List - Show when professionals exist */}
      {hasProfessionals && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Lista de Profissionais</CardTitle>
            <CardDescription>
              {`${professionals.length} profissional(is) cadastrado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {professionals.map((professional) => (
                    <div key={professional.id} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={professional.photoUrl} alt={professional.name} />
                          <AvatarFallback className="text-sm bg-gray-100">
                            {getInitials(professional.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{professional.name}</h3>
                          {professional.specialty && (
                            <p className="text-xs text-muted-foreground">{getSpecialtyName(professional.specialty)}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                              <span className="text-xs font-medium text-green-600">
                                {formatPrice(professional.consultationPrice ?? 0)}
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(professional)}>
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
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Especialidade</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {professionals.map((professional) => (
                        <TableRow key={professional.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={professional.photoUrl} alt={professional.name} />
                                <AvatarFallback className="text-sm bg-gray-100">
                                  {getInitials(professional.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{professional.name}</p>
                                {professional.bio && (
                                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                    {professional.bio}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {professional.specialty ? getSpecialtyName(professional.specialty) : '-'}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm">
                              <Clock className="w-3 h-3" />
                              {professional.appointmentDuration || 30}min
                            </span>
                          </TableCell>
                          <TableCell>
                            {(professional.consultationPrice ?? 0) > 0 ? (
                              <span className="font-medium text-green-600">
                                {formatPrice(professional.consultationPrice ?? 0)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={professional.active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-100 border-0'
                            }>
                              {professional.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenDialog(professional)}>
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
              <Label htmlFor="dialog-specialty">Especialidade</Label>
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
                <Label htmlFor="dialog-email">E-mail</Label>
                <Input
                  id="dialog-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-phone">Telefone</Label>
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
                <Label htmlFor="dialog-duration">Duração</Label>
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
                <Label htmlFor="dialog-price">Valor (R$)</Label>
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
