import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Evita zoom no input no iOS
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'VacinAção',
  description: 'Acompanhamento do protocolo antirrábico',
  manifest: '/manifest.webmanifest', // O Next.js gera com essa extensão
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VacinAção',
  },
  formatDetection: {
    telephone: false, // Evita que o iOS transforme CPFs em links de telefone
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
