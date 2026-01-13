// app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'gRPC Explorer',
  description: 'A web application for exploring and querying gRPC services',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'gRPC Explorer',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
