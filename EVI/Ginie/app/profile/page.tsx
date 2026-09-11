"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnsavedChanges, UnsavedChangesModal } from "@/hooks/useUnsavedChanges";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";

interface ProfilePayload {
  display_name: string;
  wallet_address?: string | null;
  profile: {
    organization: string;
    role: string;
    location?: string;
    country?: string;
    state?: string;
    city?: string;
    avatar_url?: string;
    bio?: string;
    phone?: string;
    birthday?: string;
    gender?: string;
    social?: { github?: string; linkedin?: string; twitter?: string; telegram?: string };
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, entitlements, counts, loading, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [isEdit, setIsEdit] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // Track if form has unsaved changes

  // Unsaved changes warning
  const {
    showWarning,
    confirmNavigation,
    cancelNavigation,
  } = useUnsavedChanges(isDirty && isEdit, {
    message: "You have unsaved profile changes. Are you sure you want to leave?",
  });

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState("");
  const [proEnabled, setProEnabled] = useState<boolean>(false);
  const [jobsToday, setJobsToday] = useState<number>(0);
  const [jobsTotal, setJobsTotal] = useState<number>(0);

  const [org, setOrg] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [country, setCountry] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [city, setCity] = useState("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pruneLoading, setPruneLoading] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  // Validate field on change
  const validateField = useCallback((name: string, value: string): string => {
    switch (name) {
      case 'display_name':
        if (!value.trim()) return 'Display name is required';
        if (value.length > 80) return 'Display name must be 80 characters or less';
        return '';
      case 'organization':
        if (!value.trim()) return 'Organization is required';
        return '';
      case 'job_title':
        if (!value.trim()) return 'Job title is required';
        return '';
      case 'phone':
        if (value && !/^[+]?[0-9\s\-().]{7,20}$/.test(value)) return 'Please enter a valid phone number';
        return '';
      case 'github':
        if (value && !value.includes('github.com')) return 'Please enter a valid GitHub URL';
        return '';
      case 'linkedin':
        if (value && !value.includes('linkedin.com')) return 'Please enter a valid LinkedIn URL';
        return '';
      default:
        return '';
    }
  }, []);

  const handleFieldChange = useCallback((name: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setIsDirty(true); // Mark form as dirty when any field changes
    const error = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField]);

  // Wallet connection handler
  const handleConnectWallet = useCallback(async () => {
    try {
      setError('');
      connect({ connector: injected() });
    } catch (err: any) {
      setError('Failed to connect wallet. Please make sure you have MetaMask or another wallet installed.');
    }
  }, [connect]);

  const handleDisconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const onSaveWallet = async () => {
    if (!isConnected || !address) return;
    setError("");
    setMsg("");
    setWalletSaving(true);
    try {
      const display = (displayName || user?.display_name || "").trim();
      const orgName = (org || user?.profile?.organization || "").trim();
      const roleName = (jobTitle || user?.profile?.role || "").trim();
      await api.updateProfile({
        display_name: display,
        wallet_address: address,
        profile: { organization: orgName, role: roleName },
      } as any);
      try { await refreshUser(); } catch {}
      setWalletAddress(address);
      setMsg("Wallet saved");
    } catch (err: any) {
      setError(err?.message || "Failed to save wallet");
    } finally {
      setWalletSaving(false);
    }
  };

  // Options
  const genderOptions = ["female", "male", "other", "prefer_not_to_say"];

  const shortenAddress = (addr?: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

  useEffect(() => {
    const u: any = user || {};
    const ent: any = entitlements || {};
    const c: any = counts || {};


    setEmail(u.email || "");
    setUserId(u.id ? String(u.id) : "");
    setDisplayName(u.display_name || "");
    setRole(u.role || "");
    setOrg(u.profile?.organization || "");
    setJobTitle(u.profile?.role || "");
    const loc = u.profile?.location || "";
    const parts = String(loc).split(/\s*[|,•]\s*|\s+-\s+/).filter(Boolean);
    setCountry(u.profile?.country || parts[0] || "");
    setStateRegion(u.profile?.state || parts[1] || "");
    setCity(u.profile?.city || parts[2] || "");

    const newAvatarUrl = u.profile?.avatar_url || u.avatar || u.picture || "";
    if (newAvatarUrl) {
      setAvatarUrl(newAvatarUrl);
      setAvatarErr(false);
    }

    setBio(u.profile?.bio || "");
    setPhone(u.profile?.phone || "");
    setWalletAddress(u.wallet_address || "");
    setProEnabled(!!ent.pro_enabled);
    setJobsToday(Number(c.jobs_today || 0));
    setJobsTotal(Number(c.jobs_total || 0));
    setBirthday(u.profile?.birthday || "");
    setGender(u.profile?.gender || "");
    setGithub(u.profile?.social?.github || "");
    setLinkedin(u.profile?.social?.linkedin || "");
    setTwitter(u.profile?.social?.twitter || "");
    setTelegram(u.profile?.social?.telegram || "");
  }, [user, entitlements, counts]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!displayName.trim() || !org.trim() || !jobTitle.trim()) {
      setError("Display name, organization and job title are required");
      return;
    }

    setSaving(true);
    const locationStr = [country.trim(), stateRegion.trim(), city.trim()].filter(Boolean).join(" • ");
    const bday = birthday.trim();
    const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(bday) ? bday : "";
    const g = gender.trim().toLowerCase();
    const validGender = ["female", "male", "other", "prefer_not_to_say"].includes(g) ? g : "";
    const payload: ProfilePayload = {
      display_name: displayName.trim(),
      wallet_address: walletAddress.trim() ? walletAddress.trim() : null,
      profile: {
        organization: org.trim(),
        role: jobTitle.trim(),
        ...(locationStr ? { location: locationStr } : {}),
        ...(country.trim() ? { country: country.trim() } : {}),
        ...(stateRegion.trim() ? { state: stateRegion.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(validBirthday ? { birthday: validBirthday } : {}),
        ...(validGender ? { gender: validGender } : {}),
        social: {
          ...(github.trim() ? { github: github.trim() } : {}),
          ...(linkedin.trim() ? { linkedin: linkedin.trim() } : {}),
          ...(twitter.trim() ? { twitter: twitter.trim() } : {}),
          ...(telegram.trim() ? { telegram: telegram.trim() } : {}),
        },
      },
    };

    try {
      const res = await api.updateProfile(payload);
      setMsg("Profile updated successfully");
      setIsDirty(false); // Reset dirty state after successful save
      try { await refreshUser(); } catch {}
      setIsEdit(false);
    } catch (err: any) {
      const msg = String(err?.message || "Failed to update profile");
      if ((err as any)?.status === 400 || /bad_request/i.test(msg)) {
        setError("Please check inputs. Remove invalid Avatar URL and ensure required fields are filled.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const onAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMsg("");
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Unsupported file type. Allowed: PNG, JPEG, WEBP");
      try { e.target.value = ""; } catch {}
      return;
    }
    const max = 6 * 1024 * 1024;
    if (file.size > max) {
      setError("File too large. Max 6 MB");
      try { e.target.value = ""; } catch {}
      return;
    }
    setAvatarUploading(true);
    try {
      const res = await api.uploadAvatar(file, file.type);
      const url = (res as any)?.avatar?.url;
      if (url) {
        setAvatarUrl(url);
        setAvatarErr(false);
      }
      try {
        await refreshUser();
      } catch {}
      setMsg("Avatar uploaded successfully! It may take a moment to appear.");
    } catch (err: any) {
      setError(err?.message || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      try { e.target.value = ""; } catch {}
    }
  };

  const onPruneAvatars = async (keepLatest?: number) => {
    setError("");
    setMsg("");
    setPruneLoading(true);
    try {
      const res = await api.pruneAvatars(keepLatest);
      try { await refreshUser(); } catch {}
      const pruned = (res as any)?.pruned;
      setMsg(typeof pruned === "number" ? `Pruned ${pruned} old avatar(s)` : "Pruned old avatars");
    } catch (err: any) {
      setError(err?.message || "Failed to prune avatars");
    } finally {
      setPruneLoading(false);
    }
  };

  const onDeleteAvatar = async () => {
    setError("");
    setMsg("");
    const url = avatarUrl || "";
    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const id = last.split("?")[0];
    if (!id) {
      setError("No avatar to delete");
      return;
    }
    try {
      await api.deleteAvatar(id);
      try { await refreshUser(); } catch {}
      setAvatarUrl("");
      setMsg("Avatar deleted");
    } catch (err: any) {
      setError(err?.message || "Failed to delete avatar");
    }
  };

  const initials = useMemo(() => {
    const base = displayName || email || "User";
    const parts = String(base).trim().split(/\s+/);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || (parts[0]?.[1] ?? "");
    return (a + (b || "")).toUpperCase();
  }, [displayName, email]);

  const planLabel = proEnabled ? "Pro" : "Free";

  // Simple resolved avatar URL - use proxy for relative URLs (handles auth), direct for absolute
  const resolvedAvatarUrl = useMemo(() => {
    if (!avatarUrl) return '';

    // If already a data URL, use directly
    if (avatarUrl.startsWith('data:')) return avatarUrl;

    // If absolute URL, use as-is
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;

    // For relative URLs like /u/user/avatar/{id}, use proxy (handles cookies/auth correctly)
    const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
    return `/api/proxy${path}`;
  }, [avatarUrl]);

  const handleAvatarError = useCallback(() => {
    setAvatarErr(true);
  }, []);

  return (
    <div className="min-h-screen w-full relative bg-black page-transition">
      <div className="absolute inset-0 z-0 bg-black" />

      <div className="relative z-10 min-h-[calc(100vh-60px)] flex flex-col items-center px-6 py-10 mt-24">
        <div className="w-full max-w-6xl space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">Profile</h1>
              <p className="text-white/60 text-sm mt-1">Manage your identity and account details</p>
            </div>
            <div>
              {!loading && (
                <Button onClick={() => setIsEdit((v) => !v)} className="bg-gray-600 text-white hover:bg-gray-500 font-medium">
                  {isEdit ? "Cancel Edit" : "Edit Profile"}
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-lg shadow-black/40">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-white/60">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 overflow-hidden">
                    {resolvedAvatarUrl && !avatarErr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvedAvatarUrl}
                        alt={displayName || email}
                        className="w-16 h-16 object-cover rounded-full"
                        onError={handleAvatarError}
                      />
                    ) : (
                      <span className="text-lg font-semibold text-white">{initials}</span>
                    )}
                  </span>
                  <div>
                    <div className="text-white text-sm">{email || ""}</div>
                    <div className="text-white text-lg font-medium">
                      {displayName ? displayName : <span className="text-white/50">Add display name</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/60 mt-1">
                      <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">{role || "normal"}</span>
                      <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">Plan: {planLabel}{!proEnabled && " (Pro disabled)"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 sm:mt-0">
                  <input id="avatar_file" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarFileChange} />
                  <Button onClick={() => (document.getElementById("avatar_file") as HTMLInputElement | null)?.click()} disabled={avatarUploading} className="bg-gray-600 text-white hover:bg-gray-500 font-medium">
                    {avatarUploading ? "Uploading…" : "Upload Avatar"}
                  </Button>
                  <Button variant="outline" onClick={() => onPruneAvatars()} disabled={pruneLoading} className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-white/5">
                    {pruneLoading ? "Pruning…" : "Prune Old"}
                  </Button>
                  {avatarUrl && (
                    <Button variant="destructive" onClick={onDeleteAvatar} className="bg-red-500/80 hover:bg-red-500">
                      Delete Avatar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch" style={{ gridAutoRows: '1fr' }}>
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg shadow-black/40 h-full flex flex-col">
                  <div className="text-white font-medium mb-4">Profile Information</div>
                  {!isEdit ? (
                    <div className="space-y-6 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-white/60 mb-1">Display Name</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{displayName || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">User Role</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{role || "normal"}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">Organization</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{org || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">Job Title / Role</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{jobTitle || <span className="text-white/40">Not set</span>}</div>
                        </div>
                      </div>
                      <div className="border-t border-white/10" />
                      <div>
                        <div className="text-white/60 text-sm mb-3">Location</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                          <div className="border border-white/10 rounded-lg px-3 py-2 text-white">{country || <span className="text-white/40">Not set</span>}</div>
                          <div className="border border-white/10 rounded-lg px-3 py-2 text-white">{stateRegion || <span className="text-white/40">Not set</span>}</div>
                          <div className="border border-white/10 rounded-lg px-3 py-2 text-white">{city || <span className="text-white/40">Not set</span>}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-white/60 mb-1">Birthday</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{birthday || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">Gender</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{gender || <span className="text-white/40">Not set</span>}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={onSave} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="display_name" className="block text-sm text-white/80 mb-2">Display Name</label>
                          <Input
                            id="display_name"
                            value={displayName}
                            onChange={(e) => handleFieldChange('display_name', e.target.value, setDisplayName)}
                            placeholder="Your name"
                            disabled={saving}
                            className={`w-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 ${fieldErrors.display_name ? 'border-red-500/50' : ''}`}
                          />
                          {fieldErrors.display_name && <p className="text-xs text-red-400 mt-1">{fieldErrors.display_name}</p>}
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-2">User Role</label>
                          <Input value={role} disabled className="w-full bg-white/5 border-white/10 text-white/70" />
                        </div>
                        <div>
                          <label htmlFor="organization" className="block text-sm text-white/80 mb-2">Organization</label>
                          <Input
                            id="organization"
                            value={org}
                            onChange={(e) => handleFieldChange('organization', e.target.value, setOrg)}
                            placeholder="Acme Inc."
                            disabled={saving}
                            className={`w-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 ${fieldErrors.organization ? 'border-red-500/50' : ''}`}
                          />
                          {fieldErrors.organization && <p className="text-xs text-red-400 mt-1">{fieldErrors.organization}</p>}
                        </div>
                        <div>
                          <label htmlFor="job_title" className="block text-sm text-white/80 mb-2">Job Title / Role</label>
                          <Input
                            id="job_title"
                            value={jobTitle}
                            onChange={(e) => handleFieldChange('job_title', e.target.value, setJobTitle)}
                            placeholder="Engineer"
                            disabled={saving}
                            className={`w-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 ${fieldErrors.job_title ? 'border-red-500/50' : ''}`}
                          />
                          {fieldErrors.job_title && <p className="text-xs text-red-400 mt-1">{fieldErrors.job_title}</p>}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/80 text-sm mb-2">Location</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                          <Input value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} placeholder="State" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="birthday" className="block text-sm text-white/80 mb-2">Birthday</label>
                          <Input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="YYYY-MM-DD" disabled={saving} className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                        <div>
                          <label htmlFor="gender" className="block text-sm text-white/80 mb-2">Gender</label>
                          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} disabled={saving} className="w-full rounded-md bg-white/5 border border-white/10 text-white px-3 py-2">
                            <option value="">Select gender</option>
                            {genderOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="bio" className="block text-sm text-white/80 mb-2">Bio</label>
                        <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about yourself" rows={4} disabled={saving} className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/40 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/20" />
                      </div>

                      {msg && (
                        <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg p-3 flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{msg}</span>
                        </div>
                      )}
                      {error && (
                        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <span>{error}</span>
                            {error.includes('required') && (
                              <p className="text-xs text-red-300/70 mt-1">Please fill in all required fields marked above.</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={saving} className="bg-white text-black hover:bg-slate-100">
                          {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ("Save Changes")}
                        </Button>
                        <Button type="button" variant="outline" disabled={saving} className="text-white border-white/20 hover:bg-white/5 bg-transparent" onClick={() => setIsEdit(false)}>Cancel</Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg shadow-black/40 h-full flex flex-col">
                  <div className="text-white font-medium mb-4">Contact Info</div>
                  {!isEdit ? (
                    <div className="space-y-6 text-sm">
                      <div>
                        <div className="text-white/60 mb-1">Email</div>
                        <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white break-all">{email}</div>
                      </div>
                      <div>
                        <div className="text-white/60 mb-1">Phone</div>
                        <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{phone || <span className="text-white/40">Not set</span>}</div>
                      </div>
                      <div>
                        <div className="text-white/60 mb-1">Wallet Address</div>
                        <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white">{walletAddress ? shortenAddress(walletAddress) : <span className="text-white/40">Not connected</span>}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm text-white/80 mb-2">Email</label>
                        <Input value={email} disabled className="w-full bg-white/5 border-white/10 text-white/70" />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm text-white/80 mb-2">Phone</label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(optional)" disabled={saving} className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                      </div>
                    </div>
                  )}
                  <div className="mt-5">
                    <div className="text-white font-medium mb-2">Wallet</div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white/80">
                        {isConnected ? `Connected: ${shortenAddress(address)}` : "Not connected"}
                      </div>
                      {isConnected ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDisconnectWallet}
                          disabled={isDisconnecting}
                          className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-white/5"
                        >
                          {isDisconnecting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Disconnecting...</>
                          ) : (
                            <><Wallet className="mr-2 h-4 w-4" />Disconnect</>
                          )}
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                onClick={handleConnectWallet}
                                disabled={isConnecting}
                                className="bg-gray-600 text-white hover:bg-gray-500 font-medium"
                              >
                                {isConnecting ? (
                                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
                                ) : (
                                  <><Wallet className="mr-2 h-4 w-4" />Connect Wallet</>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p>Connect your MetaMask or other browser wallet to enable wallet-based deployments and save your wallet address to your profile.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {isConnected && (!walletAddress || walletAddress.toLowerCase() !== String(address).toLowerCase()) && (
                      <div className="mt-3 flex justify-end">
                        <Button onClick={onSaveWallet} disabled={walletSaving} className="bg-gray-600 text-white hover:bg-gray-500 font-medium">
                          {walletSaving ? "Saving..." : "Save Wallet"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-5">
                    <div className="text-white font-medium mb-2">Social Links</div>
                    {!isEdit ? (
                      <div className="space-y-4 text-sm">
                        <div>
                          <div className="text-white/60 mb-1">GitHub</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white break-all">{github || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">LinkedIn</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white break-all">{linkedin || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">X (Twitter)</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white break-all">{twitter || <span className="text-white/40">Not set</span>}</div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">Telegram</div>
                          <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white break-all">{telegram || <span className="text-white/40">Not set</span>}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-sm text-white/80 mb-1">GitHub</label>
                          <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/username" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-1">LinkedIn</label>
                          <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-1">X (Twitter)</label>
                          <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/handle" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-1">Telegram</label>
                          <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" disabled={saving} className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Unsaved Changes Warning Modal */}
      <UnsavedChangesModal
        show={showWarning}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        message="You have unsaved profile changes. Are you sure you want to leave?"
      />
    </div>
  );
}
