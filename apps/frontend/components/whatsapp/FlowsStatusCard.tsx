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
  CalendarCheck,
  ExternalLink,
  RefreshCw,
  HeartPulse,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface FlowsStatusCardProps {
  wabaId?: string;
  businessManagerId?: string;
}

// Gendei flow definitions
const GENDEI_FLOWS = [
  {
    key: 'patientInfoConvenioFlowId' as const,
    name: 'CLINICA_MEDICA_FORMULARIO_CONVENIO',
    displayName: 'Formulário Convênio',
    description: 'Fluxo simplificado para pacientes com convênio',
    icon: HeartPulse,
  },
  {
    key: 'patientInfoParticularFlowId' as const,
    name: 'CLINICA_MEDICA_FORMULARIO_PARTICULAR',
    displayName: 'Formulário Particular',
    description: 'Fluxo simplificado para pacientes particulares',
    icon: Wallet,
  },
  {
    key: 'bookingFlowId' as const,
    name: 'CLINICA_MEDICA_AGENDAMENTO',
    displayName: 'Agendamento',
    description: 'Seleção de data e horário da consulta',
    icon: CalendarCheck,
  },
];

type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED';

function FlowRow({
  displayName,
  description,
  flowId,
  flowStatus,
  publishUrl,
  icon: Icon,
}: {
  displayName: string;
  description: string;
  flowId?: string;
  flowStatus?: FlowStatus;
  publishUrl?: string;
  icon: React.ElementType;
}) {
  const isInstalled = !!flowId;
  const isDraft = flowStatus === 'DRAFT';
  const isPublished = flowStatus === 'PUBLISHED';

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
      <div className="flex items-center gap-2">
        {!isInstalled && (
          <Badge variant="outline" className="text-slate-400">
            <XCircle className="w-3 h-3 mr-1" />
            Não instalado
          </Badge>
        )}
        {isInstalled && isDraft && (
          <>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
              <AlertCircle className="w-3 h-3 mr-1" />
              Rascunho
            </Badge>
            {publishUrl && (
              <a
                href={publishUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Publicar
              </a>
            )}
          </>
        )}
        {isInstalled && isPublished && (
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Publicado
          </Badge>
        )}
        {isInstalled && !isDraft && !isPublished && flowStatus && (
          <Badge variant="outline" className="text-slate-500">
            {flowStatus}
          </Badge>
        )}
      </div>
    </div>
  );
}

