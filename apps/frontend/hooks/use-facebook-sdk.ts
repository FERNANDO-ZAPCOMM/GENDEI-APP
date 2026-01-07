'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Note: Window.FB and Window.fbAsyncInit are declared in components/FacebookSDK.tsx

interface FBLoginResponse {
  authResponse?: {
    accessToken: string;
    userID: string;
    code?: string;
    expiresIn: number;
    signedRequest: string;
    graphDomain: string;
    data_access_expiration_time: number;
  };
  status: 'connected' | 'not_authorized' | 'unknown';
}

interface WhatsAppSignupResponse {
  authResponse?: FBLoginResponse['authResponse'];
  status: FBLoginResponse['status'];
  // WhatsApp Embedded Signup may return these
  waba_id?: string;
  phone_number_id?: string;
}

interface SessionInfoResponse {
  waba_id?: string;
  phone_number_id?: string;
}

interface UseFacebookSDKOptions {
  appId: string;
  version?: string;
}

export function useFacebookSDK({ appId, version = 'v24.0' }: UseFacebookSDKOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfoRef = useRef<SessionInfoResponse | null>(null);

  useEffect(() => {
    // Check if already loaded
    if (window.FB) {
      setIsLoaded(true);
      return;
    }

    // Define fbAsyncInit before loading script
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: version,
      });

      // Subscribe to auth response changes
      window.FB?.Event.subscribe('auth.statusChange', (response: any) => {
      });

      setIsLoaded(true);
    };

    // Load FB SDK script if not already present
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    return () => {
      // Cleanup not needed - SDK should persist
    };
  }, [appId, version]);

  const launchWhatsAppSignup = useCallback(
    (configId: string): Promise<WhatsAppSignupResponse> => {
      return new Promise((resolve, reject) => {
        if (!window.FB) {
          reject(new Error('Facebook SDK not loaded'));
          return;
        }

        setIsLoading(true);
        setError(null);
        sessionInfoRef.current = null;

        // Session info callback - this is called when user finishes WhatsApp setup
        // IMPORTANT: This must be subscribed BEFORE calling FB.login
        const sessionInfoListener = (response: SessionInfoResponse) => {
          if (response.waba_id || response.phone_number_id) {
            sessionInfoRef.current = response;
          }
        };

        // Also listen for postMessage events from the popup (fallback approach)
        const messageHandler = (event: MessageEvent) => {
          // Only accept messages from Facebook domains
          if (!event.origin.includes('facebook.com')) return;


          // Try to extract session info from the message
          let msg = event.data;

          // If event.data is a string, try to parse it as JSON
          if (typeof msg === 'string') {
            try {
              msg = JSON.parse(msg);
            } catch (e) {
              // Not JSON, skip
              return;
            }
          }

          if (msg && typeof msg === 'object') {

            // Handle WA_EMBEDDED_SIGNUP message format
            // Structure: { data: { waba_id, phone_number_id, ... }, type: "WA_EMBEDDED_SIGNUP", event: "FINISH" }
            if (msg.type === 'WA_EMBEDDED_SIGNUP') {

              // Try to get data from msg.data (nested format)
              const dataObj = msg.data || msg;
              const wabaId = dataObj.waba_id || dataObj.wabaId;
              const phoneNumberId = dataObj.phone_number_id || dataObj.phoneNumberId;


              if (wabaId || phoneNumberId) {
                sessionInfoRef.current = {
                  waba_id: wabaId,
                  phone_number_id: phoneNumberId,
                };
              }
            }
            // Also handle flat format just in case
            else if (msg.waba_id || msg.phone_number_id || msg.wabaId || msg.phoneNumberId) {
              const wabaId = msg.waba_id || msg.wabaId;
              const phoneNumberId = msg.phone_number_id || msg.phoneNumberId;
              sessionInfoRef.current = {
                waba_id: wabaId,
                phone_number_id: phoneNumberId,
              };
            }
          }
        };

        // Add message listener before FB.login
        window.addEventListener('message', messageHandler);

        // Subscribe to session info event BEFORE calling FB.login
        // This is critical - the event fires during the signup flow
        try {
          window.FB?.Event.subscribe('whatsapp_embedded_signup', sessionInfoListener);
        } catch (e) {
        }

        // Detect if user is on mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Launch WhatsApp Embedded Signup with configuration
        // Using the recommended approach from Meta documentation
        // On mobile, we need to use 'page' display mode for redirect-based flow
        window.FB?.login(
          function (response: any) {
            setIsLoading(false);


            // Wait a moment for sessionInfo event to fire
            // The event may come slightly after or before the login callback
            setTimeout(() => {
              // Clean up message listener
              window.removeEventListener('message', messageHandler);

              if (response.authResponse) {
                // Build the result with auth info
                const result: WhatsAppSignupResponse = {
                  authResponse: response.authResponse,
                  status: response.status,
                };

                // Check session info captured from callback
                if (sessionInfoRef.current) {
                  result.waba_id = sessionInfoRef.current.waba_id;
                  result.phone_number_id = sessionInfoRef.current.phone_number_id;
                } else {
                }

                resolve(result);
              } else {
                const errorMsg = response.status === 'not_authorized'
                  ? 'User cancelled or denied authorization'
                  : 'Login failed - no auth response';
                setError(errorMsg);
                reject(new Error(errorMsg));
              }
            }, 500); // Increased timeout to give more time for session info
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            // Use 'popup' on desktop, 'page' (redirect) on mobile
            display: isMobile ? 'page' : 'popup',
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          }
        );
      });
    },
    []
  );

  return {
    isLoaded,
    isLoading,
    error,
    launchWhatsAppSignup,
  };
}
