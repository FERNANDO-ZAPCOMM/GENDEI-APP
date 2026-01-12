'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFacebookSDK } from '@/hooks/use-facebook-sdk';
import { toast } from 'sonner';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1183114720193365';
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || '1588166288879632';

interface ConnectMetaButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ConnectMetaButton({
  onSuccess,
  onError,
  className,
  disabled = false,
}: ConnectMetaButtonProps) {
  const t = useTranslations();
  const { getIdToken } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const { isLoaded: isFBLoaded, launchWhatsAppSignup } = useFacebookSDK({
    appId: META_APP_ID,
  });

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      console.log('[ConnectMetaButton] Starting WhatsApp connection...');

      // Get Firebase ID token for backend calls
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Check if FB SDK is loaded
      if (!isFBLoaded) {
        console.log('[ConnectMetaButton] FB SDK not loaded yet, waiting...');
        toast.error('Facebook SDK is loading. Please try again in a moment.');
        setIsConnecting(false);
        return;
      }

      console.log('[ConnectMetaButton] Launching WhatsApp Embedded Signup via FB SDK...');

      // Use FB SDK to launch Embedded Signup
      // This handles the popup internally and returns result via callback
      const result = await launchWhatsAppSignup(META_CONFIG_ID);

      console.log('[ConnectMetaButton] FB.login result:', result);

      if (!result.authResponse) {
        throw new Error('Authorization was cancelled or failed');
      }

      // Extract the access token and WABA info
      const { accessToken, code } = result.authResponse;
      const wabaId = result.waba_id;
      const phoneNumberId = result.phone_number_id;

      console.log('[ConnectMetaButton] Auth response received:', {
        hasAccessToken: !!accessToken,
        hasCode: !!code,
        wabaId,
        phoneNumberId,
      });

      // Send to backend to complete the setup
      // The backend will exchange the code/token and store the connection
      // For FB SDK codes, try without redirect_uri (Meta may not require it for SDK-generated codes)
      console.log('[ConnectMetaButton] Sending to backend (FB SDK flow, no redirectUri)');

      const completeResponse = await fetch('/api/meta/embedded-signup/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken,
          code,
          wabaId,
          phoneNumberId,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.message || 'Failed to complete WhatsApp setup');
      }

      const completeResult = await completeResponse.json();
      console.log('[ConnectMetaButton] Setup completed:', completeResult);

      toast.success('WhatsApp Business connected successfully!');
      if (onSuccess) onSuccess();

    } catch (error: any) {
      console.error('[ConnectMetaButton] Error:', error);
      const errorMessage = error.message || 'Failed to connect WhatsApp';
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`animated-gradient-border ${className || ''}`}>
      <button
        type="button"
        onClick={handleConnect}
        disabled={disabled || isConnecting}
        className="animated-gradient-border-inner"
      >
        {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isConnecting
          ? t('settings.whatsapp.connectingStatus') || 'Connecting...'
          : t('settings.whatsapp.connectButtonText') || 'Connect WhatsApp Business'}
      </button>
    </div>
  );
}
