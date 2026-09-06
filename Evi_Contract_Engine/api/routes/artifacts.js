const express = require('express');
const fs = require('fs');
const path = require('path');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const { getJob } = require('../lib/jobStore');

module.exports = function () {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: Artifacts
   *     description: Retrieve generated sources, ABIs, and deploy scripts for a specific AI job
   */

  // GET /api/artifacts
  // Headers: x-job-id: <jobId> (optional)
  // Query: jobId=<jobId> (optional), include=<sources|abis|scripts|all> (default all)
  // Returns: { ok, jobId, scope, sources:[], abis:[], scripts:[], meta }
  /**
   * @swagger
   * /api/artifacts:
   *   get:
   *     tags: [Artifacts]
   *     summary: List artifacts (sources, ABIs, scripts) for a job or the project fallback
   *     description: Pass a Job ID via header `x-job-id` or `?jobId=`. Use `include` to control which categories are returned.
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *         description: Job ID whose sandbox artifacts to read (e.g., ai_pipeline_xxx)
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *         description: Same as x-job-id, but as a query param
   *       - in: query
   *         name: include
   *         schema: { type: string, enum: [all, sources, abis, scripts], default: all }
   *         description: Which categories to include in the response
   *     responses:
   *       200:
   *         description: Artifacts payload
   *       500:
   *         description: Internal error
   */
  router.get('/', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      const include = String(req.query.include || 'all').toLowerCase();

      const projectRoot = path.join(__dirname, '..', '..');

      // Search locations (prefer job-specific)
      const locations = [];
      if (jobId) {
        const jobBase = path.join(projectRoot, 'tmp', 'jobs', jobId);
        locations.push({
          scope: `job:${jobId}`,
          contractsDir: path.join(jobBase, 'contracts'),
          artifactsDir: path.join(jobBase, 'artifacts', 'contracts'),
          scriptsDir: path.join(jobBase, 'scripts'),
          baseDir: jobBase,
        });
      }
      // Fallback to project defaults
      locations.push({
        scope: 'project',
        contractsDir: path.join(projectRoot, 'contracts'),
        artifactsDir: path.join(projectRoot, 'artifacts', 'contracts'),
        scriptsDir: path.join(projectRoot, 'scripts'),
        baseDir: projectRoot,
      });

      // Helper: safe read file if exists
      const readIfExists = (p) => {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return fs.readFileSync(p, 'utf8');
          }
        } catch (_) {}
        return null;
      };

      // Helper: glob-ish walk
      const listFiles = (dir, exts) => {
        const out = [];
        try {
          if (!fs.existsSync(dir)) return out;
          const walk = (d) => {
            for (const name of fs.readdirSync(d)) {
              const abs = path.join(d, name);
              const st = fs.statSync(abs);
              if (st.isDirectory()) walk(abs);
              else if (!exts || exts.some((e) => name.toLowerCase().endsWith(e))) out.push(abs);
            }
          };
          walk(dir);
        } catch (_) {}
        return out;
      };

      let chosen = null;
      let sources = [], abis = [], scripts = [];

      for (const loc of locations) {
        const srcFiles = listFiles(loc.contractsDir, ['.sol']);
        const abiFiles = listFiles(loc.artifactsDir, ['.json']);
        const scriptFiles = listFiles(loc.scriptsDir, ['.js']);

        // If job scope requested but empty, continue to next
        if (!chosen && (srcFiles.length || abiFiles.length || scriptFiles.length)) {
          chosen = loc;
        }
        if (!chosen) continue;

        // Collect based on include
        if (include === 'all' || include === 'sources') {
          for (const f of srcFiles) {
            const content = readIfExists(f);
            if (content !== null) {
              sources.push({ path: path.relative(chosen.baseDir, f), content });
            }
          }
        }
        if (include === 'all' || include === 'abis') {
          for (const f of abiFiles) {
            try {
              const json = JSON.parse(fs.readFileSync(f, 'utf8'));
              const name = path.basename(f).replace(/\.json$/, '');
              // Prefer files that look like actual artifacts with abi field
              if (json && (json.abi || json.bytecode)) {
                abis.push({ path: path.relative(chosen.baseDir, f), name, abi: json.abi || null, bytecode: json.bytecode || null });
              }
            } catch (_) { }
          }
        }
        if (include === 'all' || include === 'scripts') {
          for (const f of scriptFiles) {
            const content = readIfExists(f);
            if (content !== null) {
              scripts.push({ path: path.relative(chosen.baseDir, f), content });
            }
          }
        }

        // Use the first location that has anything
        break;
      }

      // If still nothing, try specific project defaults for BusinessToken
      if (!chosen) {
        const loc = locations[locations.length - 1]; // project
        chosen = loc;
        const btSol = path.join(loc.baseDir, 'contracts', 'BusinessToken.sol');
        const btAbi = path.join(loc.baseDir, 'artifacts', 'contracts', 'BusinessToken.sol', 'BusinessToken.json');
        const dep = path.join(loc.baseDir, 'scripts', 'deploy-erc20.js');
        const s = readIfExists(btSol); if (s) sources.push({ path: path.relative(loc.baseDir, btSol), content: s });
        try {
          if (fs.existsSync(btAbi)) {
            const json = JSON.parse(fs.readFileSync(btAbi, 'utf8'));
            abis.push({ path: path.relative(loc.baseDir, btAbi), name: 'BusinessToken', abi: json.abi || null, bytecode: json.bytecode || null });
          }
        } catch (_) {}
        const sc = readIfExists(dep); if (sc) scripts.push({ path: path.relative(loc.baseDir, dep), content: sc });
      }

      return res.json({ ok: true, jobId: jobId || null, scope: chosen ? chosen.scope : null, sources, abis, scripts, meta: { baseDir: chosen ? chosen.baseDir : null } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Focused endpoints
  // Common helpers (duplicated minimally from above for clarity and isolation)
  const buildLocations = (projectRoot, jobId) => {
    const locations = [];
    if (jobId) {
      const jobBase = path.join(projectRoot, 'tmp', 'jobs', jobId);
      locations.push({
        scope: `job:${jobId}`,
        contractsDir: path.join(jobBase, 'contracts'),
        artifactsDir: path.join(jobBase, 'artifacts', 'contracts'),
        scriptsDir: path.join(jobBase, 'scripts'),
        baseDir: jobBase,
      });
    }
    locations.push({
      scope: 'project',
      contractsDir: path.join(projectRoot, 'contracts'),
      artifactsDir: path.join(projectRoot, 'artifacts', 'contracts'),
      scriptsDir: path.join(projectRoot, 'scripts'),
      baseDir: projectRoot,
    });
    return locations;
  };

  const readIfExists = (p) => {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch (_) {}
    return null;
  };

  const listFiles = (dir, exts) => {
    const out = [];
    try {
      if (!fs.existsSync(dir)) return out;
      const walk = (d) => {
        for (const name of fs.readdirSync(d)) {
          const abs = path.join(d, name);
          const st = fs.statSync(abs);
          if (st.isDirectory()) walk(abs);
          else if (!exts || exts.some((e) => name.toLowerCase().endsWith(e))) out.push(abs);
        }
      };
      walk(dir);
    } catch (_) {}
    return out;
  };

  // GET /api/artifacts/sources
  // Returns: { ok, jobId, scope, sources:[], meta }
  /**
   * @swagger
   * /api/artifacts/sources:
   *   get:
   *     tags: [Artifacts]
   *     summary: Retrieve Solidity sources for a job or project fallback
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *     responses:
   *       200:
   *         description: Sources payload
   *       500:
   *         description: Internal error
   */
  router.get('/sources', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      const projectRoot = path.join(__dirname, '..', '..');
      const locations = buildLocations(projectRoot, jobId);

      let chosen = null;
      let sources = [];
      for (const loc of locations) {
        const srcFiles = listFiles(loc.contractsDir, ['.sol']);
        if (!chosen && srcFiles.length) chosen = loc;
        if (!chosen) continue;
        for (const f of srcFiles) {
          const content = readIfExists(f);
          if (content !== null) sources.push({ path: path.relative(chosen.baseDir, f), content });
        }
        break;
      }

      if (!chosen) {
        const loc = locations[locations.length - 1];
        chosen = loc;
        const btSol = path.join(loc.baseDir, 'contracts', 'BusinessToken.sol');
        const s = readIfExists(btSol); if (s) sources.push({ path: path.relative(loc.baseDir, btSol), content: s });
      }

      return res.json({ ok: true, jobId: jobId || null, scope: chosen ? chosen.scope : null, sources, meta: { baseDir: chosen ? chosen.baseDir : null } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/artifacts/abis
  // Returns: { ok, jobId, scope, abis:[], meta }
  /**
   * @swagger
   * /api/artifacts/abis:
   *   get:
   *     tags: [Artifacts]
   *     summary: Retrieve compiled ABI JSONs for a job or project fallback
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *     responses:
   *       200:
   *         description: ABIs payload
   *       500:
   *         description: Internal error
   */
  router.get('/abis', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      const projectRoot = path.join(__dirname, '..', '..');
      const locations = buildLocations(projectRoot, jobId);

      let chosen = null;
      let abis = [];
      for (const loc of locations) {
        const abiFiles = listFiles(loc.artifactsDir, ['.json']);
        if (!chosen && abiFiles.length) chosen = loc;
        if (!chosen) continue;
        for (const f of abiFiles) {
          try {
            const json = JSON.parse(fs.readFileSync(f, 'utf8'));
            const name = path.basename(f).replace(/\.json$/, '');
            if (json && (json.abi || json.bytecode)) {
              abis.push({ path: path.relative(chosen.baseDir, f), name, abi: json.abi || null, bytecode: json.bytecode || null });
            }
          } catch (_) {}
        }
        break;
      }

      if (!chosen) {
        const loc = locations[locations.length - 1];
        chosen = loc;
        const btAbi = path.join(loc.baseDir, 'artifacts', 'contracts', 'BusinessToken.sol', 'BusinessToken.json');
        try {
          if (fs.existsSync(btAbi)) {
            const json = JSON.parse(fs.readFileSync(btAbi, 'utf8'));
            abis.push({ path: path.relative(loc.baseDir, btAbi), name: 'BusinessToken', abi: json.abi || null, bytecode: json.bytecode || null });
          }
        } catch (_) {}
      }

      return res.json({ ok: true, jobId: jobId || null, scope: chosen ? chosen.scope : null, abis, meta: { baseDir: chosen ? chosen.baseDir : null } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/artifacts/scripts
  // Returns: { ok, jobId, scope, scripts:[], meta }
  /**
   * @swagger
   * /api/artifacts/scripts:
   *   get:
   *     tags: [Artifacts]
   *     summary: Retrieve deploy scripts for a job or project fallback
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *     responses:
   *       200:
   *         description: Scripts payload
   *       500:
   *         description: Internal error
   */
  router.get('/scripts', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      const projectRoot = path.join(__dirname, '..', '..');
      const locations = buildLocations(projectRoot, jobId);

      let chosen = null;
      let scripts = [];
      for (const loc of locations) {
        const scriptFiles = listFiles(loc.scriptsDir, ['.js']);
        if (!chosen && scriptFiles.length) chosen = loc;
        if (!chosen) continue;
        for (const f of scriptFiles) {
          const content = readIfExists(f);
          if (content !== null) scripts.push({ path: path.relative(chosen.baseDir, f), content });
        }
        break;
      }

      if (!chosen) {
        const loc = locations[locations.length - 1];
        chosen = loc;
        const dep = path.join(loc.baseDir, 'scripts', 'deploy-erc20.js');
        const sc = readIfExists(dep); if (sc) scripts.push({ path: path.relative(loc.baseDir, dep), content: sc });
      }
      return res.json({ ok: true, jobId: jobId || null, scope: chosen ? chosen.scope : null, scripts, meta: { baseDir: chosen ? chosen.baseDir : null } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/artifacts/audit
  // Returns the persisted audit report for a given jobId if present
  /**
   * @swagger
   * /api/artifacts/audit:
   *   get:
   *     tags: [Artifacts]
   *     summary: Retrieve saved audit report for a job
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *     responses:
   *       200:
   *         description: Audit report JSON
   *       404:
   *         description: Report not found for jobId
   */
  router.get('/audit', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      if (!jobId) return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
      const projectRoot = path.join(__dirname, '..', '..');
      const filePrimary = path.join(projectRoot, 'tmp', 'jobs', jobId, 'audit', 'report.json');
      let fileToRead = filePrimary;
      if (!fs.existsSync(filePrimary)) {
        // Fallback for legacy orchestrate runs that saved under analysis/report.json
        const legacy = path.join(projectRoot, 'tmp', 'jobs', jobId, 'analysis', 'report.json');
        if (fs.existsSync(legacy)) fileToRead = legacy;
      }
      if (!fs.existsSync(fileToRead)) {
        // Final fallback: return from in-memory job result if available
        const job = getJob(jobId);
        const jr = job && job.result && (job.result.audit || job.result.analysis || job.result);
        if (!jr) return res.status(404).json({ ok: false, error: 'AUDIT_REPORT_NOT_FOUND', jobId });
        return res.json({ ok: true, jobId, report: jr });
      }
      const json = JSON.parse(fs.readFileSync(fileToRead, 'utf8'));
      return res.json({ ok: true, jobId, report: json });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/artifacts/compliance
  // Returns the persisted compliance report for a given jobId if present
  /**
   * @swagger
   * /api/artifacts/compliance:
   *   get:
   *     tags: [Artifacts]
   *     summary: Retrieve saved compliance report for a job
   *     parameters:
   *       - in: header
   *         name: x-job-id
   *         schema: { type: string }
   *         required: false
   *       - in: query
   *         name: jobId
   *         schema: { type: string }
   *         required: false
   *     responses:
   *       200:
   *         description: Compliance report JSON
   *       404:
   *         description: Report not found for jobId
   */
  router.get('/compliance', async (req, res) => {
    try {
      const jobId = (req.header('x-job-id') || req.query.jobId || '').trim();
      if (!jobId) return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
      const projectRoot = path.join(__dirname, '..', '..');
      const filePrimary = path.join(projectRoot, 'tmp', 'jobs', jobId, 'compliance', 'report.json');
      let fileToRead = filePrimary;
      if (!fs.existsSync(filePrimary)) {
        // Fallback for legacy orchestrate runs that saved under analysis/report.json
        const legacy = path.join(projectRoot, 'tmp', 'jobs', jobId, 'analysis', 'report.json');
        if (fs.existsSync(legacy)) fileToRead = legacy;
      }
      if (!fs.existsSync(fileToRead)) {
        const job = getJob(jobId);
        const jr = job && job.result && (job.result.compliance || job.result.analysis || job.result);
        if (!jr) return res.status(404).json({ ok: false, error: 'COMPLIANCE_REPORT_NOT_FOUND', jobId });
        return res.json({ ok: true, jobId, report: jr });
      }
      const json = JSON.parse(fs.readFileSync(fileToRead, 'utf8'));
      return res.json({ ok: true, jobId, report: json });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
