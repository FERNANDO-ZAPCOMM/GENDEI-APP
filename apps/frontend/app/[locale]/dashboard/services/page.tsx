'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, MoreHorizontal, Pencil, Trash2, ClipboardList, Clock, Video, MapPin, MonitorSmartphone, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useServices } from '@/hooks/use-services';
import { getSuggestedServices, ServiceTemplate } from '@/lib/clinic-categories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

// Service modality type
type ServiceModality = 'presencial' | 'online' | 'ambos';

const modalityConfig: Record<ServiceModality, { label: string; icon: any; color: string }> = {
  presencial: { label: 'Presencial', icon: MapPin, color: 'bg-blue-100 text-blue-700' },
  online: { label: 'Online', icon: Video, color: 'bg-purple-100 text-purple-700' },
  ambos: { label: 'Presencial e Online', icon: MonitorSmartphone, color: 'bg-indigo-100 text-indigo-700' },
};

interface ServiceFormData {
  name: string;
  description: string;
  duration: number;
  price: number;
  requiresDeposit: boolean;
  depositAmount: number;
  modality: ServiceModality;
  active: boolean;
}

const defaultFormData: ServiceFormData = {
  name: '',
  description: '',
  duration: 30,
  price: 0,
  requiresDeposit: false,
  depositAmount: 0,
  modality: 'presencial',
  active: true,
};

// Suggested Services Section Component (convênio-style UI)
function SuggestedServicesSection({
  clinicCategory,
  onAddService,
  onAddCustom,
}: {
  clinicCategory?: string;
  onAddService: (template: ServiceTemplate) => void;
  onAddCustom: () => void;
}) {
  const suggestedServices = getSuggestedServices(clinicCategory || 'outro');

  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 mx-auto">
          <ClipboardList className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">Adicione serviços à sua clínica</p>
      </div>

      {/* Suggested Services */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground">Serviços sugeridos para sua clínica:</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedServices.map((template, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onAddService(template)}
                className="rounded-full hover:bg-primary/10 hover:border-primary"
              >
                <Plus className="w-3 h-3 mr-1" />
                {template.name}
                <span className="text-xs text-muted-foreground ml-1">
                  ({template.duration}min)
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <Button onClick={onAddCustom} variant="default" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Criar serviço personalizado
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const t = useTranslations();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: services, isLoading, create, update, remove } = useServices(clinic?.id || '');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [formData, setFormData] = useState<ServiceFormData>(defaultFormData);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenDialog = (service?: any) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || '',
        duration: service.duration || 30,
        price: service.price || 0,
        requiresDeposit: service.requiresDeposit || false,
        depositAmount: service.depositAmount || 0,
        modality: service.modality || 'presencial',
        active: service.active,
      });
    } else {
      setEditingService(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingService) {
        await update.mutateAsync({
          id: editingService.id,
          data: formData,
        });
        toast.success('Serviço atualizado!');
      } else {
        await create.mutateAsync(formData);
        toast.success('Serviço adicionado!');
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar serviço');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

    try {
      await remove.mutateAsync(id);
      toast.success('Serviço excluído!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir serviço');
    }
  };

  if (clinicLoading || !clinic) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">Serviços</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Configure os serviços oferecidos pela sua clínica</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Serviços</CardTitle>
          <CardDescription>
            {services.length === 0
              ? 'Nenhum serviço cadastrado'
              : `${services.length} serviço(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : services.length === 0 ? (
            <SuggestedServicesSection
              clinicCategory={(clinic as any).categories?.[0] || clinic.category}
              onAddService={(template) => {
                setFormData({
                  ...defaultFormData,
                  name: template.name,
                  duration: template.duration,
                  price: template.price,
                });
                setIsDialogOpen(true);
              }}
              onAddCustom={() => handleOpenDialog()}
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {services.map((service) => {
                  const modality = (service.modality || 'presencial') as ServiceModality;
                  const ModalityIcon = modalityConfig[modality].icon;
                  return (
                  <div key={service.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{service.name}</h3>
                        {service.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{service.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={service.active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-100 border-0 text-xs'
                          }>
                            {service.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge className={`${modalityConfig[modality].color} hover:${modalityConfig[modality].color} border-0 text-xs`}>
                            <ModalityIcon className="w-3 h-3 mr-1" />
                            {modalityConfig[modality].label}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {service.duration}min
                          </span>
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            {formatCurrency(service.price)}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(service)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => {
                      const modality = (service.modality || 'presencial') as ServiceModality;
                      const ModalityIcon = modalityConfig[modality].icon;
                      return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{service.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${modalityConfig[modality].color} hover:${modalityConfig[modality].color} border-0`}>
                            <ModalityIcon className="w-3 h-3 mr-1" />
                            {modalityConfig[modality].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3" />
                            {service.duration}min
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {formatCurrency(service.price)}
                        </TableCell>
                        <TableCell>
                          <Badge className={service.active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-100 border-0'
                          }>
                            {service.active ? 'Ativo' : 'Inativo'}
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
                              <DropdownMenuItem onClick={() => handleOpenDialog(service)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(service.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Atualize as informações do serviço'
                : 'Adicione um novo serviço à sua clínica'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Consulta Clínica"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o serviço..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modality">Modalidade *</Label>
              <Select
                value={formData.modality}
                onValueChange={(value: ServiceModality) => setFormData({ ...formData, modality: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Presencial
                    </div>
                  </SelectItem>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-600" />
                      Online (Telemedicina)
                    </div>
                  </SelectItem>
                  <SelectItem value="ambos">
                    <div className="flex items-center gap-2">
                      <MonitorSmartphone className="w-4 h-4 text-indigo-600" />
                      Presencial e Online
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define como o serviço pode ser realizado
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                  min={15}
                  max={180}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requiresDeposit">Exigir depósito</Label>
                  <p className="text-xs text-muted-foreground">Cobrar antecipadamente para confirmar</p>
                </div>
                <Switch
                  id="requiresDeposit"
                  checked={formData.requiresDeposit}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresDeposit: checked })}
                />
              </div>

              {formData.requiresDeposit && (
                <div className="space-y-2">
                  <Label htmlFor="depositAmount">Valor do depósito (R$)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    step="0.01"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Label htmlFor="active">Serviço ativo</Label>
              <Switch
                id="active"
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
              {create.isPending || update.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
