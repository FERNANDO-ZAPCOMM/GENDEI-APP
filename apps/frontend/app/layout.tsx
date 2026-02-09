import type { Metadata, Viewport } from "next";
import '@xyflow/react/dist/style.css';

export const metadata: Metadata = {
  title: "Gendei - Agendamento de Consultas via WhatsApp",
  description: "Plataforma de agendamento de consultas via WhatsApp para clínicas",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#10b981', // Emerald-500 for Gendei brand
};

// Root layout - just pass through children
// The actual html/body tags are in [locale]/layout.tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
