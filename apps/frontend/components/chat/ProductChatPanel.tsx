'use client';

import { useEffect, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { SlidePanel } from './SlidePanel';
import { MessageList } from './MessageList';
import { StepRenderer } from './StepRenderer';
import { WhatsAppPreview } from './WhatsAppPreview';
import { useProductChatEngine } from './useProductChatEngine';
import { uploadFile, type UploadProgress } from '@/lib/upload';
import { toast } from 'sonner';
import { AuthContext } from '@/lib/auth-provider';

interface ProductChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  creatorId: string;
  productType?: string; // Product type selected before chat begins
}

export function ProductChatPanel({
  isOpen,
  onClose,
  onSave,
  creatorId,
  productType,
}: ProductChatPanelProps) {
  const auth = useContext(AuthContext);
  const {
    messages,
    productData,
    currentStep,
    isTyping,
    isComplete,
    isUploading,
    setIsUploading,
    initialize,
    processStepResponse,
    reset,
    progress,
  } = useProductChatEngine({ getIdToken: auth?.getIdToken });

  // Initialize conversation when panel opens
  useEffect(() => {
    if (isOpen) {
      initialize(productType);
    }
  }, [isOpen, initialize, productType]);

  // Handle file upload
  const handleFileUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const url = await uploadFile({
        file,
        creatorId,
        onProgress: (progress: UploadProgress) => {
          if (progress.status === 'uploading') {
            toast.info(`enviando... ${Math.round(progress.progress)}%`);
          }
        },
      });
      toast.success('Arquivo enviado com sucesso!');
      return url;
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      await onSave(productData);
      toast.success('Produto cadastrado com sucesso! 🎉');
      reset();
      onClose();
    } catch (error) {
      toast.error('Erro ao salvar produto');
    }
  };

  // Handle close
  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Produto"
      subtitle="Cadastro conversacional"
      width="full"
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          {/* Messages */}
          <MessageList messages={messages} isTyping={isTyping} />

          {/* Input Area */}
          {!isComplete && (
            <StepRenderer
              step={currentStep}
              onSubmit={processStepResponse}
              onFileUpload={handleFileUpload}
              disabled={isTyping}
              isUploading={isUploading}
            />
          )}

          {/* Complete State */}
          {isComplete && (
            <div className="p-4 border-t bg-white flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Salvar Produto
              </Button>
            </div>
          )}

          {/* Progress Bar */}
          <div className="px-4 py-2 border-t bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Progresso</span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="w-96 shrink-0 bg-slate-50 p-4 overflow-y-auto hidden lg:block">
          <WhatsAppPreview productData={productData} />
        </div>
      </div>
    </SlidePanel>
  );
}
