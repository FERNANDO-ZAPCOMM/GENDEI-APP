import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AuthProvider } from '@/lib/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { AuthGuard } from '@/components/AuthGuard';
import { VerticalProvider } from '@/lib/vertical-provider';
import { FacebookSDK } from '@/components/FacebookSDK';
import { Toaster } from 'sonner';
import { Urbanist, Roboto_Slab, Manrope, Borel } from 'next/font/google';
import '../globals.css';

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

const urbanist = Urbanist({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-urbanist',
});

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-roboto-slab',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
});

const borel = Borel({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
  variable: '--font-borel',
});

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${urbanist.variable} ${urbanist.className} ${robotoSlab.variable} ${manrope.variable} ${borel.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <QueryProvider>
              <VerticalProvider>
                <FacebookSDK appId={process.env.NEXT_PUBLIC_META_APP_ID || '1183114720193365'} version="v24.0" />
                <AuthGuard>
                  {children}
                  </AuthGuard>
              </VerticalProvider>
              <Toaster
                position="top-right"
                richColors
                toastOptions={{
                  style: {
                    borderRadius: '0px',
                  },
                }}
              />
            </QueryProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
