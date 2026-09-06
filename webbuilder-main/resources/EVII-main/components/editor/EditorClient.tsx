"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Api } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';

export default function EditorClient() {
  const sp = useSearchParams();
  const jobId = sp.get('job') || '';
  const isFixed = sp.get('fixed') === '1';
  const [filename, setFilename] = useState('AIGenerated.sol');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!jobId) return;
      try {
        if (typeof window !== 'undefined' && isFixed) {
          const fixedCode = sessionStorage.getItem(`fixedCode:${jobId}`);
          const fixedName = sessionStorage.getItem(`fixedFilename:${jobId}`) || 'Contract.sol';
          if (fixedCode) {
            setFilename(fixedName);
            setCode(fixedCode);
          }
        }
        if (!isFixed) {
          const art = await Api.getArtifactsAll(jobId);
          const sources = art?.data?.sources || {};
          const first = Object.entries(sources)[0];
          if (mounted && first) {
            setFilename(first[0].split('/').pop() || 'Contract.sol');
            setCode(first[1]);
          }
        }
        try {
          const logs = await Api.getJobLogs(jobId, 0);
          const lines = (logs?.data?.logs || []).map((l) => `[${l.level}] ${l.msg}`);
          if (mounted && lines.length) {
            const tail = lines.slice(-40).join('\n');
            setErrors(tail);
          }
        } catch {}
      } catch {}
    }
    load();
    return () => { mounted = false; };
  }, [jobId]);

  const disabled = useMemo(() => loading || !code.trim(), [loading, code]);

  async function onFix() {
    setLoading(true);
    try {
      const r = await Api.aiFix(code, errors || '');
      if (r?.ok && r.data?.code) setCode(r.data.code);
    } finally {
      setLoading(false);
    }
  }

  async function onCompile() {
    setLoading(true);
    try {
      const r = await Api.aiCompile(filename || 'Contract.sol', code);
      setErrors(JSON.stringify(r?.data ?? {}, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold">Editor</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onFix} disabled={disabled}>AI Auto-Fix</Button>
          <Button variant="gradient" onClick={onCompile} disabled={disabled}>Compile</Button>
        </div>
      </div>

      <Card className="p-4 bg-secondary/40 border-border space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Filename</div>
            <input className="w-full rounded-md bg-background/60 border border-border px-3 py-2 text-sm" value={filename} onChange={(e) => setFilename(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Errors (optional)</div>
            <input className="w-full rounded-md bg-background/60 border border-border px-3 py-2 text-sm" value={errors} onChange={(e) => setErrors(e.target.value)} placeholder="Paste compile error output" />
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Code</div>
          <Textarea className="min-h-[420px] font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      </Card>
    </main>
  );
}
