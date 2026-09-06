'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Code, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusTracker } from '@/components/StatusTracker';
import { ContractPreview } from '@/components/ContractPreview';
import { Api } from '@/lib/api';

type JobStatus = 'idle' | 'generating' | 'compiling' | 'ready' | 'deploying' | 'deployed' | 'failed';

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('idle');
  const [sourceCode, setSourceCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const router = useRouter();

  // Map backend pipeline step/state to local UI status
  const mapStepToStatus = (state?: string, step?: string): JobStatus => {
    if (state === 'failed') return 'failed';
    if (state === 'completed') return step === 'deploy' ? 'deploying' : 'ready';
    switch (step) {
      case 'generate':
      case 'init':
        return 'generating';
      case 'compile':
        return 'compiling';
      case 'fix':
        return 'compiling';
      case 'deploy':
        return 'deploying';
      case 'complete':
        return 'ready';
      default:
        return 'generating';
    }
  };

  // Poll for job status
  useEffect(() => {
    if (!jobId || status === 'ready' || status === 'failed' || status === 'deployed') return;

    const interval = setInterval(async () => {
      try {
        const res = await Api.getJobStatus(jobId);
        const next = mapStepToStatus(res.data?.state, res.data?.step);
        // If job is ready, fetch the source code immediately
        if (next === 'ready' && !sourceCode) {
          fetchSourceCode();
        }
        // If backend includes deployment result, mark as deployed
        const addr = res.data?.result?.address;
        if (addr) {
          setDeployedAddress(addr);
          setStatus('deployed');
        } else {
          setStatus(next);
        }
      } catch (err) {
        // Tolerate transient errors (e.g., 404 while job warms up). Keep polling.
        console.warn('Transient polling error, will retry:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status, sourceCode]);

  const fetchSourceCode = async () => {
    if (!jobId) return;

    try {
      const res = await Api.getArtifactsSources(jobId);
      const sources = res.data?.sources || {};
      // pick the first .sol file content if available
      const first = Object.keys(sources).find((k) => k.endsWith('.sol')) || Object.keys(sources)[0];
      if (first) {
        setSourceCode(sources[first]);
      } else {
        throw new Error('No sources available');
      }
    } catch (err) {
      // Artifacts may not be ready yet; swallow and let next poll try again
      console.warn('Artifacts not ready yet, will retry on next poll:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for your smart contract');
      return;
    }

    setError(null);
    setStatus('generating');
    setSourceCode('');
    setDeployedAddress(null);

    try {
      const res = await Api.runPipeline({ prompt, network: 'basecamp' });
      setJobId(res.job.id);
      setStatus(mapStepToStatus(res.job.state, res.job.step));
    } catch (err) {
      console.error('Error generating contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
      setStatus('failed');
    }
  };

  const handleDeploySuccess = (result: any) => {
    setDeployedAddress(result.contractAddress);
    setStatus('deployed');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">AI-Powered Smart Contract Generator</h1>
        <p className="text-xl text-muted-foreground">
          Describe your smart contract in plain English and let our AI generate the Solidity code for you
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>1. Describe Your Contract</CardTitle>
          <CardDescription>
            What should your smart contract do? Be as specific as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt">Contract Description</Label>
              <Textarea
                id="prompt"
                placeholder="Example: Create an ERC20 token called 'MyToken' with symbol 'MTK' and 18 decimals. Include mint and burn functions that can only be called by the contract owner."
                className="min-h-[120px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={status === 'generating' || status === 'compiling'}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || status === 'generating' || status === 'compiling'}
              >
                {status === 'generating' || status === 'compiling' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {status === 'generating' ? 'Generating...' : 'Compiling...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Contract
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(status === 'generating' || status === 'compiling' || status === 'ready' || status === 'deploying' || status === 'deployed' || error) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>2. Generation Progress</CardTitle>
            <CardDescription>
              {status === 'generating' && 'Generating your smart contract...'}
              {status === 'compiling' && 'Compiling the generated code...'}
              {status === 'ready' && 'Your contract is ready to deploy!'}
              {status === 'deploying' && 'Deploying your contract...'}
              {status === 'deployed' && 'Contract successfully deployed!'}
              {status === 'failed' && 'There was an error processing your request.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusTracker
              status={status}
              error={error}
              className="mb-8"
            />

            {status === 'ready' || status === 'deploying' || status === 'deployed' ? (
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-xs mb-4">
                  <TabsTrigger value="preview">
                    <Code className="h-4 w-4 mr-2" />
                    Code Preview
                  </TabsTrigger>
                  <TabsTrigger value="deploy">
                    <Rocket className="h-4 w-4 mr-2" />
                    Deploy
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  {sourceCode ? (
                    <ContractPreview sourceCode={sourceCode} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Loading source code...</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="deploy">
                  <div className="p-6 border rounded-lg bg-muted/50">
                    <h3 className="text-lg font-medium mb-4">Deployment</h3>
                    {status === 'deployed' && deployedAddress ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                          <p className="font-medium text-green-800 dark:text-green-200">
                            Contract deployed successfully!
                          </p>
                          <div className="mt-2 p-3 rounded border bg-neutral-900 text-white dark:bg-neutral-900 dark:text-white border-neutral-800">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-mono break-all text-white">
                                {deployedAddress}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 text-white hover:bg-white/10"
                                onClick={() => {
                                  navigator.clipboard.writeText(deployedAddress);
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                            <div className="mt-3">
                              <a
                                href={`https://basecamp.cloud.blockscout.com/address/${deployedAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-white hover:underline"
                              >
                                View on Blockscout →
                              </a>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full mt-4"
                          onClick={() => {
                            setPrompt('');
                            setJobId(null);
                            setStatus('idle');
                            setSourceCode('');
                            setDeployedAddress(null);
                            setError(null);
                          }}
                        >
                          Create Another Contract
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Deployment will be reflected once the pipeline reaches the deploy step.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </CardContent>
        </Card>
      )}

      {status === 'idle' && (
        <div className="text-center text-muted-foreground">
          <p>Describe your smart contract above to get started.</p>
        </div>
      )}
    </div>
  );
}
