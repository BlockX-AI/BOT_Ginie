const express = require('express');
const fs = require('fs');
const path = require('path');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const { createJob, updateJob, appendJobLog } = require('../lib/jobStore');

// Minimal Gemini client (mirrors api/routes/ai.js)
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.COMPLIANCE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro';

async function callGemini({ model = DEFAULT_MODEL, contents, retries = 3, baseDelayMs = 1000 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      return { raw: data, text };
    }
    const bodyText = await res.text().catch(() => '');
    const retryable = res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 503;
    if (!retryable || attempt > retries) {
      throw new Error(`Gemini API error ${res.status}: ${bodyText}`);
    }
    const delay = Math.min(15000, baseDelayMs * Math.pow(2, attempt - 1));
    await new Promise(r => setTimeout(r, delay));
  }
}

function parseJsonStrict(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      const cleaned = String(text || '').replace(/```[\s\S]*?```/g, s => s.replace(/```/g, '')).trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const slice = cleaned.slice(start, end + 1);
        return JSON.parse(slice);
      }
    } catch (_) {}
    throw new Error('LLM_COMPLIANCE_FAILED_INVALID_JSON');
  }
}

function loadPrompt(name) {
  const p = path.join(__dirname, '..', 'prompts', name);
  return fs.readFileSync(p, 'utf8');
}

function resolveJobCode(jobId) {
  const projectRoot = path.join(__dirname, '..', '..');
  const contractsDir = path.join(projectRoot, 'tmp', 'jobs', jobId, 'contracts');
  try {
    if (fs.existsSync(contractsDir)) {
      const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
      if (files.length) {
        const preferred = files.find(f => f.startsWith(`AI_${jobId}_`)) || files[0];
        const full = path.join(contractsDir, preferred);
        return { filename: preferred, code: fs.readFileSync(full, 'utf8') };
      }
    }
  } catch (_) {}
  return null;
}

// Fallback: resolve main source via artifacts endpoint when no contracts/ directory exists
async function resolveJobCodeFromArtifacts(jobId) {
  try {
    const port = process.env.PORT || 3000;
    const url = `http://127.0.0.1:${port}/api/artifacts?jobId=${encodeURIComponent(jobId)}&include=sources`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => ({}));
    const srcs = Array.isArray(data?.sources) ? data.sources : [];
    if (!srcs.length) return null;
    const pick = pickPreferredSource(srcs, jobId);
    if (!pick) return null;
    return { filename: path.basename(pick.path), code: String(pick.content || '') };
  } catch (_) { return null; }
}

function pickPreferredSource(sources, jobId) {
  // sources: [{ path, content }]
  // 1) Prefer AI_<jobId>_*.sol
  let m = sources.find(s => path.basename(s.path || '').startsWith(`AI_${jobId}_`) && s.path.endsWith('.sol'));
  if (m) return m;
  // 2) Prefer a file named *Main*.sol or *Token*.sol
  m = sources.find(s => /main|token/i.test(path.basename(s.path || '')) && s.path.endsWith('.sol'));
  if (m) return m;
  // 3) Prefer non-interface/mock/lib files
  m = sources.find(s => s.path.endsWith('.sol') && !/interface|mock|lib/i.test(s.path));
  if (m) return m;
  // 4) Fallback to first .sol
  return sources.find(s => s.path.endsWith('.sol')) || sources[0] || null;
}

async function resolveJobCodeSmart(jobId) {
  const direct = resolveJobCode(jobId);
  if (direct) return direct;
  return await resolveJobCodeFromArtifacts(jobId);
}

function maybeLoadPolicyPack(name) {
  try {
    const root = path.join(__dirname, '..');
    const dir = process.env.POLICY_PACKS_DIR ? path.resolve(process.env.POLICY_PACKS_DIR) : path.join(root, 'policies');
    const file = path.join(dir, `${name}.json`);
    if (fs.existsSync(file)) {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      return json;
    }
  } catch (_) {}
  return null;
}

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: Compliance
   *     description: LLM-based compliance checking endpoints
   */

  // POST /api/compliance/analyze
  /**
   * @swagger
   * /api/compliance/analyze:
   *   post:
   *     tags: [Compliance]
   *     summary: Analyze Solidity code against a compliance profile or custom policy checks
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code: { type: string }
   *               filename: { type: string }
   *               model: { type: string }
   *               profile: { type: string, enum: [generic, registry, token, custom] }
   *               strict: { type: boolean }
   *               policyPack: { type: string }
   *               policyChecks: { type: array, items: { type: object } }
   *     responses:
   *       200:
   *         description: Compliance report
   *       400:
   *         description: Missing code
   */
  router.post('/analyze', async (req, res) => {
    try {
      const { code = '', filename = 'Code.sol', model, profile = 'generic', strict = false, policyPack = '', policyChecks = [] } = req.body || {};
      if (!String(code).trim()) return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });

      const prompt = loadPrompt('compliance_prompt.md');
      const pack = policyPack ? maybeLoadPolicyPack(policyPack) : null;

      const contextParts = [];
      contextParts.push(`profile: ${profile}`);
      contextParts.push(`strictMode: ${!!strict}`);
      contextParts.push(`filename: ${filename}`);
      if (Array.isArray(policyChecks) && policyChecks.length) {
        contextParts.push('policyChecks:');
        contextParts.push(JSON.stringify(policyChecks));
      }
      if (pack && Array.isArray(pack.checks)) {
        contextParts.push('policyPackChecks:');
        contextParts.push(JSON.stringify(pack.checks));
      }
      contextParts.push('code:');
      contextParts.push(String(code || ''));

      const { text } = await callGemini({
        model,
        retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
        baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
        contents: [ { role: 'user', parts: [{ text: prompt + '\n\n' + contextParts.join('\n') }] } ]
      });
      const compliance = parseJsonStrict(text);
      return res.json({ ok: true, compliance, profile, strict, policyPack: pack ? policyPack : undefined });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/compliance/byJob
  /**
   * @swagger
   * /api/compliance/byJob:
   *   post:
   *     tags: [Compliance]
   *     summary: Run compliance analysis for code associated with a jobId
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               jobId: { type: string }
   *               model: { type: string }
   *               profile: { type: string, enum: [generic, registry, token, custom] }
   *               strict: { type: boolean }
   *               policyPack: { type: string }
   *               policyChecks: { type: array, items: { type: object } }
   *     responses:
   *       200: { description: Compliance report for job }
   *       404: { description: Source not found for job }
   */
  router.post('/byJob', async (req, res) => {
    try {
      const { jobId = '', model, profile = 'generic', strict = false, policyPack = '', policyChecks = [] } = req.body || {};
      if (!jobId) return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
      const resolved = await resolveJobCodeSmart(jobId);
      if (!resolved) return res.status(404).json({ ok: false, error: 'JOB_SOURCE_NOT_FOUND' });

      const prompt = loadPrompt('compliance_prompt.md');
      const pack = policyPack ? maybeLoadPolicyPack(policyPack) : null;

      const contextParts = [];
      contextParts.push(`profile: ${profile}`);
      contextParts.push(`strictMode: ${!!strict}`);
      contextParts.push(`filename: ${resolved.filename}`);
      if (Array.isArray(policyChecks) && policyChecks.length) {
        contextParts.push('policyChecks:');
        contextParts.push(JSON.stringify(policyChecks));
      }
      if (pack && Array.isArray(pack.checks)) {
        contextParts.push('policyPackChecks:');
        contextParts.push(JSON.stringify(pack.checks));
      }
      contextParts.push('code:');
      contextParts.push(String(resolved.code || ''));

      const { text } = await callGemini({
        model,
        retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
        baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
        contents: [ { role: 'user', parts: [{ text: prompt + '\n\n' + contextParts.join('\n') }] } ]
      });
      const compliance = parseJsonStrict(text);

      // Persist under the job folder
      try {
        const projectRoot = path.join(__dirname, '..', '..');
        const dir = path.join(projectRoot, 'tmp', 'jobs', jobId, 'compliance');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(compliance, null, 2), 'utf8');
      } catch (_) {}

      return res.json({ ok: true, compliance, sourceRef: { jobId, filename: resolved.filename } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/compliance/orchestrate
  /**
   * @swagger
   * /api/compliance/orchestrate:
   *   post:
   *     tags: [Compliance]
   *     summary: Orchestrate Compliance Analyze -> optional Fix -> optional Deploy
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code: { type: string }
   *               jobId: { type: string }
   *               targetProfile: { type: string }
   *               strict: { type: boolean }
   *               fix: { type: boolean }
   *               deploy: { type: boolean }
   *               network: { type: string }
   *               model: { type: string }
   *               fixModel: { type: string }
   *               constructorArgs: { type: array, items: { type: string } }
   *     responses:
   *       202: { description: Job accepted; stream logs via /api/job/:id/logs/stream }
   */
  router.post('/orchestrate', async (req, res) => {
    try {
      const {
        code: inputCode = '',
        jobId: sourceJobId = '',
        targetProfile = 'generic',
        strict = false,
        fix = false,
        deploy = false,
        network = 'basecamp',
        model,
        fixModel,
        constructorArgs = []
      } = req.body || {};

      if (!inputCode && !sourceJobId) return res.status(400).json({ ok: false, error: 'CODE_OR_JOB_ID_REQUIRED' });

      const job = await createJob('compliance_orchestrate', { fix, deploy, network });
      updateJob(job.id, { state: 'running', progress: 5, step: 'analyze' });
      appendJobLog(job.id, 'info', `Compliance orchestrate started. fix=${fix} deploy=${deploy} network=${network}`);
      res.status(202).json({ ok: true, job: { id: job.id, type: 'compliance_orchestrate' } });

      setImmediate(async () => {
        try {
          // Resolve code
          let source = { filename: 'Orchestrate.sol', code: '' };
          if (inputCode && String(inputCode).trim()) {
            source.code = String(inputCode);
          } else {
            const r = await resolveJobCodeSmart(sourceJobId);
            if (!r) throw new Error('JOB_SOURCE_NOT_FOUND');
            source = r;
          }

          const prompt = loadPrompt('compliance_prompt.md');
          const contextParts = [];
          contextParts.push(`profile: ${targetProfile}`);
          contextParts.push(`strictMode: ${!!strict}`);
          contextParts.push(`filename: ${source.filename}`);
          contextParts.push('code:');
          contextParts.push(String(source.code || ''));

          const { text } = await callGemini({
            model,
            retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
            baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
            contents: [ { role: 'user', parts: [{ text: prompt + '\n\n' + contextParts.join('\n') }] } ]
          });
          const compliance = parseJsonStrict(text);

          // Persist analysis
          const projectRoot = path.join(__dirname, '..', '..');
          const dir = path.join(projectRoot, 'tmp', 'jobs', job.id, 'compliance');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(compliance, null, 2), 'utf8');
          appendJobLog(job.id, 'info', `Compliance analysis complete. score=${compliance?.score}`);
          // Mirror under source job if provided for single-parameter retrieval
          try {
            if (sourceJobId) {
              const mirrorDir = path.join(projectRoot, 'tmp', 'jobs', sourceJobId, 'compliance');
              fs.mkdirSync(mirrorDir, { recursive: true });
              fs.writeFileSync(path.join(mirrorDir, 'report.json'), JSON.stringify(compliance, null, 2), 'utf8');
              appendJobLog(job.id, 'info', `Mirrored compliance report under source job: ${sourceJobId}`);
            }
          } catch (_) {}

          let fixJob = null;
          if (fix) {
            updateJob(job.id, { progress: 70, step: 'fix' });
            appendJobLog(job.id, 'info', 'Triggering AI fix job...');
            try {
              const port = process.env.PORT || 3000;
              const resp = await fetch(`http://127.0.0.1:${port}/api/ai/fix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: source.code, model: fixModel, network, filename: source.filename, constructorArgs })
              });
              const data = await resp.json().catch(() => ({}));
              if (resp.status === 202 && data?.job?.id) {
                fixJob = { id: data.job.id };
                appendJobLog(job.id, 'info', `Fix job accepted. jobId=${fixJob.id}`);
              } else {
                appendJobLog(job.id, 'warn', `Fix request failed: ${data?.error || resp.status}`);
              }
            } catch (e) {
              appendJobLog(job.id, 'error', `Fix request error: ${e.message}`);
            }
          }

          updateJob(job.id, { state: 'completed', progress: 100, step: 'done', result: { compliance, fixJob } });
        } catch (e) {
          appendJobLog(job.id, 'error', `Orchestrate failed: ${e.message}`);
          updateJob(job.id, { state: 'failed', progress: 100, error: e.message });
        }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
