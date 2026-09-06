import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import HeroHeader from '@/components/HeroHeader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: {
    default: 'EVI — Build, Deploy and Scale with AI',
    template: '%s | EVI',
  },
  description:
    'EVI helps you generate, deploy and manage smart contracts, pipelines and AI-powered workflows — fast, secure and production‑ready.',
  keywords:
    'EVI, AI, smart contracts, deployment, pipelines, web3, grants, jobs, developers, generate, deploy',
  authors: [{ name: 'EVI' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'EVI — Build, Deploy and Scale with AI',
    description:
      'Generate and deploy contracts, jobs and pipelines with EVI’s AI‑driven toolkit.',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    siteName: 'EVI',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'EVI — Build, Deploy and Scale with AI',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EVI — Build, Deploy and Scale with AI',
    description: 'AI‑driven generation and deployment toolkit.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased  text-foreground overflow-x-hidden`}>
  <HeroHeader />
  {children}
  <Toaster />
      </body>
    </html>
  );
}