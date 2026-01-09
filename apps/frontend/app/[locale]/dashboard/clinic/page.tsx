'use client';

import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TypingDots } from '@/components/PageLoader';
import { Building2, Phone, Mail, Clock, Navigation } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AddressAutocomplete, AddressDetails } from '@/components/AddressAutocomplete';
import { ClinicWhatsAppPreview } from '@/components/chat/ClinicWhatsAppPreview';
import type { ClinicAddress } from '@/lib/clinic-types';

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
  const [addressData, setAddressData] = useState<ClinicAddress | undefined>();

  useEffect(() => {
    if (currentClinic) {
      setFormData({
        name: currentClinic.name || '',
        address: currentClinic.address || currentClinic.addressData?.formatted || '',
        phone: currentClinic.phone || '',
        email: currentClinic.email || '',
        openingHours: currentClinic.openingHours || '',
      });
      setAddressData(currentClinic.addressData);
    }
  }, [currentClinic]);

  const handleAddressChange = (address: string, newAddressData: ClinicAddress | undefined) => {
    setFormData((prev) => ({ ...prev, address }));
    setAddressData(newAddressData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateClinic.mutateAsync({
        ...formData,
        addressData,
      });
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

  // Data for the preview
  const previewData = {
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    openingHours: formData.openingHours,
    address: formData.address,
    addressData: addressData,
  };

  // Show preview when there's at least a clinic name
  const showPreview = Boolean(formData.name?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Clínica</h1>
        <p className="text-muted-foreground">Gerencie as informações da sua clínica</p>
      </div>

      {/* Main Content Grid - Same as Zapcomm */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Form Section */}
        <div className="space-y-6">
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
                    <Navigation className="w-4 h-4" />
                    Endereço Completo
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Digite o endereço e selecione da lista para obter as coordenadas automaticamente (usado para enviar localização no WhatsApp)
                  </p>
                  <AddressAutocomplete
                    value={formData.address}
                    addressData={addressData}
                    onChange={handleAddressChange}
                    placeholder="Rua, número, bairro - cidade/UF"
                  />
                  <AddressDetails addressData={addressData} />
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

        {/* Preview Section - Desktop Only (Same as Zapcomm) */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium">Preview do Assistente</CardTitle>
                <CardDescription>Veja como seu assistente aparecerá no WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                {showPreview ? (
                  <ClinicWhatsAppPreview clinicData={previewData} />
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <FaWhatsapp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      Preencha o nome da clínica para ver o preview
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile preview - show below form on smaller screens */}
      <div className="lg:hidden">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Preview do Assistente</CardTitle>
            <CardDescription>Veja como seu assistente aparecerá no WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            {showPreview ? (
              <div className="flex justify-center">
                <ClinicWhatsAppPreview clinicData={previewData} />
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
                <FaWhatsapp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Preencha o nome da clínica para ver o preview
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
