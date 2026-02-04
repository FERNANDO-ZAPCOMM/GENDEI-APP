'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { Calendar, Info, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { WorkflowMode } from '@/lib/clinic-types';

interface WorkflowModeCardContentProps {
  currentMode?: WorkflowMode;
  onModeChange?: (mode: WorkflowMode) => void;
}

export function WorkflowModeCardContent({ currentMode, onModeChange }: WorkflowModeCardContentProps) {
  const t = useTranslations();
  const { currentClinic, updateClinic, refetch } = useClinic();
  const [selectedMode, setSelectedMode] = useState<WorkflowMode>(
    currentMode || currentClinic?.workflowMode || 'booking'
  );

  const handleModeSelect = (mode: WorkflowMode) => {
    setSelectedMode(mode);
  };

  const handleSave = async () => {
    try {
      await updateClinic.mutateAsync({ workflowMode: selectedMode });

      toast.success(
        selectedMode === 'booking'
          ? 'Modo Agendamento ativado! O bot irá auxiliar pacientes a agendar consultas.'
          : 'Modo Informativo ativado! O bot irá fornecer informações sobre a clínica.'
      );

      // Refetch clinic data to update UI
      refetch();

      if (onModeChange) {
        onModeChange(selectedMode);
      }
    } catch (error) {
      console.error('Error saving workflow mode:', error);
      toast.error('Erro ao salvar o modo de atendimento');
    }
  };

  const isChanged = selectedMode !== (currentClinic?.workflowMode || 'booking');
  const isSaving = updateClinic.isPending;

  return (
    <div className="pt-4 space-y-4">
      <p className="text-sm text-gray-600">
        Escolha como o assistente do WhatsApp deve interagir com seus pacientes:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking Mode Card */}
        <div
          onClick={() => handleModeSelect('booking')}
          className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
            selectedMode === 'booking'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          {selectedMode === 'booking' && (
            <div className="absolute top-2 right-2">
              <Check className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${
              selectedMode === 'booking' ? 'bg-primary/20' : 'bg-gray-100'
            }`}>
              <Calendar className={`h-5 w-5 ${
                selectedMode === 'booking' ? 'text-primary' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Agendamento</h4>
              <p className="text-xs text-gray-500">Sistema completo</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Agendamento de consultas via WhatsApp</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Integração com PIX para sinal/pagamento</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Lembretes automáticos de consulta</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Cancelamento e reagendamento</span>
            </li>
          </ul>
        </div>

        {/* Info Mode Card */}
        <div
          onClick={() => handleModeSelect('info')}
          className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
            selectedMode === 'info'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          {selectedMode === 'info' && (
            <div className="absolute top-2 right-2">
              <Check className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${
              selectedMode === 'info' ? 'bg-primary/20' : 'bg-gray-100'
            }`}>
              <Info className={`h-5 w-5 ${
                selectedMode === 'info' ? 'text-primary' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Informativo</h4>
              <p className="text-xs text-gray-500">Apenas informações</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Informações sobre a clínica</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Lista de profissionais e especialidades</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Horários de funcionamento</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Resposta a dúvidas frequentes</span>
            </li>
          </ul>
        </div>
      </div>

      {isChanged && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alteração'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
