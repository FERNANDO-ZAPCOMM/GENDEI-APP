'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useWhatsAppVerification } from '@/hooks/use-whatsapp-verification';
import { formatVerificationCode, validateVerificationCode } from '@/lib/meta-utils';
import { toast } from 'sonner';

interface NumberVerificationFormProps {
  phoneNumberId: string;
  phoneNumber: string;
  onVerified?: () => void;
}

type VerificationMethod = 'SMS' | 'VOICE';
type Step = 'request' | 'verify' | 'success';

export function NumberVerificationForm({
  phoneNumberId,
  phoneNumber,
  onVerified,
}: NumberVerificationFormProps) {
  const t = useTranslations();
  const [step, setStep] = useState<Step>('request');
  const [method, setMethod] = useState<VerificationMethod>('SMS');
  const [code, setCode] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const {
    requestCode,
    isRequestingCode,
    requestCodeError,
    registerNumber,
    isRegisteringNumber,
    registerNumberError,
  } = useWhatsAppVerification();

  // Countdown timer for resend
  useEffect(() => {
    if (step === 'verify' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [step, countdown]);

  const handleRequestCode = () => {
    requestCode(
      { phoneNumberId, method },
      {
        onSuccess: () => {
          toast.success(
            t('settings.whatsapp.verification.codeSent', { phone: phoneNumber }) ||
            `Verification code sent via ${method} to ${phoneNumber}`
          );
          setStep('verify');
          setCountdown(60);
          setCanResend(false);
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to send verification code');
        },
      }
    );
  };

  const handleResendCode = () => {
    setCountdown(60);
    setCanResend(false);
    handleRequestCode();
  };

  const handleVerify = () => {
    if (!validateVerificationCode(code)) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    const cleanCode = code.replace(/\D/g, '');

    registerNumber(
      { phoneNumberId, code: cleanCode },
      {
        onSuccess: () => {
          setStep('success');
          toast.success(
            t('settings.whatsapp.verification.success') ||
            'Phone number verified successfully!'
          );
          if (onVerified) {
            setTimeout(() => {
              onVerified();
            }, 1500);
          }
        },
        onError: (error: any) => {
          toast.error(
            error.message ||
            t('settings.whatsapp.errors.invalidCode') ||
            'Invalid verification code'
          );
        },
      }
    );
  };

  const handleCodeChange = (value: string) => {
    const formatted = formatVerificationCode(value);
    setCode(formatted);
  };

  if (step === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                {t('settings.whatsapp.verification.success') ||
                  'Phone Number Verified!'}
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your WhatsApp Business Account is now ready to use.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('settings.whatsapp.verification.title') || 'Verify Phone Number'}
        </CardTitle>
        <CardDescription>
          {t('settings.whatsapp.verification.subtitle') ||
            'Verify your phone number to send WhatsApp messages'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'request' && (
          <>
            <div>
              <Label className="text-base font-medium">
                {t('settings.whatsapp.verification.method') || 'Verification Method'}
              </Label>
              <RadioGroup
                value={method}
                onValueChange={(value) => setMethod(value as VerificationMethod)}
                className="mt-3 space-y-3"
              >
                <div className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-gray-50">
                  <RadioGroupItem value="SMS" id="sms" />
                  <Label htmlFor="sms" className="flex-1 cursor-pointer">
                    <div className="font-medium">
                      {t('settings.whatsapp.verification.sms') || 'SMS'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Receive a text message with the code
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-gray-50">
                  <RadioGroupItem value="VOICE" id="voice" />
                  <Label htmlFor="voice" className="flex-1 cursor-pointer">
                    <div className="font-medium">
                      {t('settings.whatsapp.verification.voice') || 'Voice Call'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Receive an automated call with the code
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Phone Number:</strong> {phoneNumber}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                A verification code will be sent to this number
              </p>
            </div>

            <Button
              onClick={handleRequestCode}
              disabled={isRequestingCode}
              className="w-full"
              size="lg"
            >
              {isRequestingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.whatsapp.verification.sendCode') || 'Send Verification Code'}
            </Button>
          </>
        )}

        {step === 'verify' && (
          <>
            <div>
              <Label htmlFor="code" className="text-base font-medium">
                {t('settings.whatsapp.verification.enterCode') || 'Enter 6-Digit Code'}
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="XXX-XXX"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                maxLength={7}
                className="mt-2 text-center text-2xl tracking-widest"
                autoComplete="off"
              />
              <p className="text-sm text-gray-500 mt-2">
                Code sent via {method} to {phoneNumber}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleVerify}
                disabled={!validateVerificationCode(code) || isRegisteringNumber}
                className="flex-1"
                size="lg"
              >
                {isRegisteringNumber && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('settings.whatsapp.verification.verify') || 'Verify'}
              </Button>
              <Button
                onClick={handleResendCode}
                disabled={!canResend || isRequestingCode}
                variant="outline"
                size="lg"
              >
                {isRequestingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {canResend
                  ? t('settings.whatsapp.verification.resend') || 'Resend'
                  : `${countdown}s`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
