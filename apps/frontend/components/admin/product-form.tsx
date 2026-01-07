'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Loader2, Sparkles, Package, ChevronDown, ChevronUp, FileText, Users, Calendar, ImageIcon, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { ProductSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
// FileUpload removed - products are created via chat only
import { Product } from '@/lib/types';
import { uploadFile } from '@/lib/upload';
import { generateThumbnailFromTitle, dataUrlToFile, resizeImage } from '@/lib/thumbnail';
import { useAiProductDescription } from '@/hooks/use-ai-product-description';

// Common objection labels
const OBJECTION_LABELS: Record<string, string> = {
  price: '"Tá caro"',
  time: '"Não tenho tempo"',
  later: '"Vou pensar"',
  trust: '"Não sei se funciona"',
  spouse: '"Preciso falar com meu cônjuge"',
};

// Product type labels and icons
const PRODUCT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  ebook: { label: 'E-book / PDF', icon: <FileText className="w-4 h-4" /> },
  community: { label: 'Comunidade', icon: <Users className="w-4 h-4" /> },
  consulting: { label: 'Consultoria', icon: <Calendar className="w-4 h-4" /> },
  course: { label: 'Curso', icon: <Package className="w-4 h-4" /> },
  template: { label: 'Template', icon: <FileText className="w-4 h-4" /> },
  software: { label: 'Software', icon: <Package className="w-4 h-4" /> },
  other: { label: 'Outro', icon: <Package className="w-4 h-4" /> },
};

type ProductForm = z.infer<typeof ProductSchema>;

interface ProductFormProps {
  onSubmit: (data: ProductForm) => Promise<void>;
  onCancel: () => void;
  initialData?: Product;
  isLoading?: boolean;
  creatorId: string;
}

