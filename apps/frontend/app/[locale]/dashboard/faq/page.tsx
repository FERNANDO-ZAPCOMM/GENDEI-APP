'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Save, Loader2, X } from 'lucide-react';

import { useClinic } from '@/hooks/use-clinic';
import type { PaymentSettings } from '@/lib/clinic-types';
import { TypingDots } from '@/components/PageLoader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type WorkflowFaqItem = { question: string; answer: string; source?: 'system' | 'custom' };

const normalizeFaqQuestion = (question: string): string => question.trim().toLowerCase().replace(/\s+/g, ' ');

export default function FaqPage() {
  const t = useTranslations();
  const { currentClinic, isLoading, updateClinic } = useClinic();
  const [customFaqs, setCustomFaqs] = useState<WorkflowFaqItem[]>([]);

  const systemFaqs = useMemo<WorkflowFaqItem[]>(() => {
    const clinicData = currentClinic as any;
    const paymentSettings = (clinicData?.paymentSettings || {}) as Partial<PaymentSettings>;

    const locationAnswer = (clinicData?.addressData?.formatted || clinicData?.address || '').trim()
      || t('clinicPage.faq.autoAnswers.missingAddress');

    const openingHours = String(clinicData?.openingHours || '').trim();
    const hoursAnswer = openingHours
      ? t('clinicPage.faq.autoAnswers.hoursValue', { hours: openingHours })
      : t('clinicPage.faq.autoAnswers.missingHours');

    const acceptsParticular = Boolean(paymentSettings.acceptsParticular);
    const acceptsConvenio = Boolean(paymentSettings.acceptsConvenio);
    const convenioList = Array.isArray(paymentSettings.convenioList) ? paymentSettings.convenioList : [];

    const paymentAnswer = acceptsParticular && acceptsConvenio
      ? t('clinicPage.faq.autoAnswers.paymentBoth')
      : acceptsParticular
        ? t('clinicPage.faq.autoAnswers.paymentParticularOnly')
        : acceptsConvenio
          ? t('clinicPage.faq.autoAnswers.paymentConvenioOnly')
          : t('clinicPage.faq.autoAnswers.paymentNone');

    const insuranceAnswer = acceptsConvenio
      ? convenioList.length > 0
        ? t('clinicPage.faq.autoAnswers.insuranceList', { list: convenioList.join(', ') })
        : t('clinicPage.faq.autoAnswers.insurancePendingList')
      : t('clinicPage.faq.autoAnswers.insuranceNone');

    const requiresDeposit = paymentSettings.requiresDeposit ?? true;
    const depositPercentage = paymentSettings.depositPercentage ?? 30;
    const depositAnswer = requiresDeposit
      ? t('clinicPage.faq.autoAnswers.depositRequired', { percentage: depositPercentage })
      : t('clinicPage.faq.autoAnswers.depositNotRequired');

    return [
      {
        question: t('clinicPage.faq.systemQuestions.locationQuestion'),
        answer: locationAnswer,
        source: 'system',
      },
      {
        question: t('clinicPage.faq.systemQuestions.hoursQuestion'),
        answer: hoursAnswer,
        source: 'system',
      },
      {
        question: t('clinicPage.faq.systemQuestions.paymentQuestion'),
        answer: paymentAnswer,
        source: 'system',
      },
      {
        question: t('clinicPage.faq.systemQuestions.insuranceQuestion'),
        answer: insuranceAnswer,
        source: 'system',
      },
      {
        question: t('clinicPage.faq.systemQuestions.depositQuestion'),
        answer: depositAnswer,
        source: 'system',
      },
    ];
  }, [currentClinic, t]);

  useEffect(() => {
    const clinicData = currentClinic as any;
    const storedFaqs = Array.isArray(clinicData?.workflowFaqs)
      ? clinicData.workflowFaqs as WorkflowFaqItem[]
      : [];

    const systemQuestions = new Set(systemFaqs.map((item) => normalizeFaqQuestion(item.question)));

    const customOnly = storedFaqs
      .filter((item) => item && item.question && item.answer)
      .filter((item) => item.source !== 'system')
      .filter((item) => !systemQuestions.has(normalizeFaqQuestion(String(item.question))))
      .map((item) => ({
        question: String(item.question || '').trim(),
        answer: String(item.answer || '').trim(),
        source: 'custom' as const,
      }));

    setCustomFaqs(customOnly);
  }, [currentClinic, systemFaqs]);

  const addCustomFaq = () => {
    setCustomFaqs((prev) => [...prev, { question: '', answer: '', source: 'custom' }]);
  };

  const updateCustomFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setCustomFaqs((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeCustomFaq = (index: number) => {
    setCustomFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      const seenQuestions = new Set<string>();
      const combinedFaqs = [...systemFaqs, ...customFaqs];

      const workflowFaqs: WorkflowFaqItem[] = combinedFaqs
        .map((item) => ({
          question: String(item.question || '').trim(),
          answer: String(item.answer || '').trim(),
          source: item.source,
        }))
        .filter((item) => item.question && item.answer)
        .filter((item) => {
          const normalized = normalizeFaqQuestion(item.question);
          if (!normalized || seenQuestions.has(normalized)) return false;
          seenQuestions.add(normalized);
          return true;
        });

      await updateClinic.mutateAsync({
        workflowFaqs,
      });

      toast.success(t('clinicPage.toasts.saveSuccess'));
    } catch {
      toast.error(t('clinicPage.toasts.saveError'));
    }
  };

  const customCompletedCount = customFaqs.filter((item) => item.question.trim() && item.answer.trim()).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 page-transition">
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">{t('clinicPage.faq.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('clinicPage.faq.description')}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{t('clinicPage.faq.title')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('clinicPage.faq.customDescription')}</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              {systemFaqs.length + customCompletedCount}/{systemFaqs.length + customFaqs.length}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/20 p-3 sm:p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">{t('clinicPage.faq.automaticTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('clinicPage.faq.automaticDescription')}</p>
            </div>

            <div className="space-y-3">
              {systemFaqs.map((faq, index) => (
                <div key={`${faq.question}-${index}`} className="space-y-2 rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{faq.question}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {t('clinicPage.faq.autoBadge')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t('clinicPage.faq.customTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('clinicPage.faq.customDescription')}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCustomFaq}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('clinicPage.faq.addButton')}
              </Button>
            </div>

            {customFaqs.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('clinicPage.faq.empty')}</p>
            )}

            <div className="space-y-3">
              {customFaqs.map((faq, index) => (
                <div key={`custom-faq-${index}`} className="space-y-2 rounded-md border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('clinicPage.faq.questionLabel')}</Label>
                    <Input
                      value={faq.question}
                      onChange={(e) => updateCustomFaq(index, 'question', e.target.value)}
                      placeholder={t('clinicPage.faq.questionPlaceholder')}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('clinicPage.faq.answerLabel')}</Label>
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => updateCustomFaq(index, 'answer', e.target.value)}
                      placeholder={t('clinicPage.faq.answerPlaceholder')}
                      rows={4}
                      maxLength={500}
                      className="resize-none min-h-[110px]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeCustomFaq(index)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('common.remove')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} disabled={updateClinic.isPending}>
              {updateClinic.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('common.save')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
