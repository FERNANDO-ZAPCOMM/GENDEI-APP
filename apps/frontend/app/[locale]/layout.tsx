import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AuthProvider } from '@/lib/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { AuthGuard } from '@/components/AuthGuard';
import { FacebookSDK } from '@/components/FacebookSDK';
import { Toaster } from 'sonner';
import { Urbanist, Roboto_Slab, Manrope } from 'next/font/google';
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

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${urbanist.variable} ${urbanist.className} ${robotoSlab.variable} ${manrope.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <QueryProvider>
              <FacebookSDK appId="1079223657476124" version="v24.0" />
              <AuthGuard>
                {children}
              </AuthGuard>
              <Toaster position="top-right" richColors />
            </QueryProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
