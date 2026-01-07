'use client';

import { useEffect } from 'react';

/**
 * Facebook SDK Component
 * Loads and initializes the Facebook JavaScript SDK for Embedded Signup
 *
 * This must be included in your app layout to enable Facebook Embedded Signup functionality.
 * See: https://developers.facebook.com/docs/whatsapp/embedded-signup/
 */

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface FacebookSDKProps {
  appId: string;
  version?: string;
}

export function FacebookSDK({ appId, version = 'v24.0' }: FacebookSDKProps) {
  useEffect(() => {
    // Skip if FB is already loaded
    if (window.FB) {
      return;
    }

    // Initialize Facebook SDK
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: version,
      });

      console.log('[Facebook SDK] Initialized successfully');
    };

    // Load the JavaScript SDK asynchronously
    (function (d, s, id) {
      const fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;

      const js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;

      fjs?.parentNode?.insertBefore(js, fjs);
    })(document, 'script', 'facebook-jssdk');

    return () => {
      // Cleanup - remove the script tag when component unmounts
      const script = document.getElementById('facebook-jssdk');
      if (script) {
        script.remove();
      }
    };
  }, [appId, version]);

  return null; // This component doesn't render anything
}
