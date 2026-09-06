const express = require('express');
const fs = require('fs');
const path = require('path');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const { createJob, updateJob, appendJobLog } = require('../lib/jobStore');

// Minimal Gemini client (mirrors api/routes/ai.js)
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.AUDIT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro';

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
    // Try to strip fences and extract first {...}
    try {
      const cleaned = String(text || '').replace(/```[\s\S]*?```/g, s => s.replace(/```/g, '')).trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const slice = cleaned.slice(start, end + 1);
        return JSON.parse(slice);
      }
    } catch (_) {}
    throw new Error('LLM_ANALYSIS_FAILED_INVALID_JSON');
  }
}

function loadPrompt(name) {
  const p = path.join(__dirname, '..', 'prompts', name);
  return fs.readFileSync(p, 'utf8');
}

function maybeLoadCookbook() {
  try {
    return loadPrompt('audit_cookbook.md');
  } catch (_) {
    return '';
  }
}

function validateAuditReport(report) {
  const errors = [];
  try {
    if (!report || typeof report !== 'object') {
      errors.push('REPORT_INVALID_OBJECT');
      return { ok: false, errors };
    }
    // Special-case: compilation failure shortcut (Step 0). Accept minimal report.
    const ff = Array.isArray(report.findings) ? report.findings : [];
    const isCompileFail = typeof report.score === 'number' && report.score === 0 && ff.some(f => String(f?.severity).toLowerCase() === 'error' && /compilation failure/i.test(String(f?.title || '')));
    if (isCompileFail) {
      return { ok: true, errors: [] };
    }
    if (!report.summary || typeof report.summary !== 'string' || report.summary.trim().length < 10) {
      errors.push('SUMMARY_MISSING_OR_TOO_SHORT');
    }
    // Findings array and minimum coverage
    const findings = ff;
    if (!findings.length) errors.push('FINDINGS_EMPTY');
    if (findings.length < 17) errors.push('FINDINGS_LESS_THAN_MINIMUM_17');
    // At least 5 info OK/N-A markers
    const infoOkCount = findings.filter(f => String(f?.severity).toLowerCase() === 'info' && /\b(OK|N\/?A)\b/i.test(String(f?.title || ''))).length;
    if (infoOkCount < 5) errors.push('INSUFFICIENT_INFO_OK_OR_NA_FINDINGS');
    // Each error must have exploitScenario and attackSteps
    const missingExploit = findings.filter(f => String(f?.severity).toLowerCase() === 'error' && (!f?.exploitScenario || !Array.isArray(f?.attackSteps) || f.attackSteps.length === 0 || !f?.remediationCode));
    if (missingExploit.length) errors.push('ERROR_FINDINGS_MISSING_EXPLOIT_DETAILS');
    // coverage object required and filled
    const cov = report.coverage || {};
    const covKeys = ['critical','high','medium','low','totalAddressed','totalAvailable'];
    const covMissing = covKeys.filter(k => typeof cov[k] !== 'number');
    if (covMissing.length) errors.push('COVERAGE_OBJECT_INCOMPLETE');
    // scoreBreakdown and score consistency
    const sb = report.scoreBreakdown || {};
    const sbKeys = ['security','functionality','codeQuality','gas'];
    const sbMissing = sbKeys.filter(k => typeof sb[k] !== 'number');
    if (sbMissing.length) errors.push('SCORE_BREAKDOWN_INCOMPLETE');
    const sum = sbKeys.reduce((acc,k) => acc + (typeof sb[k] === 'number' ? sb[k] : 0), 0);
    if (typeof report.score !== 'number' || Math.round(sum) !== Math.round(report.score)) {
      errors.push('SCORE_MISMATCH_WITH_BREAKDOWN');
    }
    // bucket ranges and final score bounds
    if (typeof sb.security === 'number' && (sb.security < 0 || sb.security > 40)) errors.push('SECURITY_BUCKET_OUT_OF_RANGE');
    if (typeof sb.functionality === 'number' && (sb.functionality < 0 || sb.functionality > 25)) errors.push('FUNCTIONALITY_BUCKET_OUT_OF_RANGE');
    if (typeof sb.codeQuality === 'number' && (sb.codeQuality < 0 || sb.codeQuality > 20)) errors.push('CODEQUALITY_BUCKET_OUT_OF_RANGE');
    if (typeof sb.gas === 'number' && (sb.gas < 0 || sb.gas > 15)) errors.push('GAS_BUCKET_OUT_OF_RANGE');
    if (typeof report.score === 'number' && (report.score < 0 || report.score > 100)) errors.push('FINAL_SCORE_OUT_OF_RANGE');
    // basic field sanity for each finding
    const missingLoc = findings.filter(f => typeof f?.line !== 'number' || typeof f?.file !== 'string');
    if (missingLoc.length) errors.push('FINDINGS_MISSING_FILE_OR_LINE');
  } catch (e) {
    errors.push('VALIDATION_EXCEPTION_' + e.message);
  }
  return { ok: errors.length === 0, errors };
}

function resolveJobCode(jobId) {
  const projectRoot = path.join(__dirname, '..', '..');
  const contractsDir = path.join(projectRoot, 'tmp', 'jobs', jobId, 'contracts');
  try {
    if (fs.existsSync(contractsDir)) {
      const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
      if (files.length) {
        // Prefer AI_<jobId>_* pattern
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

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: Audit
   *     description: LLM-based security audit endpoints
   */

  // POST /api/audit/analyze
  /**
   * @swagger
   * /api/audit/analyze:
   *   post:
   *     tags: [Audit]
   *     summary: Analyze Solidity code and return a structured audit report (JSON-only)
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
   *               policy: { type: object }
   *     responses:
   *       200:
   *         description: Audit report
   *       400:
   *         description: Missing code
   */
  router.post('/analyze', async (req, res) => {
    try {
      const { code = '', filename = 'Code.sol', model, policy = {} } = req.body || {};
      if (!String(code).trim()) return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });

      const auditPrompt = loadPrompt('audit_prompt.md');
      const userBlock = [
        'filename: ' + filename,
        'code:',
        String(code || '')
      ].join('\n');

      const cookbook = maybeLoadCookbook();
      const promptText = auditPrompt + (cookbook ? '\n\nCookbook:\n' + cookbook : '') + '\n\n' + userBlock;

      const { text } = await callGemini({
        model,
        retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
        baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
        contents: [
          { role: 'user', parts: [{ text: promptText }] }
        ]
      });
      let report;
      try {
        report = parseJsonStrict(text);
      } catch (e) {
        const jsonOnly = [
          'JSON OUTPUT ENFORCER:',
          '- Output ONLY a single valid JSON object per the schema.',
          '- No code fences, no commentary, no pre/post text.',
          '- If compilation fails, output the Step 0 compilation-failure JSON with score=0.',
          'Now re-issue your response as pure JSON only.'
        ].join('\n');
        const { text: textRetry } = await callGemini({
          model,
          retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
          baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
          contents: [ { role: 'user', parts: [{ text: promptText + '\n\n' + jsonOnly }] } ]
        });
        report = parseJsonStrict(textRetry);
      }
      // Coverage gating and second pass if needed
      let validation = validateAuditReport(report);
      if (!validation.ok) {
        const enforcer = [
          'COVERAGE ENFORCER:',
          '- Your previous report failed gating for: ' + validation.errors.join(', '),
          '- Produce a corrected report meeting ALL requirements:',
          '  * Minimum 17 findings (one per cookbook item);',
          '  * At least 5 info findings with "- OK" or "- N/A";',
          '  * Include coverage object with all keys;',
          '  * Every error must include exploitScenario and attackSteps;',
          '  * scoreBreakdown must sum to score;',
          '  * Output JSON only.',
          'PreviousReport:',
          JSON.stringify(report)
        ].join('\n');
        const { text: text2 } = await callGemini({
          model,
          retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
          baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
          contents: [ { role: 'user', parts: [{ text: promptText + '\n\n' + enforcer }] } ]
        });
        report = parseJsonStrict(text2);
        validation = validateAuditReport(report);
      }
      return res.json({ ok: true, report, policy, enforcement: { passed: validation.ok, reasons: validation.errors } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/audit/byJob
  /**
   * @swagger
   * /api/audit/byJob:
   *   post:
   *     tags: [Audit]
   *     summary: Run audit for code previously generated by a jobId
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               jobId: { type: string }
   *               model: { type: string }
   *               policy: { type: object }
   *     responses:
   *       200: { description: Audit report for job }
   *       404: { description: Source not found for job }
   */
  router.post('/byJob', async (req, res) => {
    try {
      const { jobId = '', model, policy = {} } = req.body || {};
      if (!jobId) return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
      const resolved = await resolveJobCodeSmart(jobId);
      if (!resolved) return res.status(404).json({ ok: false, error: 'JOB_SOURCE_NOT_FOUND' });

      const auditPrompt = loadPrompt('audit_prompt.md');
      const userBlock = [
        'filename: ' + resolved.filename,
        'code:',
        String(resolved.code || '')
      ].join('\n');

      const cookbook = maybeLoadCookbook();
      const promptText = auditPrompt + (cookbook ? '\n\nCookbook:\n' + cookbook : '') + '\n\n' + userBlock;

      const { text } = await callGemini({
        model,
        retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
        baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
        contents: [
          { role: 'user', parts: [{ text: promptText }] }
        ]
      });
      let report = parseJsonStrict(text);
      // Coverage gating and second pass if needed
      let validation = validateAuditReport(report);
      if (!validation.ok) {
        const enforcer = [
          'COVERAGE ENFORCER:',
          '- Your previous report failed gating for: ' + validation.errors.join(', '),
          '- Produce a corrected report meeting ALL requirements:',
          '  * Minimum 17 findings (one per cookbook item);',
          '  * At least 5 info findings with "- OK" or "- N/A";',
          '  * Include coverage object with all keys;',
          '  * Every error must include exploitScenario and attackSteps;',
          '  * scoreBreakdown must sum to score;',
          '  * Output JSON only.',
          'PreviousReport:',
          JSON.stringify(report)
        ].join('\n');
        const { text: text2 } = await callGemini({
          model,
          retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
          baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
          contents: [ { role: 'user', parts: [{ text: promptText + '\n\n' + enforcer }] } ]
        });
        report = parseJsonStrict(text2);
        validation = validateAuditReport(report);
      }

      // Persist report under the job folder
      try {
        const projectRoot = path.join(__dirname, '..', '..');
        const dir = path.join(projectRoot, 'tmp', 'jobs', jobId, 'audit');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
      } catch (_) {}

      return res.json({ ok: true, report, sourceRef: { jobId, filename: resolved.filename }, enforcement: { passed: validation.ok, reasons: validation.errors } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/audit/orchestrate
  /**
   * @swagger
   * /api/audit/orchestrate:
   *   post:
   *     tags: [Audit]
   *     summary: Orchestrate Analyze -> optional Fix -> optional Deploy
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code: { type: string }
   *               jobId: { type: string }
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
        fix = false,
        deploy = false, // deploy handled by /api/ai/fix implicitly
        network = 'basecamp',
        model,
        fixModel,
        constructorArgs = []
      } = req.body || {};

      if (!inputCode && !sourceJobId) return res.status(400).json({ ok: false, error: 'CODE_OR_JOB_ID_REQUIRED' });

      const job = await createJob('audit_orchestrate', { fix, deploy, network });
      updateJob(job.id, { state: 'running', progress: 5, step: 'analyze' });
      appendJobLog(job.id, 'info', `Orchestrate job started. fix=${fix} deploy=${deploy} network=${network}`);
      res.status(202).json({ ok: true, job: { id: job.id, type: 'audit_orchestrate' } });

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

          const auditPrompt = loadPrompt('audit_prompt.md');
          const userBlock = [
            'filename: ' + source.filename,
            'code:',
            String(source.code || '')
          ].join('\n');

          const cookbook = maybeLoadCookbook();
          const promptText = auditPrompt + (cookbook ? '\n\nCookbook:\n' + cookbook : '') + '\n\n' + userBlock;

          const { text } = await callGemini({
            model,
            retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
            baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
            contents: [ { role: 'user', parts: [{ text: promptText }] } ]
          });
          let report;
          try {
            report = parseJsonStrict(text);
          } catch (e) {
            appendJobLog(job.id, 'warn', 'Initial LLM response was not valid JSON. Retrying with JSON-only enforcer.');
            const jsonOnly = [
              'JSON OUTPUT ENFORCER:',
              '- Output ONLY a single valid JSON object per the schema.',
              '- No code fences, no commentary, no pre/post text.',
              '- If compilation fails, output the Step 0 compilation-failure JSON with score=0.',
              'Now re-issue your response as pure JSON only.'
            ].join('\n');
            const { text: textRetry } = await callGemini({
              model,
              retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
              baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
              contents: [ { role: 'user', parts: [{ text: promptText + '\n\n' + jsonOnly }] } ]
            });
            report = parseJsonStrict(textRetry);
          }
          // Coverage gating and second pass if needed
          let validation = validateAuditReport(report);
          if (!validation.ok) {
            appendJobLog(job.id, 'warn', `Coverage gating failed: ${validation.errors.join(', ')}`);
            const enforcer = [
              'COVERAGE ENFORCER:',
              '- Your previous report failed gating for: ' + validation.errors.join(', '),
              '- Produce a corrected report meeting ALL requirements:',
              '  * Minimum 17 findings (one per cookbook item);',
              '  * At least 5 info findings with "- OK" or "- N/A";',
              '  * Include coverage object with all keys;',
              '  * Every error must include exploitScenario and attackSteps;',
              '  * scoreBreakdown must sum to score;',
              '  * Output JSON only.',
              'PreviousReport:',
              JSON.stringify(report)
            ].join('\n');
            const { text: text2 } = await callGemini({
              model,
              retries: Number(process.env.LLM_ANALYSIS_MAX_RETRIES || 5) || 5,
              baseDelayMs: Number(process.env.LLM_ANALYSIS_TIMEOUT_MS || 1200) || 1200,
              contents: [ { role: 'user', parts: [{ text: promptText + '\n\n' + enforcer }] } ]
            });
            report = parseJsonStrict(text2);
            validation = validateAuditReport(report);
            if (validation.ok) appendJobLog(job.id, 'info', 'Coverage gating passed after second pass.');
            else appendJobLog(job.id, 'warn', `Coverage still insufficient: ${validation.errors.join(', ')}`);
          }

          // Persist analysis
          const projectRoot = path.join(__dirname, '..', '..');
          const dir = path.join(projectRoot, 'tmp', 'jobs', job.id, 'audit');
          fs.mkdirSync(dir, { recursive: true });
          const outFile = path.join(dir, 'report.json');
          fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
          appendJobLog(job.id, 'info', `Audit analysis complete. score=${report?.score}`);
          try { appendJobLog(job.id, 'info', `Saved audit report: ${path.relative(projectRoot, outFile)}`); } catch (_) {}

          // Mirror under source job if provided for single-parameter retrieval
          try {
            if (sourceJobId) {
              const mirrorDir = path.join(projectRoot, 'tmp', 'jobs', sourceJobId, 'audit');
              fs.mkdirSync(mirrorDir, { recursive: true });
              fs.writeFileSync(path.join(mirrorDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
              appendJobLog(job.id, 'info', `Mirrored audit report under source job: ${sourceJobId}`);
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

          updateJob(job.id, { state: 'completed', progress: 100, step: 'done', result: { audit: report, fixJob } });
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
