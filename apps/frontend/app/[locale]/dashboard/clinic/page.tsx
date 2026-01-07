'use client';

import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TypingDots } from '@/components/PageLoader';
import { Building2, MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function ClinicSettingsPage() {
  const t = useTranslations();
  const { currentClinic, isLoading, updateClinic } = useClinic();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    openingHours: '',
  });

  useEffect(() => {
    if (currentClinic) {
      setFormData({
        name: currentClinic.name || '',
        address: currentClinic.address || '',
        phone: currentClinic.phone || '',
        email: currentClinic.email || '',
        openingHours: currentClinic.openingHours || '',
      });
    }
  }, [currentClinic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateClinic.mutateAsync(formData);
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Clínica</h1>
        <p className="text-muted-foreground">Gerencie as informações da sua clínica</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>
              Dados de identificação e contato da clínica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Clínica</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Clínica São Paulo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telefone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@clinica.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingHours" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Horário de Funcionamento
                </Label>
                <Input
                  id="openingHours"
                  value={formData.openingHours}
                  onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                  placeholder="Seg-Sex: 8h-18h"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço Completo
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, bairro - cidade/UF"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateClinic.isPending}>
                {updateClinic.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