// Content-only version for use inside CollapsibleCard
export function FlowsStatusCardContent({ wabaId, businessManagerId }: FlowsStatusCardProps) {
  const { currentClinic: clinic, refetch } = useClinic();
  const { getIdToken } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  // Don't show if WABA is not connected
  if (!wabaId) {
    return null;
  }

  // Build WhatsApp Manager flows URL with business_id and asset_id (wabaId)
  const whatsappManagerFlowsUrl = businessManagerId && wabaId
    ? `https://business.facebook.com/latest/whatsapp_manager/flows?business_id=${businessManagerId}&asset_id=${wabaId}`
    : 'https://business.facebook.com/latest/whatsapp_manager/flows';

  // Get flows config from clinic
  const whatsappConfig = (clinic as any)?.whatsappConfig || {};
  const patientInfoConvenioFlowId = whatsappConfig.patientInfoConvenioFlowId;
  const patientInfoParticularFlowId = whatsappConfig.patientInfoParticularFlowId;
  const bookingFlowId = whatsappConfig.bookingFlowId;
  const flowsUpdatedAt = whatsappConfig.flowsUpdatedAt;
  const flowStatuses = whatsappConfig.flowStatuses || {};

  // Check if all flows are installed
  const allFlowsInstalled = !!patientInfoConvenioFlowId && !!patientInfoParticularFlowId && !!bookingFlowId;
  const anyFlowInstalled = !!patientInfoConvenioFlowId || !!patientInfoParticularFlowId || !!bookingFlowId;

  // Check if all flows are published
  const allFlowsPublished = allFlowsInstalled &&
    flowStatuses.patientInfoConvenio?.status === 'PUBLISHED' &&
    flowStatuses.patientInfoParticular?.status === 'PUBLISHED' &&
    flowStatuses.booking?.status === 'PUBLISHED';

  // Check if any flow is in draft
  const anyFlowDraft = (flowStatuses.patientInfoConvenio?.status === 'DRAFT') ||
    (flowStatuses.patientInfoParticular?.status === 'DRAFT') ||
    (flowStatuses.booking?.status === 'DRAFT');

  // Handler to update flows
  const handleUpdateFlows = async () => {
    if (!clinic?.id) return;

    setIsUpdating(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await apiClient<{
        success: boolean;
        synced?: boolean;
        created?: boolean;
        updated?: string[];
        found?: string[];
        flowIds?: { patientInfo?: string; booking?: string; patientInfoConvenio?: string; patientInfoParticular?: string };
        error?: string;
      }>(
        `/meta/flows/update/${clinic.id}`,
        {
          method: 'POST',
          token,
        }
      );

      if (response.success) {
        if (response.synced) {
          toast.success('Flows sincronizados com sucesso!', {
            description: `Encontrados ${response.found?.length || 0} flow(s) existentes no WhatsApp`,
          });
        } else if (response.created) {
          toast.success('Flows criados com sucesso!', {
            description: 'Os flows de agendamento foram criados',
          });
        } else {
          toast.success('Flows atualizados com sucesso!', {
            description: `${response.updated?.length || 0} flow(s) atualizado(s)`,
          });
        }
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
            const flowIdMap: Record<string, string | undefined> = {
              patientInfoConvenioFlowId,
              patientInfoParticularFlowId,
              bookingFlowId,
            };
            const statusKeyMap: Record<string, string> = {
              patientInfoConvenioFlowId: 'patientInfoConvenio',
              patientInfoParticularFlowId: 'patientInfoParticular',
              bookingFlowId: 'booking',
            };
            const flowId = flowIdMap[flowDef.key];
            const statusKey = statusKeyMap[flowDef.key];
            const flowStatus = flowStatuses[statusKey]?.status as FlowStatus | undefined;

            // Build publish URL for this specific flow
            const publishUrl = flowId && businessManagerId
              ? `https://business.facebook.com/latest/whatsapp_manager/flows?business_id=${businessManagerId}&selected_flow_id=${flowId}`
              : undefined;

            return (
              <FlowRow
                key={flowDef.key}
                displayName={flowDef.displayName}
                description={flowDef.description}
                flowId={flowId}
                flowStatus={flowStatus}
                publishUrl={publishUrl}
                icon={flowDef.icon}
              />
            );
          })}
        </div>

        {/* Info about flows - with sync button */}
        {!anyFlowInstalled && (
          <div className="space-y-3">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Os Flows serão criados automaticamente durante a conexão do WhatsApp.
                Se você já criou os flows no WhatsApp Manager, clique em &quot;Sincronizar Flows&quot; para vinculá-los.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateFlows}
              disabled={isUpdating}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Sincronizando...' : 'Sincronizar Flows'}
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

        {/* Draft warning */}
        {allFlowsInstalled && anyFlowDraft && (
          <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              Alguns flows estão em rascunho. Publique-os no Meta Business Manager para que funcionem corretamente.
            </p>
          </div>
        )}

        {/* Success state */}
        {allFlowsPublished && (
          <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">
              Todos os flows estão publicados e prontos para uso!
            </p>
          </div>
        )}

        {/* Update button and Meta Business Manager link */}
        <div className="pt-3 border-t space-y-3">
          {anyFlowInstalled && (
            <>
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
            </>
          )}
          <a
            href={whatsappManagerFlowsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Gerenciar no Meta Business Manager
          </a>
        </div>
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
