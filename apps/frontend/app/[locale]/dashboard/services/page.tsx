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

const getModalityConfig = (t: (key: string) => string): Record<ServiceModality, { label: string; icon: any; color: string }> => ({
  presencial: { label: t('servicesPage.modality.presencial'), icon: MapPin, color: 'bg-blue-100 text-blue-700' },
  online: { label: t('servicesPage.modality.online'), icon: Video, color: 'bg-purple-100 text-purple-700' },
  ambos: { label: t('servicesPage.modality.both'), icon: MonitorSmartphone, color: 'bg-indigo-100 text-indigo-700' },
});

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
  t,
}: {
  clinicCategory?: string;
  onAddService: (template: ServiceTemplate) => void;
  onAddCustom: () => void;
  t: (key: string) => string;
}) {
  const suggestedServices = getSuggestedServices(clinicCategory || 'outro');

  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 mx-auto">
          <ClipboardList className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">{t('servicesPage.addServices')}</p>
      </div>

      {/* Suggested Services */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground">{t('servicesPage.suggestedServices')}</Label>
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
            {t('servicesPage.createCustom')}
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

  const modalityConfig = getModalityConfig(t);

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
      toast.error(t('servicesPage.nameRequired'));
      return;
    }

    try {
      if (editingService) {
        await update.mutateAsync({
          id: editingService.id,
          data: formData,
        });
        toast.success(t('servicesPage.updateSuccess'));
      } else {
        await create.mutateAsync(formData);
        toast.success(t('servicesPage.createSuccess'));
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || t('servicesPage.saveError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('servicesPage.deleteConfirm'))) return;

    try {
      await remove.mutateAsync(id);
      toast.success(t('servicesPage.deleteSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('servicesPage.deleteError'));
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
          <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">{t('servicesPage.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{t('servicesPage.description')}</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {t('servicesPage.newService')}
        </Button>
      </div>

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('servicesPage.listTitle')}</CardTitle>
          <CardDescription>
            {services.length === 0
              ? t('servicesPage.noneFound')
              : `${services.length} ${t('servicesPage.found')}`}
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
              t={t}
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
                            {service.active ? t('servicesPage.active') : t('servicesPage.inactive')}
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
                            {t('servicesPage.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('servicesPage.delete')}
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
                      <TableHead>{t('servicesPage.tableHeaders.name')}</TableHead>
                      <TableHead>{t('servicesPage.tableHeaders.modality')}</TableHead>
                      <TableHead>{t('servicesPage.tableHeaders.duration')}</TableHead>
                      <TableHead>{t('servicesPage.tableHeaders.price')}</TableHead>
                      <TableHead>{t('servicesPage.tableHeaders.status')}</TableHead>
                      <TableHead className="text-right">{t('servicesPage.tableHeaders.actions')}</TableHead>
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
                            {service.active ? t('servicesPage.active') : t('servicesPage.inactive')}
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
                                {t('servicesPage.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(service.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('servicesPage.delete')}
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
              {editingService ? t('servicesPage.dialog.editTitle') : t('servicesPage.dialog.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? t('servicesPage.dialog.editDesc')
                : t('servicesPage.dialog.newDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('servicesPage.dialog.nameLabel')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('servicesPage.dialog.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('servicesPage.dialog.descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('servicesPage.dialog.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modality">{t('servicesPage.dialog.modalityLabel')} *</Label>
              <Select
                value={formData.modality}
                onValueChange={(value: ServiceModality) => setFormData({ ...formData, modality: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('servicesPage.dialog.modalityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      {t('servicesPage.dialog.modalityPresencial')}
                    </div>
                  </SelectItem>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-600" />
                      {t('servicesPage.dialog.modalityOnline')}
                    </div>
                  </SelectItem>
                  <SelectItem value="ambos">
                    <div className="flex items-center gap-2">
                      <MonitorSmartphone className="w-4 h-4 text-indigo-600" />
                      {t('servicesPage.dialog.modalityBoth')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('servicesPage.dialog.modalityHelp')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">{t('servicesPage.dialog.durationLabel')}</Label>
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
                <Label htmlFor="price">{t('servicesPage.dialog.priceLabel')}</Label>
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
                  <Label htmlFor="requiresDeposit">{t('servicesPage.dialog.requireDeposit')}</Label>
                  <p className="text-xs text-muted-foreground">{t('servicesPage.dialog.requireDepositHelp')}</p>
                </div>
                <Switch
                  id="requiresDeposit"
                  checked={formData.requiresDeposit}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresDeposit: checked })}
                />
              </div>

              {formData.requiresDeposit && (
                <div className="space-y-2">
                  <Label htmlFor="depositAmount">{t('servicesPage.dialog.depositAmount')}</Label>
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
              <Label htmlFor="active">{t('servicesPage.dialog.serviceActive')}</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={create.isPending || update.isPending}
            >
              {create.isPending || update.isPending ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
