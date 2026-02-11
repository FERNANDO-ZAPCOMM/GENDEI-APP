'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useClinic } from '@/hooks/use-clinic';
import { useWhatsAppTemplates, MessageTemplate } from '@/hooks/use-whatsapp-templates';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Bell,
  CreditCard,
  CalendarCheck,
} from 'lucide-react';

interface TemplateStatusCardProps {
  wabaId?: string;
}

function getStatusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status || 'Desconhecido'}
        </Badge>
      );
  }
}

function TemplateRow({ template, icon: Icon, description }: { template: MessageTemplate; icon: React.ElementType; description: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium text-sm">{template.name}</p>
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {getStatusBadge(template.status)}
    </div>
  );
}

function MissingTemplateRow({ name, description, icon: Icon }: { name: string; description: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <p className="font-medium text-sm text-slate-500">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Badge variant="outline" className="text-slate-400">
        Não criado
      </Badge>
    </div>
  );
}

// Gendei template definitions
const GENDEI_TEMPLATES = [
  {
    name: 'lembrete_consulta_24h',
    description: 'Lembrete 24h antes (com reagendamento)',
    icon: Bell,
  },
  {
    name: 'lembrete_consulta_24h_simples',
    description: 'Lembrete 24h antes (simples)',
    icon: Bell,
  },
  {
    name: 'lembrete_consulta_2h',
    description: 'Lembrete 2h antes da consulta',
    icon: Clock,
  },
  {
    name: 'confirmacao_agendamento',
    description: 'Confirmação de agendamento',
    icon: CalendarCheck,
  },
  {
    name: 'link_pagamento_sinal',
    description: 'Link para pagamento do sinal',
    icon: CreditCard,
  },
];

// Content-only version for use inside CollapsibleCard
export function TemplateStatusCardContent({ wabaId }: TemplateStatusCardProps) {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const { currentClinic } = useClinic();

  const {
    templates,
    isLoading,
    error,
    refetch,
    createTemplates,
    isCreating,
    createError,
  } = useWhatsAppTemplates(currentClinic?.id || currentUser?.uid || '');

  // Don't show if WABA is not connected
  if (!wabaId) {
    return null;
  }

  // Check which templates exist
  const existingTemplateNames = new Set(templates.map(t => t.name));
  const hasAllTemplates = GENDEI_TEMPLATES.every(t => existingTemplateNames.has(t.name));
  const hasAnyTemplate = GENDEI_TEMPLATES.some(t => existingTemplateNames.has(t.name));

  // Check if all existing templates are approved
  const allApproved = templates.length > 0 &&
    templates.filter(t => GENDEI_TEMPLATES.some(gt => gt.name === t.name))
      .every(t => t.status?.toUpperCase() === 'APPROVED');

  return (
    <div className="space-y-4 pt-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Templates list */}
        {!isLoading && !error && (
          <div className="space-y-3">
            {GENDEI_TEMPLATES.map((templateDef) => {
              const existingTemplate = templates.find(t => t.name === templateDef.name);

              if (existingTemplate) {
                return (
                  <TemplateRow
                    key={templateDef.name}
                    template={existingTemplate}
                    icon={templateDef.icon}
                    description={templateDef.description}
                  />
                );
              } else {
                return (
                  <MissingTemplateRow
                    key={templateDef.name}
                    name={templateDef.name}
                    description={templateDef.description}
                    icon={templateDef.icon}
                  />
                );
              }
            })}
          </div>
        )}

        {/* Create templates button */}
        {!isLoading && !error && !hasAllTemplates && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Templates não encontrados
            </p>
            <Button
              onClick={() => createTemplates()}
              disabled={isCreating}
              variant="outline"
              size="sm"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar'
              )}
            </Button>
            {createError && (
              <p className="text-xs text-red-500 mt-2">
                {createError.message}
              </p>
            )}
          </div>
        )}

        {/* Info about template approval */}
        {!isLoading && !error && hasAnyTemplate && !allApproved && (
          <div className="bg-blue-50 rounded-lg p-3 mt-2">
            <p className="text-xs text-blue-700">
              Templates precisam ser aprovados pelo Meta antes de poderem ser usados. Isso pode levar até 24 horas.
            </p>
          </div>
        )}

        {/* Success state */}
        {hasAllTemplates && allApproved && (
          <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">
              Todos os templates estão aprovados e prontos para uso!
            </p>
          </div>
        )}
    </div>
  );
}

// Full card version (for backwards compatibility)
export function TemplateStatusCard({ wabaId }: TemplateStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Templates de Mensagem
        </CardTitle>
        <CardDescription className="text-sm mt-1">
          Templates para lembretes e confirmações de consultas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateStatusCardContent wabaId={wabaId} />
      </CardContent>
    </Card>
  );
}
