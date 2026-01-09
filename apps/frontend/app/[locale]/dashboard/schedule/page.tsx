'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, User, ArrowRight, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessionals } from '@/hooks/use-professionals';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TypingDots } from '@/components/PageLoader';
import { ScheduleConfigForm } from '@/components/schedule/ScheduleConfigForm';
import type { WorkingHours, Professional } from '@/lib/clinic-types';

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const { currentClinic, isLoading: clinicLoading } = useClinic();
  const clinicId = currentClinic?.id || '';
  const { data: professionals, isLoading: professionalsLoading, update: updateProfessional } = useProfessionals(clinicId);
  const { nextStep, scheduleComplete } = useOnboardingStatus();

  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [schedules, setSchedules] = useState<Record<string, WorkingHours>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize schedules from professionals data
  useEffect(() => {
    if (professionals && professionals.length > 0) {
      const initialSchedules: Record<string, WorkingHours> = {};
      professionals.forEach((prof: Professional) => {
        initialSchedules[prof.id] = prof.workingHours || {};
      });
      setSchedules(initialSchedules);

      // Select first professional by default
      if (!selectedProfessionalId && professionals.length > 0) {
        setSelectedProfessionalId(professionals[0].id);
      }
    }
  }, [professionals, selectedProfessionalId]);

  const handleScheduleChange = (professionalId: string, schedule: WorkingHours) => {
    setSchedules((prev) => ({
      ...prev,
      [professionalId]: schedule,
    }));
  };

  const handleSave = async () => {
    if (!selectedProfessionalId) return;

    setIsSaving(true);
    try {
      await updateProfessional.mutateAsync({
        id: selectedProfessionalId,
        data: { workingHours: schedules[selectedProfessionalId] },
      });
      toast.success('Horários salvos com sucesso!');
    } catch {
      toast.error('Erro ao salvar horários');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(schedules).map(([profId, schedule]) =>
        updateProfessional.mutateAsync({ id: profId, data: { workingHours: schedule } })
      );
      await Promise.all(updates);
      toast.success('Todos os horários foram salvos!');
    } catch {
      toast.error('Erro ao salvar horários');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (nextStep && nextStep > 4) {
      router.push(`/${locale}/dashboard/payments`);
    }
  };

  if (clinicLoading || professionalsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  if (!professionals || professionals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurar Agenda</h1>
          <p className="text-muted-foreground">Defina os horários de atendimento dos profissionais</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Nenhum profissional cadastrado</h3>
              <p className="text-gray-500 text-sm mb-4">
                Adicione pelo menos um profissional antes de configurar a agenda
              </p>
              <Button onClick={() => router.push(`/${locale}/dashboard/professionals`)}>
                Adicionar Profissional
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeProfessionals = professionals.filter((p: Professional) => p.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurar Agenda</h1>
          <p className="text-muted-foreground">Defina os horários de atendimento de cada profissional</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveAll} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Todos
          </Button>
          {!scheduleComplete && nextStep && nextStep >= 4 && (
            <Button onClick={handleContinue}>
              Próximo Passo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Horários de Atendimento
          </CardTitle>
          <CardDescription>
            Configure os dias e horários em que cada profissional atende
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeProfessionals.length > 1 ? (
            <Tabs value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
              <TabsList className="mb-6">
                {activeProfessionals.map((prof: Professional) => (
                  <TabsTrigger key={prof.id} value={prof.id}>
                    {prof.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {activeProfessionals.map((prof: Professional) => (
                <TabsContent key={prof.id} value={prof.id}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{prof.name}</p>
                        {prof.specialty && (
                          <p className="text-sm text-muted-foreground">{prof.specialty}</p>
                        )}
                      </div>
                    </div>

                    <ScheduleConfigForm
                      initialSchedule={schedules[prof.id]}
                      onChange={(schedule) => handleScheduleChange(prof.id, schedule)}
                      disabled={isSaving}
                    />

                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'Salvar Horários'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            // Single professional - no tabs needed
            <div className="space-y-4">
              {activeProfessionals[0] && (
                <>
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{activeProfessionals[0].name}</p>
                      {activeProfessionals[0].specialty && (
                        <p className="text-sm text-muted-foreground">{activeProfessionals[0].specialty}</p>
                      )}
                    </div>
                  </div>

                  <ScheduleConfigForm
                    initialSchedule={schedules[activeProfessionals[0].id]}
                    onChange={(schedule) => handleScheduleChange(activeProfessionals[0].id, schedule)}
                    disabled={isSaving}
                  />

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? 'Salvando...' : 'Salvar Horários'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
