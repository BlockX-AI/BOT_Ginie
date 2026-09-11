"use client";
import React from "react";
import Link from "next/link";
import {
  NotepadTextDashed,
  Twitter,
  Linkedin,
  Github,
  Mail,
  Code2,
  MessageCircle,
  Send,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Custom Ginie Network Icon
const GinieNetworkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  brandDescription?: React.ReactNode;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "Ginie.",
  brandDescription = (
    <>
      Blockchain today is too technical, fragmented, and expensive. Ginie. changes that — transforming blockchain development into a conversation.
    </>
  ),
  socialLinks = [
    {
      icon: <Github className="w-full h-full" />,
      href: "https://github.com/ginie",
      label: "GitHub"
    },
    {
      icon: <MessageCircle className="w-full h-full" />,
      href: "https://discord.gg/ginie",
      label: "Discord"
    },
    {
      icon: <Send className="w-full h-full" />,
      href: "https://t.me/ginie",
      label: "Telegram"
    },
    {
      icon: <GinieNetworkIcon className="w-full h-full" />,
      href: "https://ginie.xyz",
      label: "Ginie"
    }
  ],
  navLinks = [
    { label: "Documentation", href: "/" },
    { label: "Templates", href: "/" },
    { label: "Tutorials", href: "/" },
    { label: "API Reference", href: "/" },

  ],
  creatorName = "Ginie",
  creatorUrl = "https://ginie.xyz",
  brandIcon,
  className,
}: FooterProps) => {
  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
  <footer className="font-body bg-background mt-20 relative">
        <div className="max-w-7xl mx-auto relative px-4 pt-10 pb-44 sm:pb-48 md:pb-44 min-h-[30rem] sm:min-h-[28rem] md:min-h-[26rem]">
          {/* Responsive two-column layout: left = description+social, right = nav links */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-start mb-6">
            {/* Left: description + social icons */}
            <div className="relative flex flex-col items-start md:items-start transform translate-y-0 md:-translate-y-8 z-20">
              <p className="text-muted-foreground font-semibold text-left w-full max-w-md px-0">
                {brandDescription}
              </p>

              {socialLinks.length > 0 && (
                <div className="flex flex-wrap mt-4 gap-3 items-center">
                  {socialLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      aria-label={link.label}
                      className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-muted-foreground hover:text-orange-500 transition-transform duration-200 bg-transparent"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="w-5 h-5 sm:w-6 sm:h-6">{link.icon}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right: navigation links */}
            <div className="flex flex-col items-start md:items-end md:justify-center">
              {navLinks.length > 0 && (
                <div className="flex flex-wrap justify-start md:justify-end gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground max-w-full px-0">
                  {navLinks.map((link, index) => (
                    <Link
                      key={index}
                      className="hover:text-orange-500 duration-300 hover:font-semibold"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-12 md:mt-16 z-30 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0">
            <p className="text-base text-muted-foreground text-center md:text-left z-20">
              ©{new Date().getFullYear()} {brandName}. All rights reserved.
            </p>

          </div>
        </div>

        {/* Large background text - FIXED */}
        <div
          className="bg-gradient-to-b from-foreground/20 via-foreground/10 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-28 sm:bottom-32 md:bottom-28 font-extrabold tracking-tighter pointer-events-none select-none text-center px-4 z-0"
          style={{
            fontSize: 'clamp(4rem, 16vw, 12rem)',
            maxWidth: '95vw'
          }}
        >
          {brandName.toUpperCase()}
        </div>

        {/* Bottom logo */}
        <div className="absolute hover:border-orange-500 duration-400 drop-shadow-[0_0px_20px_rgba(255,165,0,0.3)] dark:drop-shadow-[0_0px_20px_rgba(255,165,0,0.4)] bottom-16 sm:bottom-20 md:bottom-20 backdrop-blur-sm rounded-3xl bg-background/60 left-1/2 border-2 border-border hover:shadow-orange-500/20 flex items-center justify-center p-3 -translate-x-1/2 z-10">
          <div className="w-12 sm:w-16 md:w-24 h-12 sm:h-16 md:h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            {brandIcon || (
              <Code2 className="w-8 sm:w-10 md:w-14 h-8 sm:h-10 md:h-14 text-background drop-shadow-lg" />
            )}
          </div>
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-24 sm:bottom-28 backdrop-blur-sm h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent w-full left-1/2 -translate-x-1/2"></div>

        {/* Bottom shadow */}
        <div className="bg-gradient-to-t from-background via-background/80 blur-[1em] to-background/40 absolute bottom-20 sm:bottom-24 w-full h-24"></div>
      </footer>
    </section>
  );
};
