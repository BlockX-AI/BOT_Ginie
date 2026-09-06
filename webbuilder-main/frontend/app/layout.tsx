import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { Outfit } from "next/font/google";
import "@fontsource/geist";
import "@fontsource/jetbrains-mono";
import "@fontsource/outfit";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  ),
  title: "EVI — Build, Deploy and Scale with AI",
  description: "Generate and deploy contracts, jobs and pipelines with EVI's AI-driven toolkit.",
  icons: {
    icon: "/logo2.png",
  },
  openGraph: {
    title: "EVI — AI Blockchain Co-Pilot",
    description:
      "From Idea to Verified Smart Contract in One Chat. Build, deploy, verify, audit, and ensure compliance—all through a simple conversation.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "EVI Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EVI — AI Blockchain Co-Pilot",
    description:
      "From Idea to Verified Smart Contract in One Chat. Don't code, just chat the chain.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${jetbrainsMono.variable} ${outfit.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
