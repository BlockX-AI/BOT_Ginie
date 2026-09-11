"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ChatNavbar } from "@/components/chat/ChatNavbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { Mail, Sparkles } from "lucide-react";

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isPro, loading, signOut, refreshUser } = useAuth();
  const [key, setKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [confetti, setConfetti] = useState<{ x: number; y: number; d: number; s: number }[]>([]);

  // Generate personalized email template
  const emailTemplate = useMemo(() => {
    const userName = user?.display_name || user?.name || "there";
    const userEmail = user?.email || "[your-email]";
    const userId = user?.id || "[user-id]";
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    return `Subject: Early Access Request for Ginie Pro - ${userName}

Hi Ginie Team,

I hope this message finds you well. My name is ${userName}, and I'm reaching out to request early access to Ginie Pro.

--- My Details ---
• Name: ${userName}
• Email: ${userEmail}
• User ID: ${userId}
• Request Date: ${currentDate}

--- Why I'm Interested ---
I've been exploring Ginie and I'm impressed by its capabilities for smart contract development and deployment. I believe Pro access would help me:

• [Describe your use case - e.g., Building DeFi protocols, NFT projects, etc.]
• [Mention any specific features you're excited about]
• [Share how you plan to use Ginie in your workflow]

--- My Background ---
• [Your role - e.g., Blockchain Developer, Founder, Student, etc.]
• [Your experience with Web3/Smart Contracts]
• [Any relevant projects you've worked on]

I would love the opportunity to be part of your early access program and provide valuable feedback to help improve the platform.

Thank you for considering my request!

Best regards,
${userName}
${userEmail}`;
  }, [user]);

  const handleOpenMail = () => {
    const subject = encodeURIComponent(`Early Access Request for Ginie Pro - ${user?.display_name || user?.name || "User"}`);
    const body = encodeURIComponent(emailTemplate.replace(/^Subject:.*\n\n/, ""));
    window.open(`mailto:support@ginie.app?subject=${subject}&body=${body}`, "_blank");
  };

  const burst = () => {
    const items = Array.from({ length: 60 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      d: Math.random() * 1200,
      s: 1 + Math.random() * 1.2,
    }));
    setConfetti(items);
    setTimeout(() => setConfetti([]), 2800);
  };

  const onRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || redeeming) return;
    setError("");
    setRedeeming(true);
    try {
      const res = await api.redeemKey(key.trim());
      setSuccess(true);
      try { await refreshUser(); } catch {}
      burst();
    } catch (err: any) {
      setError(err?.message || "Redeem failed");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black" />
    );
  }

  return (
    <div className="min-h-screen w-full relative bg-black page-transition">
      <div className="absolute inset-0 z-0 bg-black" />



      <div className="relative z-10 max-w-2xl mx-auto px-6 py-14 mt-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 text-xs mb-4">
            Subscription
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Upgrade to Pro</h1>
          <p className="text-white/60 mt-3">Unlock premium features with a redeem key.</p>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 overflow-hidden">
          <div className="absolute -inset-1 rounded-2xl opacity-20 blur-2xl" style={{ background: "conic-gradient(from 180deg at 50% 50%, #7c3aed, #22d3ee, #14b8a6, #7c3aed)" }} />
          <div className="relative">
            {isPro ? (
              <div className="text-center py-8">
                <div className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400">You are Pro</div>
                <p className="text-white/60 mt-2">Enjoy unlimited access and premium features.</p>
                <div className="mt-6 flex justify-center">
                  <Button className="bg-white text-black hover:bg-slate-100 force-black" onClick={() => router.push("/chat")}>Go to Chat</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Early Access Banner */}
                <div className="text-center py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-white/10">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400">
                      Early Access Program
                    </span>
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-white/70 text-sm">
                    Ginie Pro is currently <span className="text-amber-400 font-medium">invite-only</span> for early users.
                    <br />
                    Request access and get a redeem key to unlock all features!
                  </p>
                </div>

                {/* Redeem Key Section */}
                <form onSubmit={onRedeem} className="space-y-4">
                  <label className="block text-sm text-white/70">Already have a key? Enter it below:</label>
                  <input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full rounded-lg bg-black/40 border border-white/15 focus:border-white/30 outline-none text-white placeholder-white/30 px-4 py-3"
                  />
                  {error && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button disabled={redeeming || !key.trim()} className="bg-white text-black hover:bg-slate-100 disabled:opacity-50 force-black">
                      {redeeming ? "Redeeming…" : "Redeem & Upgrade"}
                    </Button>
                    <Button type="button" variant="outline" className="bg-black text-white border-white/20 hover:bg-white/5" onClick={() => router.push("/chat")}>Back to Chat</Button>
                  </div>
                  {success && (
                    <div className="mt-4 text-center">
                      <div className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400">Congratulations!</div>
                      <p className="text-white/70">Your account has been upgraded to Pro.</p>
                    </div>
                  )}
                </form>

                {/* Request Access Section */}
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-purple-400" />
                    Request Early Access
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    Don&apos;t have a key yet? Send us an email and we&apos;ll review your request.
                    Early adopters get <span className="text-green-400 font-medium">free lifetime access</span>!
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleOpenMail}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Request Early Access
                    </Button>
                  </div>

                  <p className="text-white/40 text-xs mt-4 text-center">
                    Send your request to <span className="text-purple-400 font-medium">support@ginie.app</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white/70 animate-ping"
                style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.s * 6}px`, height: `${c.s * 6}px`, animationDelay: `${c.d}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="text-white font-medium">Profile</div>
            <div className="mt-2"><Button variant="outline" className="text-black border-white/20 hover:bg-white/5" onClick={() => router.push("/profile")}>Open</Button></div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="text-white font-medium">My Projects</div>
            <div className="mt-2"><Button variant="outline" className="text-black border-white/20 hover:bg-white/5" onClick={() => router.push("/chat")}>Open</Button></div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="text-white font-medium">Logout</div>
            <div className="mt-2"><Button variant="destructive" className="bg-red-500/80 hover:bg-red-500" onClick={signOut}>Sign out</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
