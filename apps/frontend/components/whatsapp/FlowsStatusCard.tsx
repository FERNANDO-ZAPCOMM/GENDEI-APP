'use client';

import { useState } from 'react';
import { useClinic } from '@/hooks/use-clinic';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Workflow,
  FileText,
  CalendarCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface FlowsStatusCardProps {
  wabaId?: string;
}

// Gendei flow definitions
const GENDEI_FLOWS = [
  {
    key: 'patientInfoFlowId' as const,
    name: 'CLINICA_MEDICA_FORMULARIO',
    displayName: 'Formulário do Paciente',
    description: 'Coleta especialidade, tipo de atendimento e dados do paciente',
    icon: FileText,
  },
  {
    key: 'bookingFlowId' as const,
    name: 'CLINICA_MEDICA_AGENDAMENTO',
    displayName: 'Agendamento',
    description: 'Seleção de data e horário da consulta',
    icon: CalendarCheck,
  },
];

function FlowRow({
  displayName,
  description,
  flowId,
  icon: Icon,
}: {
  displayName: string;
  description: string;
  flowId?: string;
  icon: React.ElementType;
}) {
  const isInstalled = !!flowId;

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
          isInstalled ? 'bg-white' : 'bg-slate-100'
        }`}>
          <Icon className={`w-4 h-4 ${isInstalled ? 'text-slate-600' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`font-medium text-sm ${isInstalled ? '' : 'text-slate-500'}`}>
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {isInstalled ? (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Instalado
        </Badge>
      ) : (
        <Badge variant="outline" className="text-slate-400">
          <XCircle className="w-3 h-3 mr-1" />
          Não instalado
        </Badge>
      )}
    </div>
  );
}

// Content-only version for use inside CollapsibleCard
export function FlowsStatusCardContent({ wabaId }: FlowsStatusCardProps) {
  const { currentClinic: clinic, refetch } = useClinic();
  const { getIdToken } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  // Don't show if WABA is not connected
  if (!wabaId) {
    return null;
  }

  // Get flows config from clinic
  const whatsappConfig = (clinic as any)?.whatsappConfig || {};
  const flowsCreated = whatsappConfig.flowsCreated === true;
  const patientInfoFlowId = whatsappConfig.patientInfoFlowId;
  const bookingFlowId = whatsappConfig.bookingFlowId;
  const flowsUpdatedAt = whatsappConfig.flowsUpdatedAt;

  // Check if all flows are installed
  const allFlowsInstalled = !!patientInfoFlowId && !!bookingFlowId;
  const anyFlowInstalled = !!patientInfoFlowId || !!bookingFlowId;

  // Handler to update flows
  const handleUpdateFlows = async () => {
    if (!clinic?.id) return;

    setIsUpdating(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await apiClient<{ success: boolean; updated?: string[]; error?: string }>(
        `/meta/flows/update/${clinic.id}`,
        {
          method: 'POST',
          token,
        }
      );

      if (response.success) {
        toast.success('Flows atualizados com sucesso!', {
          description: `${response.updated?.length || 0} flow(s) atualizado(s)`,
        });
        // Refresh clinic data
        await refetch();
      } else {
        throw new Error(response.error || 'Erro ao atualizar flows');
      }
    } catch (error: any) {
      console.error('Error updating flows:', error);
      toast.error('Erro ao atualizar flows', {
        description: error.message || 'Erro desconhecido',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
        {/* Flows list */}
        <div className="space-y-3">
          {GENDEI_FLOWS.map((flowDef) => {
            const flowId = flowDef.key === 'patientInfoFlowId'
              ? patientInfoFlowId
              : bookingFlowId;

            return (
              <FlowRow
                key={flowDef.key}
                displayName={flowDef.displayName}
                description={flowDef.description}
                flowId={flowId}
                icon={flowDef.icon}
              />
            );
          })}
        </div>

        {/* Info about flows - with create button */}
        {!anyFlowInstalled && (
          <div className="space-y-3">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Os Flows serão criados automaticamente durante a conexão do WhatsApp.
                Se não aparecerem, clique no botão abaixo para criar.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateFlows}
              disabled={isUpdating}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Criando Flows...' : 'Criar Flows'}
            </Button>
          </div>
        )}

        {anyFlowInstalled && !allFlowsInstalled && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Alguns flows ainda não foram instalados. Reconecte sua conta para criar os flows faltantes.
            </p>
          </div>
        )}

        {/* Success state */}
        {allFlowsInstalled && (
          <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">
              Todos os flows estão instalados e prontos para uso!
            </p>
          </div>
        )}

        {/* Update button and Meta Business Manager link */}
        {anyFlowInstalled && (
          <div className="pt-3 border-t space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateFlows}
              disabled={isUpdating}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Atualizando...' : 'Atualizar Flows'}
            </Button>
            {flowsUpdatedAt && (
              <p className="text-xs text-muted-foreground text-center">
                Última atualização: {new Date(flowsUpdatedAt).toLocaleString('pt-BR')}
              </p>
            )}
            <a
              href="https://business.facebook.com/latest/whatsapp_manager/flows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Gerenciar no Meta Business Manager
            </a>
          </div>
        )}
    </div>
  );
}

// Full card version (for backwards compatibility)
export function FlowsStatusCard({ wabaId }: FlowsStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="w-4 h-4" />
          WhatsApp Flows
        </CardTitle>
        <CardDescription className="text-sm mt-1">
          Formulários interativos para agendamento de consultas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FlowsStatusCardContent wabaId={wabaId} />
      </CardContent>
    </Card>
  );
}
