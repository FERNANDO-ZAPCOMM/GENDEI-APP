'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Save, FileText, MessageSquare, Play, Flag, MousePointer, HelpCircle, Plus, Wand2, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TypingDots } from '@/components/PageLoader';
import { WorkflowWhatsAppPreview } from '@/components/chat/WorkflowWhatsAppPreview';
import type { WorkflowMode } from '@/lib/clinic-types';

interface FAQItem {
  question: string;
  answer: string;
}

export default function WorkflowPage() {
  const t = useTranslations();
  const { currentClinic, isLoading: clinicLoading, updateClinic, refetch } = useClinic();

  const [selectedMode, setSelectedMode] = useState<WorkflowMode>('booking');
  const [isSaving, setIsSaving] = useState(false);

  // Info mode specific fields
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [isGeneratingFaq, setIsGeneratingFaq] = useState(false);

  // Initialize from clinic data
  useEffect(() => {
    if (currentClinic) {
      if (currentClinic.workflowMode) {
        setSelectedMode(currentClinic.workflowMode);
      }
      // Load info mode settings if they exist
      const clinicData = currentClinic as any;
      if (clinicData.workflowTopic) setTopic(clinicData.workflowTopic);
      if (clinicData.workflowDescription) setDescription(clinicData.workflowDescription);
      if (clinicData.workflowWelcomeMessage) setWelcomeMessage(clinicData.workflowWelcomeMessage);
      if (clinicData.workflowCta) setCtaText(clinicData.workflowCta);
      if (clinicData.workflowFaqs) setFaqs(clinicData.workflowFaqs);
    }
  }, [currentClinic]);

  const handleModeSelect = (mode: WorkflowMode) => {
    setSelectedMode(mode);
  };

  const handleAddFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setFaqs([...faqs, { question: newQuestion.trim(), answer: newAnswer.trim() }]);
    setNewQuestion('');
    setNewAnswer('');
  };

  const handleRemoveFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const handleGenerateFaq = async () => {
    if (!description && !topic) {
      toast.error(t('workflowPage.toasts.faqFillRequired'));
      return;
    }
    setIsGeneratingFaq(true);
    // Simulate AI generation - in real implementation, this would call an API
    setTimeout(() => {
      const generatedFaqs: FAQItem[] = [
        { question: `Quais são os horários de funcionamento?`, answer: 'Funcionamos de segunda a sexta das 8h às 18h, e sábados das 8h às 12h.' },
        { question: `Quais especialidades vocês atendem?`, answer: 'Atendemos diversas especialidades médicas. Entre em contato para mais informações.' },
        { question: `Como faço para agendar uma consulta?`, answer: 'Para agendar, entre em contato pelo telefone ou WhatsApp da clínica.' },
      ];
      setFaqs([...faqs, ...generatedFaqs]);
      setIsGeneratingFaq(false);
      toast.success(t('workflowPage.toasts.faqGenerated'));
    }, 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        workflowMode: selectedMode
      };

      // Save info mode specific fields
      if (selectedMode === 'info') {
        updateData.workflowTopic = topic;
        updateData.workflowDescription = description;
        updateData.workflowWelcomeMessage = welcomeMessage;
        updateData.workflowCta = ctaText;
        updateData.workflowFaqs = faqs;
      }

      await updateClinic.mutateAsync(updateData);

      toast.success(
        selectedMode === 'booking'
          ? t('workflowPage.toasts.bookingActivated')
          : t('workflowPage.toasts.infoActivated')
      );

      refetch();
    } catch (error) {
      console.error('Error saving workflow mode:', error);
      toast.error(t('workflowPage.toasts.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <TypingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('workflowPage.title')}</h1>
        <p className="text-gray-600 mt-1">{t('workflowPage.description')}</p>
      </div>

      {/* Main Content - Side by side layout on desktop */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side - Settings */}
        <div className="flex-1 space-y-6">
          {/* Mode Selection Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t('workflowPage.modeCard.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                {/* Booking Mode */}
                <div
                  onClick={() => handleModeSelect('booking')}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedMode === 'booking'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{t('workflowPage.bookingMode.title')}</h4>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedMode === 'booking'
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedMode === 'booking' && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('workflowPage.bookingMode.description')}
                  </p>
                </div>

                {/* Info Mode */}
                <div
                  onClick={() => handleModeSelect('info')}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedMode === 'info'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{t('workflowPage.infoMode.title')}</h4>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedMode === 'info'
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedMode === 'info' && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('workflowPage.infoMode.description')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Mode - Flow Steps */}
          {selectedMode === 'booking' && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {/* Step 1 - Inicio */}
                <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">
                    1
                  </div>
                  <div className="p-2 rounded-lg bg-gray-100">
                    <Play className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{t('workflowPage.bookingSteps.step1.title')}</h4>
                    <p className="text-sm text-gray-500">{t('workflowPage.bookingSteps.step1.description')}</p>
                  </div>
                </div>

                {/* Step 2 - IA Assume */}
                <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 text-sm font-medium">
                    2
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{t('workflowPage.bookingSteps.step2.title')}</h4>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                        {t('workflowPage.bookingSteps.step2.badge')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{t('workflowPage.bookingSteps.step2.description')}</p>
                  </div>
                </div>

                {/* Step 3 - Fim */}
                <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">
                    3
                  </div>
                  <div className="p-2 rounded-lg bg-gray-100">
                    <Flag className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{t('workflowPage.bookingSteps.step3.title')}</h4>
                    <p className="text-sm text-gray-500">{t('workflowPage.bookingSteps.step3.description')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Mode Additional Settings */}
          {selectedMode === 'info' && (
            <>
              {/* Topic and Description Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t('workflowPage.topicCard.title')}</CardTitle>
                      <CardDescription>{t('workflowPage.topicCard.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">
                      {t('workflowPage.topicCard.topicLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={currentClinic?.name || t('workflowPage.topicCard.topicPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('workflowPage.topicCard.topicHelp')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('workflowPage.topicCard.descriptionLabel')}</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('workflowPage.topicCard.descriptionPlaceholder')}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('workflowPage.topicCard.descriptionHelp')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Welcome Message Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <MessageSquare className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t('workflowPage.welcomeCard.title')}</CardTitle>
                      <CardDescription>{t('workflowPage.welcomeCard.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Input
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder={t('workflowPage.welcomeCard.placeholder', { clinicName: currentClinic?.name || 'clinic' })}
                  />
                </CardContent>
              </Card>

              {/* CTA Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <MousePointer className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t('workflowPage.ctaCard.title')}</CardTitle>
                      <CardDescription>{t('workflowPage.ctaCard.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Input
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder={t('workflowPage.ctaCard.placeholder')}
                  />
                </CardContent>
              </Card>

              {/* FAQ Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100">
                        <HelpCircle className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{t('workflowPage.faqCard.title')}</CardTitle>
                        <CardDescription>{t('workflowPage.faqCard.description')}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateFaq}
                      disabled={isGeneratingFaq}
                    >
                      {isGeneratingFaq ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      {t('workflowPage.faqCard.generateButton')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Existing FAQs */}
                  {faqs.length > 0 && (
                    <div className="space-y-3">
                      {faqs.map((faq, index) => (
                        <div key={index} className="p-3 rounded-lg border bg-gray-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">{faq.question}</p>
                              <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveFaq(index)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <X className="h-4 w-4 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new FAQ */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="newQuestion">{t('workflowPage.faqCard.questionLabel')}</Label>
                      <Input
                        id="newQuestion"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder={t('workflowPage.faqCard.questionPlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newAnswer">{t('workflowPage.faqCard.answerLabel')}</Label>
                      <Textarea
                        id="newAnswer"
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        placeholder={t('workflowPage.faqCard.answerPlaceholder')}
                        rows={2}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddFaq}
                      disabled={!newQuestion.trim() || !newAnswer.trim()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('workflowPage.faqCard.addButton')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('workflowPage.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('workflowPage.saveButton')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Side - WhatsApp Preview */}
        <div className="hidden lg:block w-[380px] flex-shrink-0">
          <div className="sticky top-6">
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="pt-0 flex flex-col items-center">
                <WorkflowWhatsAppPreview
                  mode={selectedMode}
                  clinicName={currentClinic?.name}
                  topic={topic}
                  description={description}
                  welcomeMessage={welcomeMessage}
                />
                <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('workflowPage.preview')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
