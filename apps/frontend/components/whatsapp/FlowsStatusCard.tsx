'use client';

import { useClinic } from '@/hooks/use-clinic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Workflow,
  FileText,
  CalendarCheck,
  ExternalLink,
} from 'lucide-react';

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

export function FlowsStatusCard({ wabaId }: FlowsStatusCardProps) {
  const { currentClinic: clinic } = useClinic();

  // Don't show if WABA is not connected
  if (!wabaId) {
    return null;
  }

  // Get flows config from clinic
  const whatsappConfig = (clinic as any)?.whatsappConfig || {};
  const flowsCreated = whatsappConfig.flowsCreated === true;
  const patientInfoFlowId = whatsappConfig.patientInfoFlowId;
  const bookingFlowId = whatsappConfig.bookingFlowId;

  // Check if all flows are installed
  const allFlowsInstalled = !!patientInfoFlowId && !!bookingFlowId;
  const anyFlowInstalled = !!patientInfoFlowId || !!bookingFlowId;

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
      <CardContent className="space-y-4">
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

        {/* Info about flows */}
        {!anyFlowInstalled && (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              Os Flows serão criados automaticamente durante a conexão do WhatsApp.
              Se não aparecerem, reconecte sua conta.
            </p>
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

        {/* Link to Meta Business Manager */}
        {anyFlowInstalled && (
          <div className="pt-2 border-t">
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
      </CardContent>
    </Card>
  );
}
