'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, MoreHorizontal, Pencil, Trash2, UserPlus, User, Clock, CheckCircle } from 'lucide-react';
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

interface ProfessionalFormData {
  name: string;
  specialty: string;
  email: string;
  phone: string;
  appointmentDuration: number;
  active: boolean;
}

const defaultFormData: ProfessionalFormData = {
  name: '',
  specialty: '',
  email: '',
  phone: '',
  appointmentDuration: 30,
  active: true,
};

export default function ProfessionalsPage() {
  const t = useTranslations();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: professionals, isLoading, create, update, remove } = useProfessionals(clinic?.id || '');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<any>(null);
  const [formData, setFormData] = useState<ProfessionalFormData>(defaultFormData);

  const stats = useMemo(() => ({
    total: professionals.length,
    active: professionals.filter(p => p.active).length,
  }), [professionals]);

  const handleOpenDialog = (professional?: any) => {
    if (professional) {
      setEditingProfessional(professional);
      setFormData({
        name: professional.name,
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        appointmentDuration: professional.appointmentDuration || 30,
        active: professional.active,
      });
    } else {
      setEditingProfessional(null);
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
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar profissional');
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

  if (clinicLoading || !clinic) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Profissionais</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os profissionais da sua clínica</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total de Profissionais</p>
                <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Ativos</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Professionals List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Profissionais</CardTitle>
          <CardDescription>
            {professionals.length === 0
              ? 'Nenhum profissional cadastrado'
              : `${professionals.length} profissional(is) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : professionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">Adicione seu primeiro profissional</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Profissional
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {professionals.map((professional) => (
                  <div key={professional.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{professional.name}</h3>
                        {professional.specialty && (
                          <p className="text-xs text-muted-foreground">{professional.specialty}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {professionals.map((professional) => (
                      <TableRow key={professional.id}>
                        <TableCell className="font-medium">{professional.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {professional.specialty || '-'}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3" />
                            {professional.appointmentDuration || 30}min
                          </span>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
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
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do profissional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="Ex: Clínico Geral, Dermatologista"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duração da Consulta (minutos)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.appointmentDuration}
                onChange={(e) => setFormData({ ...formData, appointmentDuration: parseInt(e.target.value) || 30 })}
                min={15}
                max={180}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Profissional ativo</Label>
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
              {create.isPending || update.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
