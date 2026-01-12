import type { Metadata } from 'next';
import { Borel } from 'next/font/google';
import './globals.css';
import { AdminAuthProvider } from '@/lib/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { Toaster } from 'sonner';

const borel = Borel({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-borel',
});

export const metadata: Metadata = {
  title: 'Gendei Admin',
  description: 'Gendei Administration Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${borel.variable} antialiased`}>
        <QueryProvider>
          <AdminAuthProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                style: {
                  borderRadius: '9999px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                },
              }}
            />
          </AdminAuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
