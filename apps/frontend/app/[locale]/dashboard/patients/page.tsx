'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Users, Calendar, Phone, Mail, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { usePatients } from '@/hooks/use-patients';
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

export default function PatientsPage() {
  const t = useTranslations();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: patients, isLoading, remove } = usePatients(
    clinic?.id || '',
    searchQuery ? { search: searchQuery } : undefined
  );

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = patients.filter(p => {
      if (!p.createdAt) return false;
      const created = new Date(p.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    return {
      total: patients.length,
      newThisMonth: thisMonth.length,
    };
  }, [patients]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return;

    try {
      await remove.mutateAsync(id);
      toast.success('Paciente excluido!');
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
    <div className="flex flex-col gap-4 sm:gap-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Pacientes</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie os pacientes da sua clinica</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Total de Pacientes</p>
                <p className="text-2xl font-bold text-indigo-700">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Novos este Mes</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.newThisMonth}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patients List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pacientes</CardTitle>
          <CardDescription>
            {patients.length === 0
              ? 'Nenhum paciente encontrado'
              : `${patients.length} paciente(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                {searchQuery ? 'Nenhum paciente encontrado com este termo' : 'Pacientes serao adicionados automaticamente via WhatsApp'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
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

              {/* Desktop Table View */}
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
