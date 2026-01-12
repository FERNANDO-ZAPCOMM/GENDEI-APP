'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type CallbackStatus = 'processing' | 'success' | 'error';

function MetaCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');
    const wabaIdDirect = searchParams.get('waba_id');
    const phoneNumberIdDirect = searchParams.get('phone_number_id');
    const codeParam = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const creatorId = searchParams.get('creatorId');
    const wabaId = searchParams.get('wabaId') || wabaIdDirect;
    const phoneNumberId = searchParams.get('phoneNumberId') || phoneNumberIdDirect;

    const notifyParentOrRedirect = (msg: Record<string, unknown>, redirectOnSuccess = true) => {
      const hasOpener = typeof window !== 'undefined' && window.opener;

      if (hasOpener) {
        try {
          window.opener.postMessage(msg, '*');
        } catch (e) {
          console.error('Failed to notify opener:', e);
        }
        try {
          if (window.opener.opener) {
            window.opener.opener.postMessage(msg, '*');
          }
        } catch (e) {}
      } else if (redirectOnSuccess && msg.status === 'success') {
        setTimeout(() => {
          router.push('/pt-BR/dashboard/whatsapp');
        }, 2000);
        return;
      } else if (!redirectOnSuccess || msg.status === 'error') {
        setTimeout(() => {
          router.push('/pt-BR/dashboard/whatsapp');
        }, 3000);
        return;
      }
    };

    const notifyParent = notifyParentOrRedirect;

    // CASE 0: Direct redirect from Meta with code+state
    if (codeParam && stateParam && !wabaIdDirect) {
      setMessage('Completing WhatsApp connection...');

      const completeWithCode = async () => {
        try {
          const response = await fetch('/api/meta/embedded-signup/complete-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: codeParam, state: stateParam }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to complete setup');
          }

          const result = await response.json();
          setStatus('success');
          setMessage('Successfully connected your WhatsApp Business Account!');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'success',
            creatorId: result.creatorId,
            wabaId: result.wabaId,
            phoneNumberId: result.phoneNumberId,
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push('/pt-BR/dashboard/whatsapp');
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error completing setup with code:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to complete WhatsApp setup');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'error',
            error: error.message || 'Failed to complete setup',
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push('/pt-BR/dashboard/whatsapp');
            }
          }, 5000);
        }
      };

      completeWithCode();
      return;
    }

    // CASE 1: Direct redirect from Meta with waba_id
    if (wabaIdDirect && stateParam) {
      setMessage('Completing WhatsApp connection...');

      const completeSetup = async () => {
        try {
          const response = await fetch('/api/meta/embedded-signup/complete-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wabaId: wabaIdDirect,
              phoneNumberId: phoneNumberIdDirect,
              state: stateParam,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to complete setup');
          }

          const result = await response.json();
          setStatus('success');
          setMessage('Successfully connected your WhatsApp Business Account!');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'success',
            creatorId: result.creatorId,
            wabaId: wabaIdDirect,
            phoneNumberId: phoneNumberIdDirect,
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push('/pt-BR/dashboard/whatsapp');
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error completing setup:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to complete WhatsApp setup');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'error',
            error: error.message || 'Failed to complete setup',
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push('/pt-BR/dashboard/whatsapp');
            }
          }, 5000);
        }
      };

      completeSetup();
      return;
    }

    // CASE 2: Redirect from backend with status=success
    if (statusParam === 'success') {
      setStatus('success');
      setMessage('Successfully connected your WhatsApp Business Account!');

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'success',
        creatorId,
        wabaId,
        phoneNumberId,
      });

      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push('/pt-BR/dashboard/whatsapp');
        }
      }, 2000);
    }
    // CASE 3: Redirect from backend with status=error
    else if (statusParam === 'error') {
      setStatus('error');
      setMessage(messageParam || 'Failed to connect WhatsApp Business Account');

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'error',
        error: messageParam || 'Failed to connect WhatsApp Business Account',
      });

      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push('/pt-BR/dashboard/whatsapp');
        }
      }, 5000);
    }
    // CASE 4: No valid params
    else {
      setStatus('error');
      setMessage('WhatsApp connection was not completed. Please try again.');

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'error',
        error: 'Connection not completed',
      });

      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push('/pt-BR/dashboard/whatsapp');
        }
      }, 3000);
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {status === 'processing' && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Processing...</h2>
                <p className="text-sm text-gray-600">Please wait while we complete your connection</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-green-900">Success!</h2>
                <p className="text-sm text-green-700">{message}</p>
                <p className="text-xs text-gray-500">This window will close automatically...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-red-900">Connection Failed</h2>
                <p className="text-sm text-red-700">{message}</p>
                <p className="text-xs text-gray-500">This window will close automatically...</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MetaCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Loading...</h2>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <MetaCallbackContent />
    </Suspense>
  );
}
