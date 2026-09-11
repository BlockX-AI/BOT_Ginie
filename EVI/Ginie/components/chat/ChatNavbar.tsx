import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { UserData } from "@/lib/utils";
import { ProjectsList } from "./ProjectsList";

interface ChatNavbarProps {
  isAuthenticated: boolean;
  userData: UserData | null;
  onSignOut: () => void;
}

export function ChatNavbar({
  isAuthenticated,
  userData,
  onSignOut,
}: ChatNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", onClickAway);
    return () => document.removeEventListener("click", onClickAway);
  }, []);

  const displayName = ((): string => {
    const name = (userData as any)?.display_name || (userData as any)?.name;
    if (typeof name === "string" && name.trim()) return name.trim();
    const email = (userData as any)?.email as string | undefined;
    if (email) return email.split("@")[0];
    return "User";
  })();

  const rawAvatar = (userData as any)?.profile?.avatar_url as string | undefined;
  const [avatarErr, setAvatarErr] = useState(false);

  // Reset avatar error when avatar URL changes
  useEffect(() => {
    setAvatarErr(false);
  }, [rawAvatar]);

  // Use proxy for relative URLs (handles cookies/auth), direct for absolute URLs
  const avatarSrc = rawAvatar
    ? (rawAvatar.startsWith('data:')
        ? rawAvatar
        : /^https?:\/\//i.test(rawAvatar)
          ? rawAvatar
          : `/api/proxy${rawAvatar.startsWith('/') ? rawAvatar : `/${rawAvatar}`}`)
    : undefined;

  const handleAvatarError = () => {
    console.log('[ChatNavbar Avatar] Load failed for:', avatarSrc);
    setAvatarErr(true);
  };
  const initials = ((): string => {
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0]?.[0] || "U";
    const second = parts[1]?.[0] || (parts[0]?.[1] ?? "");
    return (first + (second || "")).toUpperCase();
  })();
  return (
    <nav className="relative z-20 border-b border-white/5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-white font-semibold text-lg">Ginie</div>
        <div className="flex items-center gap-2" ref={menuRef}>
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white/5 border border-white/10 text-white"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                  {avatarSrc && !avatarErr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt={displayName} className="w-8 h-8 object-cover" onError={handleAvatarError} />
                  ) : (
                    <span className="text-sm font-semibold">{initials}</span>
                  )}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-[#0a0a0a] shadow-xl z-50">
                  <div className="py-2">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Profile
                    </Link>

                    <Link
                      href="/subscription"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Subscription
                    </Link>

                    <ProjectsList
                      trigger={
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                          onClick={() => setMenuOpen(false)}
                        >
                          My Projects
                        </button>
                      }
                    />

                    <button
                      onClick={() => { setMenuOpen(false); onSignOut(); }}
                      className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/signin">
                <Button
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/5 bg-transparent"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-white text-black hover:bg-slate-100">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