export function ProductFormComponent({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
  creatorId,
}: ProductFormProps) {
  const t = useTranslations();
  const [fileUrl, setFileUrl] = useState<string>('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);

  // Thumbnail editing state
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(initialData?.thumbnailUrl || '');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const { generateDescription, isGenerating } = useAiProductDescription(creatorId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    formState: { errors, isValid, isDirty },
  } = useForm<ProductForm>({
    resolver: zodResolver(ProductSchema),
    mode: 'onChange',
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      fileUrl: initialData?.fileUrl || '',
      thumbnailUrl: initialData?.thumbnailUrl || '',
      active: initialData?.active ?? (initialData as any)?.isActive ?? true,
      mainBenefit: initialData?.mainBenefit || '',
      targetAudience: initialData?.targetAudience || '',
      tone: initialData?.tone,
      objections: initialData?.objections || [],
      objectionResponses: initialData?.objectionResponses || {},
      // RAG context fields
      ragContext: {
        summary: (initialData as any)?.ragContext?.summary || '',
        topics: (initialData as any)?.ragContext?.topics || [],
        benefits: (initialData as any)?.ragContext?.benefits || [],
      },
    },
  });

  const active = watch('active');
  const objections = watch('objections') || [];
  const objectionResponses = watch('objectionResponses') || {};

  // Reset form when initialData changes (when opening edit dialog)
  useEffect(() => {
    const resetFileUrl = initialData?.fileUrl || '';
    const resetThumbnailUrl = initialData?.thumbnailUrl || '';
    const isActive = initialData?.active ?? (initialData as any)?.isActive ?? true;

    reset({
      title: initialData?.title || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      fileUrl: resetFileUrl,
      thumbnailUrl: resetThumbnailUrl,
      active: isActive,
      mainBenefit: initialData?.mainBenefit || '',
      targetAudience: initialData?.targetAudience || '',
      tone: initialData?.tone,
      objections: initialData?.objections || [],
      objectionResponses: initialData?.objectionResponses || {},
      // RAG context fields
      ragContext: {
        summary: (initialData as any)?.ragContext?.summary || '',
        topics: (initialData as any)?.ragContext?.topics || [],
        benefits: (initialData as any)?.ragContext?.benefits || [],
      },
    });
    setFileUrl(resetFileUrl);
    setThumbnailUrl(resetThumbnailUrl);
    setAiError(null);
    setExpandedObjection(null);
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ProductForm) => {
    const finalFileUrl = fileUrl || data.fileUrl;
    const finalThumbnailUrl = thumbnailUrl || data.thumbnailUrl;

    const cleanData = {
      ...data,
      price: Number(data.price),
      fileUrl: finalFileUrl && finalFileUrl.trim() ? finalFileUrl : undefined,
      thumbnailUrl: finalThumbnailUrl && finalThumbnailUrl.trim() ? finalThumbnailUrl : undefined,
    };

    console.log('Submitting product data:', cleanData);
    await onSubmit(cleanData);
  };

  // Handle form validation errors
  const handleFormError = (formErrors: any) => {
    console.log('Form validation errors:', formErrors);
    // Show first error as toast
    const firstErrorKey = Object.keys(formErrors)[0];
    if (firstErrorKey && formErrors[firstErrorKey]?.message) {
      toast.error(formErrors[firstErrorKey].message);
    }
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem (JPEG ou PNG)');
      return;
    }

    try {
      setIsUploadingThumbnail(true);

      // Read file as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Resize the image
      const resizedDataUrl = await resizeImage(dataUrl, 500);

      // Convert to File and upload
      const thumbnailFile = dataUrlToFile(resizedDataUrl, `thumbnail_${Date.now()}.jpg`);
      const uploadedUrl = await uploadFile({ file: thumbnailFile, creatorId });

      setThumbnailUrl(uploadedUrl);
      setValue('thumbnailUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
      await trigger(); // Force form revalidation
      toast.success('Imagem de capa atualizada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer upload da imagem');
    } finally {
      setIsUploadingThumbnail(false);
      // Reset input
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = '';
      }
    }
  };

  // Handle generate thumbnail from title
  const handleGenerateThumbnail = async () => {
    const title = watch('title');
    if (!title || title.trim().length < 2) {
      toast.error('Digite um título antes de gerar a capa');
      return;
    }

    try {
      setIsGeneratingThumbnail(true);

      // Generate thumbnail from title
      const thumbnailDataUrl = generateThumbnailFromTitle(title);

      // Convert to File and upload
      const thumbnailFile = dataUrlToFile(thumbnailDataUrl, `thumbnail_${Date.now()}.jpg`);
      const uploadedUrl = await uploadFile({ file: thumbnailFile, creatorId });

      setThumbnailUrl(uploadedUrl);
      setValue('thumbnailUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
      await trigger(); // Force form revalidation
      toast.success('Capa gerada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar a capa');
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleGenerateDescription = async () => {
    try {
      setAiError(null);
      if (!fileUrl) {
        setAiError(t('products.uploadFileBeforeGenerating'));
        toast.error(t('products.uploadFileBeforeGenerating'));
        return;
      }

      const result = await generateDescription({
        title: watch('title'),
        fileUrl: fileUrl,
        language: 'pt-BR',
      });

      setValue('description', result.description, { shouldValidate: true, shouldDirty: true });
      toast.success(t('products.descriptionGeneratedSuccess'));
    } catch (error: any) {
      const message = error?.message || t('products.descriptionGeneratedError') || 'Não foi possível gerar a descrição.';
      setAiError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)} className="space-y-4">
      {/* Product Type Badge */}
      {initialData && (initialData as any)?.type && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
          <div className="p-1.5 bg-white rounded-md border border-slate-200">
            {PRODUCT_TYPE_CONFIG[(initialData as any).type]?.icon || <Package className="w-4 h-4" />}
          </div>
          <span className="text-sm font-medium text-slate-700">
            {PRODUCT_TYPE_CONFIG[(initialData as any).type]?.label || 'Produto'}
          </span>
        </div>
      )}

      {/* Title + Price Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="title">{t('products.title_field')}</Label>
          <Input
            id="title"
            placeholder="Ex: Guia Completo de Marketing Digital"
            {...register('title')}
            disabled={isLoading}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">{t('products.price')}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="pl-10"
              {...register('price', { valueAsNumber: true })}
              disabled={isLoading}
            />
          </div>
          {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
        </div>
      </div>

      {/* Current File (Read-only) */}
      {fileUrl && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-md">
          <FileText className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 flex-1 font-medium">{t('products.productFile')}</span>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline font-medium"
          >
            {t('products.viewFile')}
          </a>
        </div>
      )}

      {/* Thumbnail Editing - Compact */}
      <div className="space-y-1.5">
        <Label>{t('products.coverImage')}</Label>
        <div className="flex items-center gap-3">
          {/* Thumbnail Preview */}
          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Capa do produto"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-300" />
            )}
          </div>

          {/* Thumbnail Actions - Compact inline buttons */}
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleThumbnailUpload}
              className="hidden"
              disabled={isLoading || isUploadingThumbnail || isGeneratingThumbnail}
            />
            <button
              type="button"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={isLoading || isUploadingThumbnail || isGeneratingThumbnail}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploadingThumbnail ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3 w-3" />
              )}
              {isUploadingThumbnail ? t('products.uploading') : 'Upload'}
            </button>
            <button
              type="button"
              onClick={handleGenerateThumbnail}
              disabled={isLoading || isUploadingThumbnail || isGeneratingThumbnail}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingThumbnail ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3 w-3" />
              )}
              {isGeneratingThumbnail ? t('products.generating') : t('products.generate')}
            </button>
            <span className="text-xs text-muted-foreground hidden sm:inline">500x500px</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">{t('products.description')}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGenerateDescription}
            disabled={isLoading || isGenerating || !fileUrl}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t('products.generateWithAI')}
          </Button>
        </div>
        <textarea
          id="description"
          placeholder="Descrição do produto..."
          className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('description')}
          disabled={isLoading}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
        {aiError && <p className="text-sm text-destructive">{aiError}</p>}
      </div>

      {/* Main Benefit - Full width like Description */}
      <div className="space-y-1.5">
        <Label htmlFor="mainBenefit">{t('products.mainBenefit')}</Label>
        <textarea
          id="mainBenefit"
          placeholder="Ex: Dominar as técnicas de vendas no WhatsApp e aumentar seu faturamento em 30 dias"
          className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('mainBenefit')}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">{t('products.mainBenefitHelp')}</p>
      </div>

      {/* Target Audience */}
      <div className="space-y-1.5">
        <Label htmlFor="targetAudience">Público-alvo</Label>
        <Input
          id="targetAudience"
          placeholder="Ex: Empreendedores digitais que querem automatizar vendas"
          {...register('targetAudience')}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">Para quem é este produto? O agente usará isso para qualificar leads.</p>
      </div>

      {/* AI Context Section (Collapsible) */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedObjection(expandedObjection === 'ai_context' ? null : 'ai_context')}
          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-slate-700">Contexto para IA (WhatsApp)</span>
          </div>
          <div className="flex items-center gap-2">
            {(watch('ragContext.summary') || (watch('ragContext.topics') as string[])?.length > 0) && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Configurado
              </span>
            )}
            {expandedObjection === 'ai_context' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>
        {expandedObjection === 'ai_context' && (
          <div className="p-3 border-t space-y-4">
            <p className="text-xs text-muted-foreground">
              Estas informações são usadas pelo agente de IA para responder perguntas sobre o produto no WhatsApp.
            </p>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label htmlFor="ragSummary">Resumo do Produto</Label>
              <textarea
                id="ragSummary"
                placeholder="Descreva em 2-3 frases o que o produto ensina/oferece..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('ragContext.summary')}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">O agente usará isso para explicar o produto.</p>
            </div>

            {/* Topics */}
            <div className="space-y-1.5">
              <Label htmlFor="ragTopics">Tópicos Principais</Label>
              <Input
                id="ragTopics"
                placeholder="IA, Automação, WhatsApp, Vendas (separados por vírgula)"
                value={(watch('ragContext.topics') as string[])?.join(', ') || ''}
                onChange={(e) => {
                  const topics = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                  setValue('ragContext.topics', topics, { shouldDirty: true });
                }}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Principais assuntos abordados no produto.</p>
            </div>

            {/* Benefits */}
            <div className="space-y-1.5">
              <Label htmlFor="ragBenefits">Benefícios</Label>
              <Input
                id="ragBenefits"
                placeholder="Automatizar vendas, Atender 24/7, Escalar negócio (separados por vírgula)"
                value={(watch('ragContext.benefits') as string[])?.join(', ') || ''}
                onChange={(e) => {
                  const benefits = e.target.value.split(',').map(b => b.trim()).filter(b => b);
                  setValue('ragContext.benefits', benefits, { shouldDirty: true });
                }}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">O que o cliente ganha com este produto?</p>
            </div>
          </div>
        )}
      </div>

      {/* Objections */}
      {objections && objections.length > 0 && (
        <div className="space-y-1.5">
          <Label>Objeções e Respostas</Label>
          <div className="space-y-2">
            {objections.map((objection) => {
              const label = OBJECTION_LABELS[objection] || objection;
              const response = objectionResponses[objection];
              const isExpanded = expandedObjection === objection;

              return (
                <div key={objection} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedObjection(isExpanded ? null : objection)}
                    className="w-full flex items-center justify-between p-2 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    <div className="flex items-center gap-2">
                      {response && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          Configurada
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-2 border-t bg-slate-50">
                      <textarea
                        value={response || ''}
                        onChange={(e) => {
                          const newResponses = { ...objectionResponses, [objection]: e.target.value };
                          setValue('objectionResponses', newResponses);
                        }}
                        placeholder="Resposta do agente para esta objeção..."
                        className="flex min-h-[70px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Status */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
        <div className="space-y-0.5">
          <Label htmlFor="active" className="text-sm">{t('products.active')}</Label>
          <p className="text-xs text-muted-foreground font-sans">{t('products.productVisibleForSales')}</p>
        </div>
        <Switch
          id="active"
          checked={active}
          onCheckedChange={(checked) => setValue('active', checked, { shouldDirty: true })}
          disabled={isLoading}
          className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || (initialData ? !isDirty : !isValid)}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading
            ? t('common.loading')
            : initialData
              ? t('products.update')
              : t('products.create')}
        </Button>
      </div>
    </form>
  );
}
