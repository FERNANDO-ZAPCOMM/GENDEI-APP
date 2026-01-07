'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type CallbackStatus = 'processing' | 'success' | 'error';

function MetaCallbackContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'pt-BR';
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double processing
    if (processedRef.current) return;
    processedRef.current = true;

    // This page can receive params in two ways:
    // 1. From backend redirect: status=success/error, creatorId, wabaId, phoneNumberId
    // 2. Directly from Meta: waba_id, phone_number_id, state (when Meta redirects here directly)

    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');

    // Check for direct Meta redirect params (snake_case from Meta)
    const wabaIdDirect = searchParams.get('waba_id');
    const phoneNumberIdDirect = searchParams.get('phone_number_id');
    const codeParam = searchParams.get('code');
    const stateParam = searchParams.get('state');

    // Check for backend redirect params (camelCase from our backend)
    const creatorId = searchParams.get('creatorId');
    const wabaId = searchParams.get('wabaId') || wabaIdDirect;
    const phoneNumberId = searchParams.get('phoneNumberId') || phoneNumberIdDirect;

    // Helper to notify parent windows OR redirect on mobile
    const notifyParentOrRedirect = (msg: Record<string, unknown>, redirectOnSuccess = true) => {
      // Check if we're in a popup window
      const hasOpener = typeof window !== 'undefined' && window.opener;

      if (hasOpener) {
        // Popup mode - notify parent and close
        try {
          window.opener.postMessage(msg, '*');
        } catch (e) {
          console.error('Failed to notify opener:', e);
        }

        // Also try grandparent (in case of double popup)
        try {
          if (window.opener.opener) {
            window.opener.opener.postMessage(msg, '*');
          }
        } catch (e) {
        }
      } else if (redirectOnSuccess && msg.status === 'success') {
        // Mobile redirect mode - redirect back to WhatsApp settings
        // Use a timeout to show the success message first
        setTimeout(() => {
          router.push(`/${locale}/dashboard/whatsapp`);
        }, 2000);
        return; // Don't try to close
      } else if (!redirectOnSuccess || msg.status === 'error') {
        // Redirect back on error too
        setTimeout(() => {
          router.push(`/${locale}/dashboard/whatsapp`);
        }, 3000);
        return;
      }
    };

    // Legacy helper for backward compatibility
    const notifyParent = notifyParentOrRedirect;

    // CASE 0: Direct redirect from Meta with code+state (no waba_id)
    if (codeParam && stateParam && !wabaIdDirect) {
      setMessage(t('meta.callback.processing') || 'Completing WhatsApp connection...');

      const completeWithCode = async () => {
        try {
          const response = await fetch('/api/meta/embedded-signup/complete-code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: codeParam,
              state: stateParam,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to complete setup');
          }

          const result = await response.json();

          setStatus('success');
          setMessage(
            t('meta.callback.success') ||
              'Successfully connected your WhatsApp Business Account!'
          );

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'success',
            creatorId: result.creatorId,
            wabaId: result.wabaId,
            phoneNumberId: result.phoneNumberId,
          });

          // Close popup or redirect (mobile)
          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push(`/${locale}/dashboard/whatsapp`);
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error completing setup with code:', error);
          setStatus('error');
          setMessage(error.message || t('meta.callback.error') || 'Failed to complete WhatsApp setup');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'error',
            error: error.message || 'Failed to complete setup',
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push(`/${locale}/dashboard/whatsapp`);
            }
          }, 5000);
        }
      };

      completeWithCode();
      return;
    }

    // CASE 1: Direct redirect from Meta with waba_id (not via our backend)
    if (wabaIdDirect && stateParam) {
      setMessage(t('meta.callback.processing') || 'Completing WhatsApp connection...');

      // Call our backend API to complete the setup
      const completeSetup = async () => {
        try {
          // The state param contains the JWT with creatorId
          const response = await fetch('/api/meta/embedded-signup/complete-direct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
          setMessage(
            t('meta.callback.success') ||
              'Successfully connected your WhatsApp Business Account!'
          );

          // Notify parent window
          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'success',
            creatorId: result.creatorId,
            wabaId: wabaIdDirect,
            phoneNumberId: phoneNumberIdDirect,
          });

          // Close popup or redirect (mobile)
          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push(`/${locale}/dashboard/whatsapp`);
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error completing setup:', error);
          setStatus('error');
          setMessage(error.message || t('meta.callback.error') || 'Failed to complete WhatsApp setup');

          notifyParent({
            type: 'META_OAUTH_CALLBACK',
            status: 'error',
            error: error.message || 'Failed to complete setup',
          });

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              router.push(`/${locale}/dashboard/whatsapp`);
            }
          }, 5000);
        }
      };

      completeSetup();
      return;
    }

    // CASE 2: Redirect from our backend with status=success
    if (statusParam === 'success') {
      setStatus('success');
      setMessage(
        t('meta.callback.success') ||
          'Successfully connected your WhatsApp Business Account!'
      );

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'success',
        creatorId,
        wabaId,
        phoneNumberId,
      });

      // Close popup or redirect (mobile)
      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push(`/${locale}/dashboard/whatsapp`);
        }
      }, 2000);
    }
    // CASE 3: Redirect from our backend with status=error
    else if (statusParam === 'error') {
      setStatus('error');
      setMessage(
        messageParam ||
          t('meta.callback.error') ||
          'Failed to connect WhatsApp Business Account'
      );

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'error',
        error: messageParam || 'Failed to connect WhatsApp Business Account',
      });

      // Close popup or redirect (mobile)
      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push(`/${locale}/dashboard/whatsapp`);
        }
      }, 5000);
    }
    // CASE 4: No valid params - check if Meta sent us here without waba_id
    else {
      // Maybe Meta redirected here but didn't include waba_id in params
      // This happens when user cancels or there's an issue
      setStatus('error');
      setMessage(
        t('meta.callback.invalid') ||
          'WhatsApp connection was not completed. Please try again.'
      );

      notifyParent({
        type: 'META_OAUTH_CALLBACK',
        status: 'error',
        error: 'Connection not completed',
      });

      // Close popup or redirect (mobile)
      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          router.push(`/${locale}/dashboard/whatsapp`);
        }
      }, 3000);
    }
  }, [searchParams, t, router, locale]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {status === 'processing' && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {t('meta.callback.processing') || 'Processing...'}
                </h2>
                <p className="text-sm text-gray-600">
                  {t('meta.callback.processingDescription') ||
                    'Please wait while we complete your connection'}
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-green-900">
                  {t('meta.callback.successTitle') || 'Success!'}
                </h2>
                <p className="text-sm text-green-700">{message}</p>
                <p className="text-xs text-gray-500">
                  {t('meta.callback.closing') ||
                    'This window will close automatically...'}
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-red-900">
                  {t('meta.callback.errorTitle') || 'Connection Failed'}
                </h2>
                <p className="text-sm text-red-700">{message}</p>
                <p className="text-xs text-gray-500">
                  {t('meta.callback.closing') ||
                    'This window will close automatically...'}
                </p>
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
                <h2 className="text-xl font-semibold text-gray-900">
                  Loading...
                </h2>
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
