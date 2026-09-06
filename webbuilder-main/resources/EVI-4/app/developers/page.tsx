"use client";

import Link from "next/link";
import { useState } from "react";
import { Code2, Terminal, PackageOpen, Box, BookOpen, ExternalLink, Copy, Sparkles, Cpu, Settings, Cloud, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import NetworkAnimation from "@/components/NetworkAnimation";

export default function DevelopersPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const npmUrl = "https://www.npmjs.com/package/@blockxai/camp-codegen?activeTab=readme";
  const pypiUrl = "https://pypi.org/project/camp-codegen/";

  return (
    <div className="relative">
      {/* Background Network Animation to match homepage */}
      <div className="absolute inset-0 opacity-20">
        <NetworkAnimation />
      </div>
      {/* Soft overlay for readability (light, no black) */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-orange-50/70 via-amber-50/60 to-transparent" />
      {/* Subtle animated glow behind header */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[48rem] rounded-full blur-3xl opacity-20 bg-gradient-to-r from-primary/40 via-purple-500/30 to-cyan-500/30 animate-pulse" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">
        <header className="text-center mb-12 relative z-10">
          <div className="mb-3 flex justify-end">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1 border-primary/30">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-400/10 text-xs text-orange-600">
            <Code2 className="h-3.5 w-3.5" />
            Developers
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
            Camp Codegen • Build with
            {" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent animate-pulse">
              CLI & SDK
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Generate → Compile → Deploy. Choose Node or Python. Stream logs, fetch artifacts, and ship faster.
          </p>

          {/* Hero feature chips */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-400/10 px-4 py-3 flex items-center gap-2 justify-center transition-transform hover:-translate-y-0.5">
              <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" /> Prompt → Solidity
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-400/10 px-4 py-3 flex items-center gap-2 justify-center transition-transform hover:-translate-y-0.5">
              <Cpu className="h-4 w-4 text-orange-500" /> AI Compile & Fix
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-400/10 px-4 py-3 flex items-center gap-2 justify-center transition-transform hover:-translate-y-0.5">
              <Cloud className="h-4 w-4 text-orange-500" /> One‑click Deploy
            </div>
          </div>
        </header>

        {/* CTA: Try the SDK in 1 line */}
        <section className="relative z-10 mb-10">
          <div className="rounded-2xl border border-orange-500/30 bg-white/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md p-6 shadow-[0_0_80px_-30px_rgba(251,146,60,0.55)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  <span className="bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">Try the SDK in 1 line</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Copy, paste, and run. Works out‑of‑the‑box.</p>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="rounded-lg border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-xs sm:text-sm flex items-center justify-between shadow-sm">
                  <span className="truncate">npx @blockxai/camp-codegen --help</span>
                  <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("npx @blockxai/camp-codegen --help", "cta-npx")}>
                    <Copy className="h-4 w-4" /> {copied === "cta-npx" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="rounded-lg border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-xs sm:text-sm flex items-center justify-between shadow-sm">
                  <span className="truncate">python -m camp_codegen --help</span>
                  <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("python -m camp_codegen --help", "cta-py")}>
                    <Copy className="h-4 w-4" /> {copied === "cta-py" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Primary CTAs */}
        <section className="relative z-10 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/pipeline" className="group block rounded-2xl border border-orange-500/30 bg-white/80 backdrop-blur p-5 hover:shadow-[0_0_60px_-25px_rgba(251,146,60,0.55)] transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <Sparkles className="h-5 w-5" /> Prompt → Solidity
                </div>
                <ExternalLink className="h-4 w-4 text-orange-500 opacity-70 group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Start the AI pipeline and generate production‑ready contracts.</p>
            </Link>
            <Link href="/pipeline" className="group block rounded-2xl border border-orange-500/30 bg-white/80 backdrop-blur p-5 hover:shadow-[0_0_60px_-25px_rgba(251,146,60,0.55)] transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <Cpu className="h-5 w-5" /> AI Compile & Fix
                </div>
                <ExternalLink className="h-4 w-4 text-orange-500 opacity-70 group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Compile, iterate on errors, and auto‑apply smart fixes.</p>
            </Link>
            <Link href="/deploy-token" className="group block rounded-2xl border border-orange-500/30 bg-white/80 backdrop-blur p-5 hover:shadow-[0_0_60px_-25px_rgba(251,146,60,0.55)] transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <Cloud className="h-5 w-5" /> One‑click Deploy
                </div>
                <ExternalLink className="h-4 w-4 text-orange-500 opacity-70 group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Deploy ERC‑20 instantly with a guided form.</p>
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-orange-500/20 bg-white/80 backdrop-blur hover:border-orange-500/40 transition-shadow hover:shadow-[0_0_60px_-20px_rgba(251,146,60,0.45)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-orange-500" />
                <span>Quick Start</span>
              </CardTitle>
              <CardDescription>Install the CLI for your preferred runtime</CardDescription>
              <div className="h-1 w-24 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-transparent animate-pulse" />
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="node">
                <TabsList>
                  <TabsTrigger value="node" className="flex items-center gap-1 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600"><Box className="h-4 w-4" /> Node.js</TabsTrigger>
                  <TabsTrigger value="python" className="flex items-center gap-1 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600"><PackageOpen className="h-4 w-4" /> Python</TabsTrigger>
                </TabsList>

                <TabsContent value="node" className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Install</h3>
                      <Link href={npmUrl} target="_blank" className="text-sm text-primary inline-flex items-center gap-1">
                        View on npm <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="mt-2 rounded border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-sm overflow-x-auto shadow-sm">
                      <div className="flex items-center justify-between">
                        <code>npm i -g @blockxai/camp-codegen</code>
                        <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("npm i -g @blockxai/camp-codegen", "npm-i-g")}>
                          <Copy className="h-4 w-4" /> {copied === "npm-i-g" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-sm overflow-x-auto shadow-sm">
                      <div className="flex items-center justify-between">
                        <code>npx @blockxai/camp-codegen --help</code>
                        <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("npx @blockxai/camp-codegen --help", "npx-help")}>
                          <Copy className="h-4 w-4" /> {copied === "npx-help" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold">Common workflow</h3>
                    <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      <li>Initialize a new contract workspace</li>
                      <li>Generate contract code from a natural-language prompt</li>
                      <li>Compile and iterate on errors using AI-assisted fixes</li>
                      <li>Deploy to your target network</li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">Refer to the npm README for the authoritative command list and flags.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold">SDK Quick Start (Node)</h3>
                    <div className="mt-2 rounded bg-white border border-orange-500/20 p-3 font-mono text-xs sm:text-sm overflow-x-auto shadow-sm">
                      <pre className="whitespace-pre leading-relaxed"><code>{`import { AcadClient } from "@blockxai/camp-codegen";

const client = new AcadClient();
const jobId = await client.start_pipeline_auto("ERC721 with minting");
const final = await client.wait_for_completion(jobId, { streamLogs: true });
console.log("Final:", final);

const sources = await client.get_sources(jobId);`}</code></pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="python" className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Install</h3>
                      <Link href={pypiUrl} target="_blank" className="text-sm text-primary inline-flex items-center gap-1">
                        View on PyPI <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="mt-2 rounded border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-sm overflow-x-auto shadow-sm">
                      <div className="flex items-center justify-between">
                        <code>pip install camp-codegen</code>
                        <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("pip install camp-codegen", "pip-install") }>
                          <Copy className="h-4 w-4" /> {copied === "pip-install" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-orange-500/20 bg-white text-slate-800 p-3 font-mono text-sm overflow-x-auto shadow-sm">
                      <div className="flex items-center justify-between">
                        <code>camp-codegen --help</code>
                        <Button variant="ghost" size="sm" className="hover:bg-orange-500/10 active:scale-95" onClick={() => copy("camp-codegen --help", "py-help") }>
                          <Copy className="h-4 w-4" /> {copied === "py-help" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold">Common workflow</h3>
                    <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      <li>Scaffold a project directory</li>
                      <li>Use prompt-driven generation to create contracts</li>
                      <li>Compile, test and iterate with AI-assisted fixes</li>
                      <li>Deploy and verify on supported explorers</li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">Refer to the PyPI README for the authoritative command list and flags.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold">SDK Quick Start (Python)</h3>
                    <div className="mt-2 rounded bg-white border border-orange-500/20 p-3 font-mono text-xs sm:text-sm overflow-x-auto shadow-sm">
                      <pre className="whitespace-pre leading-relaxed"><code>{`from acad_sdk import AcadClient

client = AcadClient()  # uses default Railway API and defaults
job_id = client.start_pipeline_auto(prompt="ERC721 with minting")
final = client.wait_for_completion(job_id, stream_logs=True)
print("Final:", final)

sources = client.get_sources(job_id)`}</code></pre>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-white/80 backdrop-blur hover:border-orange-500/40 transition-shadow hover:shadow-[0_0_60px_-20px_rgba(251,146,60,0.45)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-orange-500" /> Docs & Links</CardTitle>
              <CardDescription>Everything you need to get productive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={npmUrl} target="_blank" className="group block rounded border p-3 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-amber-400/10 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">@blockxai/camp-codegen (Node)</div>
                    <div className="text-xs text-muted-foreground">npm package and CLI usage</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-orange-500" />
                </div>
              </Link>
              <Link href={pypiUrl} target="_blank" className="group block rounded border p-3 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-amber-400/10 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">camp-codegen (Python)</div>
                    <div className="text-xs text-muted-foreground">PyPI package and CLI usage</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-orange-500" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Command palette style grid */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-1 flex items-center gap-2"><Terminal className="h-4 w-4 text-orange-500" /> Useful CLI commands</h2>
          <div className="h-1 w-28 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-transparent mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{
              title: 'Run AI pipeline', code: 'camp pipeline:start --prompt "ERC721 with minting"'
            }, {
              title: 'Get status', code: 'camp job:status <jobId>'
            }, {
              title: 'Stream logs', code: 'camp job:wait <jobId> --stream --timeout 900 --interval 2'
            }, {
              title: 'Fetch artifacts (all)', code: 'camp artifacts <jobId> --include all'
            }, {
              title: 'Deploy ERC20', code: 'camp erc20:deploy --name Token --symbol TKN --supply 1000000 --network basecamp'
            }, {
              title: 'AI compile', code: 'camp ai:compile --filename Foo.sol --code "..."'
            }].map((c, i) => (
              <Card key={i} className="group border-orange-500/20 bg-white/80 backdrop-blur hover:border-orange-500/40 transition-shadow hover:shadow-[0_0_50px_-18px_rgba(251,146,60,0.4)]">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4 text-orange-500" /> {c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded border border-orange-500/20 bg-white p-3 font-mono text-xs sm:text-sm flex items-center justify-between shadow-sm">
                    <span className="truncate">{c.code}</span>
                    <Button variant="ghost" size="sm" onClick={() => copy(c.code, `cmd-${i}`)}>
                      <Copy className="h-4 w-4" /> {copied === `cmd-${i}` ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Progressive disclosure: condensed into accordion */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-orange-500" /> Reference & Guides</h2>
          <div className="h-1 w-28 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-transparent mb-4" />
          <Accordion type="multiple" className="space-y-3">
            <AccordionItem value="environment" className="rounded-lg border bg-white/80 backdrop-blur hover:border-orange-500/40">
              <AccordionTrigger className="px-4 py-2">Environment (optional overrides)</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>ACAD_API_KEY</li>
                  <li>ACAD_AUTH_HEADER (default: X-API-Key)</li>
                  <li>ACAD_BASE_URL (default: production Railway)</li>
                  <li>ACAD_DEFAULT_NETWORK (default: basecamp)</li>
                  <li>ACAD_DEFAULT_OWNER</li>
                  <li>ACAD_MAX_ITERS (default: 5)</li>
                  <li>ACAD_DEFAULT_FILENAME (default: AIGenerated.sol)</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="api" className="rounded-lg border bg-white/80 backdrop-blur hover:border-orange-500/40">
              <AccordionTrigger className="px-4 py-2">API Reference (Production)</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded border p-3">
                    <div className="font-semibold">AI Pipeline</div>
                    <div className="text-muted-foreground mt-1">POST /api/ai/pipeline</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="font-semibold">Job Tracking</div>
                    <div className="text-muted-foreground mt-1">GET /api/job/:id/status • GET /api/job/:id/logs?since=0</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="font-semibold">Artifacts</div>
                    <div className="text-muted-foreground mt-1">GET /api/artifacts?include=all&jobId=... • /sources • /abis • /scripts</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="font-semibold">One‑Click ERC20</div>
                    <div className="text-muted-foreground mt-1">POST /api/deploy/erc20</div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="highlights" className="rounded-lg border bg-white/80 backdrop-blur hover:border-orange-500/40">
              <AccordionTrigger className="px-4 py-2">Highlights</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Prompt-to-contract generation</li>
                  <li>AI-assisted compile/fix loop</li>
                  <li>Deployment to supported networks</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="best" className="rounded-lg border bg-white/80 backdrop-blur hover:border-orange-500/40">
              <AccordionTrigger className="px-4 py-2">Best Practices</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Version control your prompts and outputs</li>
                  <li>Pin compiler and dependencies</li>
                  <li>Review and test generated code before deploy</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="support" className="rounded-lg border bg-white/80 backdrop-blur hover:border-orange-500/40">
              <AccordionTrigger className="px-4 py-2">Support</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground">Open an issue or reach out via community channels for assistance.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>
    </div>
  );
}
