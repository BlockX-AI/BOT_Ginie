"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthHeading } from "@/components/auth/AuthHeading";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function SignInContent() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | undefined>(undefined);
  const [step, setStep] = useState<"send" | "verify">("send");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const sectionRef = useRef<HTMLElement | null>(null);
  const headingWrapRef = useRef<HTMLDivElement | null>(null);
  const formWrapRef = useRef<HTMLDivElement | null>(null);
  const formInnerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const headingWrap = headingWrapRef.current;
    const formWrap = formWrapRef.current;
    const formInner = formInnerRef.current;
    if (!section || !headingWrap || !formWrap || !formInner) return;

    // initial states: only heading visible
    gsap.set(headingWrap, {
      scale: 1.18,
      yPercent: 0,
      opacity: 1,
      transformOrigin: "50% 50%",
    });
    gsap.set(formWrap, { height: 0, opacity: 0, overflow: "hidden" });
    gsap.set(formInner, { y: 48, opacity: 1, pointerEvents: "none" });

    const tl = gsap.timeline({
      defaults: { ease: "power1.out" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=720",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    // 1) Shrink and nudge heading up
    tl.to(headingWrap, { scale: 0.92, yPercent: -18, duration: 0.5 })
      // 2) Reveal form area + slide it up
      .to(formWrap, { height: "auto", opacity: 1, duration: 0.6 }, "+=0.05")
      .to(formInner, { y: 0, pointerEvents: "auto", duration: 0.6 }, "<")
      // 3) small hold
      .to({}, { duration: 0.25 });

    // Ensure pin spacer + scroll range are calculated immediately on first load.
    const refresh = () => ScrollTrigger.refresh();
    refresh();
    const rafId = window.requestAnimationFrame(refresh);
    const timeoutId = window.setTimeout(refresh, 100);
    window.addEventListener("load", refresh, { once: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === section) st.kill();
      });
    };
  }, []);

  const setAuthCookie = () => {
    if (typeof document === "undefined") return;
    document.cookie = `evi_app_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  };

  const friendlyAuthError = (err: any) => {
    const status = err?.status as number | undefined;
    const code = String(err?.code || err?.message || "").toLowerCase();
    if (status === 404 || code.includes("user_not_found") || (code.includes("not") && code.includes("found"))) {
      return "User not found. Please create an account or sign up first.";
    }
    if (status === 409 || code.includes("user_exists") || code.includes("already")) {
      return "User already exists. Please sign in or use a different email.";
    }
    if (status === 429 || code.includes("rate") || code.includes("too many")) {
      return "Too many attempts. Please try again later.";
    }
    return err?.message || "Request failed";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setIsLoading(true);

    try {
      if (step === "send") {
        const res = await api.sendOtp(email.trim(), name.trim(), "signin");
        if ((res as any)?.ok === false) {
          setError(friendlyAuthError({ code: (res as any)?.error?.code }));
          return;
        }
        if ((res as any)?.challengeId) setChallengeId((res as any).challengeId);
        setStep("verify");
        setMsg("A verification code has been sent to your email.");
      } else {
        await api.verifyOtp(email.trim(), otp.trim(), challengeId, { mode: "signin", name: name.trim() || undefined });
        setAuthCookie();
        try { await api.me(); } catch {}
        const redirect = searchParams.get("redirect") || "/chat";
        router.push(redirect);
      }
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const onResend = async () => {
    setError("");
    setMsg("");
    setIsLoading(true);
    try {
      const res = await api.sendOtp(email.trim(), name.trim(), "signin");
      if ((res as any)?.ok === false) {
        setError(friendlyAuthError({ code: (res as any)?.error?.code }));
        return;
      }
      if ((res as any)?.challengeId) setChallengeId((res as any).challengeId);
      setMsg("Code resent. Check your inbox.");
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative bg-black">
      <section
        ref={sectionRef}
        className="relative min-h-screen overflow-hidden flex items-center justify-center"
      >
        <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center justify-center gap-6">
          <div ref={headingWrapRef}>
            <AuthHeading title="Sign in" className="mb-0" />
          </div>

          <div ref={formWrapRef} className="w-full">
            <div ref={formInnerRef}>
              <div className="relative overflow-hidden rounded-2xl p-8 border border-white/10 ring-1 ring-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.70)] backdrop-blur-md">
                <div
                  className="absolute inset-0 z-0"
                  style={{
                    backgroundImage:
                      "url('https://framerusercontent.com/images/9zvwRJAavKKacVyhFCwHyXW1U.png?width=1536&height=1024')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="absolute inset-0 z-10 bg-black/75" />
                <div className="absolute inset-0 z-10 bg-gradient-to-b from-white/10 via-transparent to-black/30" />

                <div className="relative z-20">
              <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm text-white/80 mb-2"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  className="w-full bg-black/30 border-transparent text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30"
                />
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm text-white/80 mb-2"
                >
                  Name <span className="text-white/40">(required)</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                  className="w-full bg-black/30 border-transparent text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30"
                />
              </div>

              {step === "verify" && (
                <div>
                  <label
                    htmlFor="otp"
                    className="block text-sm text-white/80 mb-2"
                  >
                    Enter verification code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      required
                      disabled={isLoading}
                      className="w-full bg-black/30 border-transparent text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onResend}
                      disabled={isLoading}
                      className="border-white/20 hover:bg-white/10"
                    >
                      Resend
                    </Button>
                  </div>
                </div>
              )}

              {msg && (
                <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg p-3">
                  {msg}
                </div>
              )}

              {error && (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-white text-black hover:bg-slate-100 font-medium h-12 force-black shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {step === "send" ? "Sending code..." : "Verifying..."}
                  </>
                ) : step === "send" ? (
                  "Send verification code"
                ) : (
                  "Verify & Continue"
                )}
              </Button>
              </form>

              <div className="mt-6 text-center text-sm text-white/60">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-white hover:underline font-medium"
                >
                  Sign Up
                </Link>
              </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-white/50" /></div>}>
      <SignInContent />
    </Suspense>
  );
}
