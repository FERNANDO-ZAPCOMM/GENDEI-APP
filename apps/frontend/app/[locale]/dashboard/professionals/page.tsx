'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, UserPlus, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessionals } from '@/hooks/use-professionals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getSpecialtyName, getSpecialtyNames, getProfessionalSpecialties } from '@/lib/specialties';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
  const { data: professionals, isLoading, remove } = useProfessionals(clinic?.id || '');

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional?')) return;

    try {
      await remove.mutateAsync(id);
      toast.success('Profissional excluído!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir profissional');
    }
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
    const profSpecialties = getProfessionalSpecialties(p);
    const matchesSpecialty = selectedSpecialty === 'all' || profSpecialties.includes(selectedSpecialty);
    return matchesStatus && matchesSpecialty;
  });

  // Get unique specialties from professionals (handles both old and new format)
  const usedSpecialties = [...new Set(
    professionals.flatMap(p => getProfessionalSpecialties(p))
  )].filter(Boolean);

  // Stats
  const activeProfessionals = professionals.filter(p => p.active);
  const inactiveProfessionals = professionals.filter(p => !p.active);

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">Profissionais</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os profissionais da sua clínica</p>
        </div>
        {hasProfessionals && (
          <Button onClick={() => router.push(`/${locale}/dashboard/professionals/new`)} className="w-full sm:w-auto">
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
        <Card>
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
            <p className="text-muted-foreground">
              Você ainda não tem profissionais cadastrados. Adicione seu primeiro profissional para começar a receber agendamentos.
            </p>
            <Button onClick={() => router.push(`/${locale}/dashboard/professionals/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Profissional
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
                          {getSpecialtyNames(getProfessionalSpecialties(professional)) || 'Sem especialidade'}
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

    </div>
  );
}
