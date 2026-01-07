'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Copy, Check, ExternalLink, QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_PREFILLED_MESSAGE = 'Olá! Quero saber mais sobre...';

interface QRCodeData {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
}

interface QRCodesCardProps {
  phoneNumberId: string;
}

export function QRCodesCard({ phoneNumberId }: QRCodesCardProps) {
  const t = useTranslations();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState(DEFAULT_PREFILLED_MESSAGE);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const hasAutoCreated = useRef(false);

  // Fetch QR codes
  const { data: qrCodes, isLoading } = useQuery<QRCodeData[]>({
    queryKey: ['qr-codes', phoneNumberId],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/whatsapp/qr-codes?phoneNumberId=${phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch QR codes');
      }

      const data = await response.json();
      return data.data || [];
    },
    enabled: !!phoneNumberId,
  });

  // Create QR code mutation
  const createMutation = useMutation({
    mutationFn: async (prefilledMessage: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/qr-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumberId,
          prefilledMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create QR code');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-codes', phoneNumberId] });
      setNewMessage('');
      toast.success(t('whatsapp.qrCodes.createSuccess') || 'QR Code Created', {
        description: t('whatsapp.qrCodes.createSuccessDescription') || 'Your QR code has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast.error(t('whatsapp.qrCodes.createError') || 'Failed to create QR code', {
        description: error.message,
      });
    },
  });

  // Delete QR code mutation
  const deleteMutation = useMutation({
    mutationFn: async (codeId: string) => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/whatsapp/qr-codes/${codeId}?phoneNumberId=${phoneNumberId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete QR code');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-codes', phoneNumberId] });
      toast.success(t('whatsapp.qrCodes.deleteSuccess') || 'QR Code Deleted', {
        description: t('whatsapp.qrCodes.deleteSuccessDescription') || 'Your QR code has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast.error(t('whatsapp.qrCodes.deleteError') || 'Failed to delete QR code', {
        description: error.message,
      });
    },
  });

  // Auto-create default QR code if none exist
  useEffect(() => {
    if (
      !isLoading &&
      qrCodes !== undefined &&
      qrCodes.length === 0 &&
      !hasAutoCreated.current &&
      !createMutation.isPending
    ) {
      hasAutoCreated.current = true;
      createMutation.mutate(DEFAULT_PREFILLED_MESSAGE);
    }
  }, [isLoading, qrCodes, createMutation]);

  const handleCreate = () => {
    if (!newMessage.trim()) return;
    createMutation.mutate(newMessage.trim());
  };

  const copyToClipboard = async (text: string, codeId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(codeId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {t('whatsapp.qrCodes.title') || 'QR Codes & Short Links'}
        </CardTitle>
        <CardDescription>
          {t('whatsapp.qrCodes.description') || 'Create QR codes with pre-filled messages for customers to scan'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new QR code */}
        <div className="space-y-3">
          <Label htmlFor="prefilled-message">
            {t('whatsapp.qrCodes.prefilledMessage') || 'Pre-filled Message'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="prefilled-message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('whatsapp.qrCodes.messagePlaceholder') || 'Olá! Quero animar minha foto!'}
              className="flex-1"
            />
            <Button
              onClick={handleCreate}
              disabled={!newMessage.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">
                {t('whatsapp.qrCodes.create') || 'Create'}
              </span>
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            {t('whatsapp.qrCodes.messageHelp') || 'This message will be pre-filled when customers scan the QR code'}
          </p>
        </div>

        {/* List of QR codes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : qrCodes && qrCodes.length > 0 ? (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">
              {t('whatsapp.qrCodes.yourCodes') || 'Your QR Codes'} ({qrCodes.length})
            </h4>
            {qrCodes.map((qr) => (
              <div
                key={qr.code}
                className="border rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  {/* Left side - Message and URL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Mensagem</p>
                    <p className="text-sm text-gray-900 mb-2">
                      &quot;{qr.prefilled_message}&quot;
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 truncate max-w-[220px]">
                        {qr.deep_link_url}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(qr.deep_link_url, qr.code)}
                        className="h-7 w-7 p-0"
                      >
                        {copiedCode === qr.code ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 w-7 p-0"
                      >
                        <a href={qr.deep_link_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(qr.code)}
                        disabled={deleteMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Right side - QR Code (larger) */}
                  <div className="flex-shrink-0 p-2 bg-white rounded-lg border">
                    <QRCodeSVG
                      value={qr.deep_link_url}
                      size={140}
                      level="M"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <QrCode className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t('whatsapp.qrCodes.noQrCodes') || 'No QR codes yet'}</p>
            <p className="text-sm mt-1">
              {t('whatsapp.qrCodes.noQrCodesDescription') || 'Create your first QR code to get started'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
