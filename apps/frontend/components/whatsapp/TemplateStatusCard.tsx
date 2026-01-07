'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
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
  LayoutGrid,
} from 'lucide-react';

interface TemplateStatusCardProps {
  wabaId?: string;
}

function getStatusBadge(status: string, t: ReturnType<typeof useTranslations>) {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t('whatsapp.templates.status.approved')}
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          {t('whatsapp.templates.status.pending')}
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="w-3 h-3 mr-1" />
          {t('whatsapp.templates.status.rejected')}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status || t('whatsapp.templates.status.unknown')}
        </Badge>
      );
  }
}

function TemplateRow({ template, icon: Icon, t }: { template: MessageTemplate; icon: React.ElementType; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium text-sm">{template.name}</p>
          <p className="text-xs text-muted-foreground">
            {template.category} • {template.language}
          </p>
        </div>
      </div>
      {getStatusBadge(template.status, t)}
    </div>
  );
}

function MissingTemplateRow({ name, description, icon: Icon, t }: { name: string; description: string; icon: React.ElementType; t: ReturnType<typeof useTranslations> }) {
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
        {t('whatsapp.templates.notCreated')}
      </Badge>
    </div>
  );
}

export function TemplateStatusCard({ wabaId }: TemplateStatusCardProps) {
  const t = useTranslations();
  const { currentUser } = useAuth();

  const {
    templates,
    spmTemplate,
    carouselTemplate,
    isLoading,
    error,
    refetch,
    createTemplates,
    isCreating,
    createError,
  } = useWhatsAppTemplates(currentUser?.uid || '');

  // Don't show if WABA is not connected
  if (!wabaId) {
    return null;
  }

  const hasBothTemplates = spmTemplate && carouselTemplate;
  const hasAnyTemplate = spmTemplate || carouselTemplate;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t('whatsapp.templates.title')}
        </CardTitle>
        <CardDescription className="text-sm mt-1">
          {t('whatsapp.templates.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              {t('whatsapp.templates.tryAgain')}
            </Button>
          </div>
        )}

        {/* Templates list */}
        {!isLoading && !error && (
          <div className="space-y-3">
            {/* SPM Template */}
            {spmTemplate ? (
              <TemplateRow template={spmTemplate} icon={FileText} t={t} />
            ) : (
              <MissingTemplateRow
                name="zapcomm_produto"
                description={t('whatsapp.templates.singleProduct')}
                icon={FileText}
                t={t}
              />
            )}

            {/* Carousel Template */}
            {carouselTemplate ? (
              <TemplateRow template={carouselTemplate} icon={LayoutGrid} t={t} />
            ) : (
              <MissingTemplateRow
                name="zapcomm_produtos_v2"
                description={t('whatsapp.templates.productCarousel')}
                icon={LayoutGrid}
                t={t}
              />
            )}
          </div>
        )}

        {/* Create templates button */}
        {!isLoading && !error && !hasBothTemplates && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {t('whatsapp.templates.notFound')}
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
                  {t('whatsapp.templates.updating')}
                </>
              ) : (
                t('whatsapp.templates.update')
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
        {!isLoading && !error && hasAnyTemplate && (
          <div className="bg-blue-50 rounded-lg p-3 mt-2">
            <p className="text-xs text-blue-700">
              {t('whatsapp.templates.note')}
            </p>
          </div>
        )}

        {/* Success state */}
        {hasBothTemplates && spmTemplate?.status === 'APPROVED' && carouselTemplate?.status === 'APPROVED' && (
          <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">
              {t('whatsapp.templates.allApproved')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
