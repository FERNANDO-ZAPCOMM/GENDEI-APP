'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useWhatsAppMessaging } from '@/hooks/use-whatsapp-messaging';
import { validateE164, cleanPhoneNumber, formatPhoneNumber } from '@/lib/meta-utils';
import { toast } from 'sonner';

interface TestMessageFormProps {
  phoneNumberId: string;
  onSuccess?: (messageId: string) => void;
}

export function TestMessageForm({ phoneNumberId, onSuccess }: TestMessageFormProps) {
  const t = useTranslations();
  const [to, setTo] = useState('');
  const [sent, setSent] = useState(false);
  const [messageId, setMessageId] = useState<string>('');

  const { sendTestMessage, isSending, error } = useWhatsAppMessaging();

  const handleSend = () => {
    const cleanedPhone = cleanPhoneNumber(to);

    if (!validateE164(cleanedPhone)) {
      toast.error(
        t('settings.whatsapp.testMessage.invalidPhone') ||
        'Please enter a valid phone number in E.164 format (e.g., +1234567890)'
      );
      return;
    }

    sendTestMessage(
      { phoneNumberId, to: cleanedPhone },
      {
        onSuccess: (response) => {
          toast.success(
            t('settings.whatsapp.testMessage.success') ||
            'Test message sent successfully!'
          );
          setSent(true);
          if (response.messageId) {
            setMessageId(response.messageId);
          }
          if (onSuccess && response.messageId) {
            onSuccess(response.messageId);
          }
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to send test message');
        },
      }
    );
  };

  const handleReset = () => {
    setSent(false);
    setTo('');
    setMessageId('');
  };

  if (sent) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                {t('settings.whatsapp.testMessage.success') ||
                  'Test Message Sent!'}
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your WhatsApp Business Account is working correctly.
              </p>
              {messageId && (
                <p className="text-xs text-green-600 mt-2">
                  {t('settings.whatsapp.testMessage.messageId', { id: messageId }) ||
                    `Message ID: ${messageId}`}
                </p>
              )}
            </div>
            <Button onClick={handleReset} variant="outline" size="sm">
              Send Another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('settings.whatsapp.testMessage.title') || 'Send Test Message'}
        </CardTitle>
        <CardDescription>
          {t('settings.whatsapp.testMessage.subtitle') ||
            'Send a test message to verify your setup is working'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="to">
            {t('settings.whatsapp.testMessage.to') || 'Recipient Phone Number'}
          </Label>
          <Input
            id="to"
            type="tel"
            placeholder={
              t('settings.whatsapp.testMessage.toPlaceholder') || '+1 234 567 8900'
            }
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter phone number in E.164 format (e.g., +1234567890)
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Message:</strong> &quot;Hello! This is a test message from your WhatsApp
            Business Account.&quot;
          </p>
          <p className="text-xs text-blue-700 mt-1">
            This is a simple text message to verify your setup
          </p>
        </div>

        <Button
          onClick={handleSend}
          disabled={!to || isSending}
          className="w-full"
          size="lg"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t('settings.whatsapp.testMessage.send') || 'Send Test Message'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
