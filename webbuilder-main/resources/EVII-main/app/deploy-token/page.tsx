"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

function getExplorerUrl(network?: string, address?: string): string | undefined {
  if (!network || !address) return undefined;
  const map: Record<string, string> = {
    basecamp: `https://basecamp.cloud.blockscout.com/address/${address}`,
  };
  return map[network as keyof typeof map];
}

export default function DeployTokenPage() {
  const [name, setName] = useState("CampToken");
  const [symbol, setSymbol] = useState("CAMP");
  const [initialSupply, setInitialSupply] = useState("1000000");
  const [owner, setOwner] = useState("0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E");
  const [network, setNetwork] = useState("basecamp");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  async function onDeploy() {
    setError(null);
    setResult(null);
    if (!name.trim() || !symbol.trim() || !initialSupply.trim() || !owner.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await Api.deployErc20({ name, symbol, initialSupply, owner, network });
      if (res?.ok) {
        setResult(res.result);
      } else {
        setError("Deployment failed");
      }
    } catch (e: any) {
      setError(e?.message || "Deployment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      {/* Top Nav */}
      <div className="mb-2">
        <Link href="/" className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:bg-orange-50 border-orange-200 text-orange-700">
          ← Back to Home
        </Link>
      </div>
      <section className="hero-section">
        <h1 className="hero-title text-black">Deploy ERC20 Token</h1>
        <p className="text-small mt-2 text-black">Create a production-ready ERC20 on <span className="font-semibold">Basecamp</span> in seconds.</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2">
          <Card className="card-main space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="CampToken" className="input-field text-black placeholder:text-gray-500" />
                <p className="text-xs text-muted-foreground mt-1">Human-readable token name (e.g., Camp Token).</p>
              </div>
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="CAMP" className="input-field text-black placeholder:text-gray-500" />
                <p className="text-xs text-muted-foreground mt-1">Short ticker symbol, 3–11 chars (e.g., CAMP).</p>
              </div>
              <div>
                <Label htmlFor="supply">Initial Supply</Label>
                <Input id="supply" value={initialSupply} onChange={(e) => setInitialSupply(e.target.value)} placeholder="1000000" className="input-field text-black placeholder:text-gray-500" />
                <p className="text-xs text-muted-foreground mt-1">Whole tokens to mint initially. Uses 18 decimals under the hood.</p>
              </div>
              <div>
                <Label htmlFor="owner">Owner Address</Label>
                <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="0x..." className="input-field text-black placeholder:text-gray-500" />
                <p className="text-xs text-muted-foreground mt-1">Admin wallet that can mint or manage roles (optional in some templates).</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1 block">Network</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="w-full input-field select-field text-black">
                    <SelectValue placeholder="Basecamp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basecamp">Basecamp</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Deploys to Basecamp with automatic explorer links.</p>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              <Button onClick={onDeploy} disabled={submitting} className="btn-primary">
                {submitting ? "Deploying…" : "Deploy Token"}
              </Button>
              <Button variant="secondary" className="btn-secondary" onClick={() => {
                setName("CampToken");
                setSymbol("CAMP");
                setInitialSupply("1000000");
                setOwner("0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E");
              }}>Reset</Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </Card>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          <Card className="card-feature">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Network</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted border">Basecamp</span>
            </div>
            <p className="text-sm text-muted-foreground">Fast, developer-friendly L2 with Blockscout explorer support.</p>
            <div className="mt-2 text-xs text-muted-foreground">Explorer: basecamp.cloud.blockscout.com</div>
          </Card>

          <Card className="card-feature">
            <h3 className="font-semibold mb-2">Tips for Tokenomics</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Pick a short, memorable symbol.</li>
              <li>Start with a reasonable supply (e.g., 1,000,000).</li>
              <li>Use a secure owner wallet for admin actions.</li>
            </ul>
          </Card>

          <Card className="card-feature">
            <h3 className="font-semibold mb-2">Live Preview</h3>
            <div className="text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Symbol</span>
                <span className="font-medium">{symbol || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Initial Supply</span>
                <span className="font-medium">{initialSupply ? Number(initialSupply).toLocaleString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Owner</span>
                <span className="font-mono text-xs break-all">{owner || '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-border overflow-hidden shadow-md">
          {/* Success Header */}
          <div className="bg-emerald-500 text-white px-4 py-3 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-emerald-600 text-sm">✓</span>
            <div>
              <div className="font-semibold">Deployment successful</div>
              <div className="text-xs opacity-90">Your ERC20 token is now live on-chain</div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-background p-4 sm:p-6 space-y-4">
            {/* badges */}
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-muted border">basecamp</span>
              {result?.symbol && <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200">{result.symbol}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Name</div>
                <div className="font-medium">{result.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Initial Supply</div>
                <div className="font-medium">{result.initialSupplyTokens || result.initialSupply}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Contract Address</div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm bg-orange-50 text-orange-900 border border-orange-200 rounded px-2 py-1 break-all">{result.address}</div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(result.address); toast({ title: "Copied address" }); }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Owner</div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm bg-orange-50 text-orange-900 border border-orange-200 rounded px-2 py-1 break-all">{result.owner}</div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(result.owner); toast({ title: "Copied owner" }); }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {getExplorerUrl(result.network, result.address) && (
                <a href={getExplorerUrl(result.network, result.address)} target="_blank" rel="noreferrer">
                  <Button className="btn-primary">Open in Blockscout</Button>
                </a>
              )}
              <Button
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast({ title: "Copied result JSON" }); }}
              >
                Copy Result JSON
              </Button>
              <Button variant="ghost" onClick={() => { setResult(null); }}>Deploy Another</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
