import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Camp Codegen - Build IP-native Apps & AI Agents in Minutes',
  description: 'One-click generator for IP-native dApps & AI agents. Powered by Camp Network with Origin SDK integration, mAItrix support, and auto-royalties.',
  keywords: 'IPFS, dApps, AI agents, blockchain development, web3, Camp Network, Origin SDK, smart contracts',
  authors: [{ name: 'Camp Network' }],
  metadataBase: new URL('https://camp.network'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Camp Codegen - Build IP-native Apps & AI Agents in Minutes',
    description: 'One-click generator for IP-native dApps & AI agents. Powered by Camp Network with Origin SDK integration, mAItrix support, and auto-royalties.',
    url: 'https://camp.network',
    siteName: 'Camp Codegen',
    images: [
      {
        url: 'https://camp.network/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Camp Codegen - Build IP-native Apps & AI Agents',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Camp Codegen - Build IP-native Apps & AI Agents in Minutes',
    description: 'One-click generator for IP-native dApps & AI agents. Powered by Camp Network.',
    creator: '@camp_network',
    images: ['https://camp.network/og-image.jpg'],
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
  verification: {
    google: 'YOUR_GOOGLE_VERIFICATION_CODE',
    yandex: 'YANDEX_VERIFICATION_CODE',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}>
  {children}
  <Toaster />
      </body>
    </html>
  );
}