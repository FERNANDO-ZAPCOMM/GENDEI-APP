'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Users, Calendar, Phone, Mail, MoreHorizontal, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { usePatients } from '@/hooks/use-patients';
import { useProfessionals } from '@/hooks/use-professionals';
import { getSpecialtyName } from '@/lib/specialties';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getInitials(name: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function PatientsPage() {
  const t = useTranslations();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);

  const { data: professionals } = useProfessionals(clinic?.id || '');
  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.active),
    [professionals]
  );

  const filters = useMemo(() => {
    const f: { search?: string; professionalId?: string } = {};
    if (searchQuery) f.search = searchQuery;
    if (selectedProfessionalId) f.professionalId = selectedProfessionalId;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [searchQuery, selectedProfessionalId]);

  const { data: patients, isLoading, remove } = usePatients(
    clinic?.id || '',
    filters
  );

  const handleProfessionalSelect = (professionalId: string) => {
    setSelectedProfessionalId((prev) => (prev === professionalId ? null : professionalId));
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = patients.filter(p => {
      if (!p.createdAt) return false;
      const created = new Date(p.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });

    // Calculate patients with appointments
    const withAppointments = patients.filter(p => (p.totalAppointments || 0) > 0);

    return {
      total: patients.length,
      newThisMonth: thisMonth.length,
      withAppointments: withAppointments.length,
    };
  }, [patients]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return;

    try {
      await remove.mutateAsync(id);
      toast.success('Paciente excluído!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir paciente');
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
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">Pacientes</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os pacientes da sua clínica</p>
      </div>

      {/* Stats Cards Row - Desktop */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Total</p>
                  <p className="text-2xl font-bold text-indigo-700">{stats.total}</p>
                </div>
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Novos este Mês</p>
                  <p className="text-2xl font-bold text-emerald-700">{stats.newThisMonth}</p>
                </div>
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Com Consultas</p>
                <p className="text-2xl font-bold text-blue-700">{stats.withAppointments}</p>
              </div>
              <UserCheck className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Stats Cards */}
      <div className="lg:hidden grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-indigo-600 font-medium">Total</p>
              <p className="text-2xl font-bold text-indigo-700">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-emerald-600 font-medium">Novos</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.newThisMonth}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">Com Consultas</p>
              <p className="text-2xl font-bold text-blue-700">{stats.withAppointments}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout - Patient List aligned with Total+Novos, Filter aligned with Com Consultas */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        {/* Patient List spans 2 columns */}
        <Card className="col-span-2 h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Lista de Pacientes</CardTitle>
                <CardDescription>
                  {patients.length === 0
                    ? 'Nenhum paciente encontrado'
                    : `${patients.length} paciente(s)`}
                </CardDescription>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : patients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || selectedProfessionalId
                    ? 'Nenhum paciente encontrado'
                    : 'Pacientes serao adicionados via WhatsApp'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Consultas</TableHead>
                    <TableHead>Ultima Consulta</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.name}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {patient.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {patient.totalAppointments || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {patient.lastAppointmentAt
                          ? format(new Date(patient.lastAppointmentAt), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDelete(patient.id)}
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
            )}
          </CardContent>
        </Card>

        {/* Professional Filter - aligned with Com Consultas */}
        <Card className="h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-base">Por Profissional</CardTitle>
            <CardDescription>
              {selectedProfessionalId
                ? 'Clique para limpar filtro'
                : 'Selecione para filtrar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 flex-1 overflow-y-auto">
            {activeProfessionals.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum profissional ativo
                </p>
              </div>
            ) : (
              activeProfessionals.map((professional) => (
                <div
                  key={professional.id}
                  onClick={() => handleProfessionalSelect(professional.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedProfessionalId === professional.id
                      ? 'bg-indigo-100 border-2 border-indigo-500'
                      : 'hover:bg-muted/50 border-2 border-transparent'
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={professional.photoUrl} alt={professional.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                      {getInitials(professional.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{professional.name}</p>
                    {professional.specialty && (
                      <p className="text-xs text-muted-foreground truncate">
                        {getSpecialtyName(professional.specialty)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Patient List Card */}
      <div className="lg:hidden">
        <Card className="h-[calc(100vh-280px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-base">Lista de Pacientes</CardTitle>
                <CardDescription>
                  {patients.length === 0
                    ? 'Nenhum paciente encontrado'
                    : `${patients.length} paciente(s)`}
                </CardDescription>
              </div>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : patients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || selectedProfessionalId
                    ? 'Nenhum paciente encontrado'
                    : 'Pacientes serao adicionados via WhatsApp'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {patients.map((patient) => (
                  <div key={patient.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{patient.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </div>
                        {patient.email && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {patient.email}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {patient.totalAppointments || 0} consulta(s)
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(patient.id)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
