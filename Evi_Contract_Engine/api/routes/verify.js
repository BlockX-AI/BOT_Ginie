const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const { getJob, getJobSync, appendJobLog } = require('../lib/jobStore');

// Build a temporary Hardhat config that includes the verify plugin and Blockscout customChains
function buildVerifyConfig(sandboxDir, options = {}) {
  const cfgPath = path.join(sandboxDir, 'hardhat.verify.config.js');
  const projectRootAbs = path.join(__dirname, '..', '..');
  const pathsBlock = (options && options.useRepoPaths) ? `
  // IMPORTANT: point Hardhat to use the repository's sources/artifacts/cache even though this config lives in a tmp dir
  paths: {
    sources: path.join('${projectRootAbs.replace(/\\/g, '\\\\')}', 'contracts'),
    artifacts: path.join('${projectRootAbs.replace(/\\/g, '\\\\')}', 'artifacts'),
    cache: path.join('${projectRootAbs.replace(/\\/g, '\\\\')}', 'cache'),
    tests: path.join('${projectRootAbs.replace(/\\/g, '\\\\')}', 'test'),
  },
` : '';
  const content = `require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();
const path = require('path');

let rootNetworks = {};
try {
  const rootCfg = require(path.join(__dirname, '..', '..', 'hardhat.config.js'));
  if (rootCfg && rootCfg.networks) rootNetworks = rootCfg.networks;
} catch (e) { rootNetworks = {}; }

const normalizeKey = (k) => (k ? (k.startsWith('0x') ? k : '0x' + k) : undefined);
const fallbackNetworks = {
  basecamp: {
    url: process.env.BASECAMP_RPC_URL || 'https://rpc.basecamp.t.raas.gelato.cloud',
    accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
  },
  'basecamp-testnet': {
    url: process.env.BASECAMP_TESTNET_RPC_URL || 'https://sepolia.base.org',
    accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
  },
  'avalanche-fuji': {
    url: process.env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    accounts: process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : [],
  },
  'boba-sepolia': {
    url: process.env.BOBA_SEPOLIA_RPC_URL || 'https://sepolia.boba.network',
    accounts: process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : [],
  },
  'bsc-testnet': {
    url: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
    accounts: process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : [],
  },
  'botchain': {
    url: process.env.BOT_CHAIN_RPC_URL || 'https://rpc.botchain.ai',
    accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [normalizeKey(process.env.BOT_CHAIN_PRIVATE_KEY)] : [],
    chainId: 677,
  },
  'botchain-testnet': {
    url: process.env.BOT_CHAIN_TESTNET_RPC_URL || 'https://rpc.bohr.life',
    accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [normalizeKey(process.env.BOT_CHAIN_PRIVATE_KEY)] : [],
    chainId: 968,
  },
};

module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.19', settings: { optimizer: { enabled: true, runs: 200 } } },
      { version: '0.8.20', settings: { optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  ${pathsBlock}
  networks: { hardhat: {}, ...fallbackNetworks, ...rootNetworks },
  etherscan: {
    apiKey: {
      basecamp: 'empty',
      'basecamp-testnet': 'empty',
      'avalanche-fuji': 'snowtrace', // Routescan doesn't require real API key
      'boba-sepolia': 'empty',
      'bsc-testnet': process.env.BSCSCAN_API_KEY || 'empty',
      'botchain': process.env.BOT_CHAIN_EXPLORER_API_KEY || 'abc',
      'botchain-testnet': process.env.BOT_CHAIN_EXPLORER_API_KEY || 'abc',
    },
    customChains: [
      {
        network: 'basecamp',
        chainId: 123420001114,
        urls: {
          apiURL: 'https://basecamp.cloud.blockscout.com/api',
          browserURL: 'https://basecamp.cloud.blockscout.com'
        }
      },
      {
        network: 'basecamp-testnet',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia-explorer.base.org'
        }
      },
      {
        network: 'avalanche-fuji',
        chainId: 43113,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan',
          browserURL: 'https://testnet.snowtrace.io'
        }
      },
      {
        network: 'boba-sepolia',
        chainId: 28882,
        urls: {
          apiURL: 'https://testnet.bobascan.com/api',
          browserURL: 'https://testnet.bobascan.com'
        }
      },
      {
        network: 'bsc-testnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com'
        }
      },
      {
        network: 'botchain',
        chainId: 677,
        urls: {
          apiURL: process.env.BOT_CHAIN_EXPLORER_API || 'https://scan.botchain.ai/api',
          browserURL: process.env.BOT_CHAIN_EXPLORER_BROWSER || 'https://scan.botchain.ai',
        }
      },
      {
        network: 'botchain-testnet',
        chainId: 968,
        urls: {
          apiURL: process.env.BOT_CHAIN_TESTNET_EXPLORER_API || 'https://scan.bohr.life/api',
          browserURL: process.env.BOT_CHAIN_TESTNET_EXPLORER_BROWSER || 'https://scan.bohr.life',
        }
      }
    ]
  },
};
`;
  fs.writeFileSync(cfgPath, content, 'utf8');
  return cfgPath;
}

function normalizeNetwork(requested) {
  const normalized = (requested || 'basecamp').replace(/_/g, '-').toLowerCase();
  const aliasMap = {
    'camp': 'basecamp',
    'camp-testnet': 'basecamp-testnet',
    'basecamp-mainnet': 'basecamp',
    'fuji': 'avalanche-fuji',
    'avax-fuji': 'avalanche-fuji',
    'boba': 'boba-sepolia',
    // Base Sepolia aliases
    'base-sepolia': 'basecamp-testnet',
    'basesepolia': 'basecamp-testnet',
    'base-sepolia-testnet': 'basecamp-testnet',
  };
  return aliasMap[normalized] || normalized;
}

// Simple JSON GET helper without external deps
async function fetchJSON(url, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'http:' ? http : https;
      const req = mod.get(url, { headers: { 'user-agent': 'AcademicChain/verify-status' } }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(body || '{}');
            resolve({ statusCode: res.statusCode || 0, json });
          } catch (e) {
            reject(new Error(`INVALID_JSON_FROM_EXPLORER`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('TIMEOUT'));
      });
    } catch (e) { reject(e); }
  });
}

// Helper: run an npx command and capture stdout/stderr
function runNpx(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn('npx', args, { cwd, env: { ...process.env }, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { stderr += `\nspawn error: ${err.message}`; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Explorer API URLs for direct verification
const EXPLORER_API_URLS = {
  botchain: 'https://scan.botchain.ai/api',
  'botchain-testnet': 'https://scan.bohr.life/api',
  basecamp: 'https://basecamp.cloud.blockscout.com/api',
  'basecamp-testnet': 'https://api-sepolia.basescan.org/api',
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Generic POST with a JSON body. IMPORTANT: the BOT Chain explorer sits behind
// Cloudflare, whose WAF blocks large `application/x-www-form-urlencoded` bodies
// (returns a 403 HTML page). Sending the SAME payload as `application/json`
// bypasses the WAF, so we always submit verification as JSON.
function httpsJsonPost(apiUrl, payloadObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(apiUrl);
    const mod = u.protocol === 'https:' ? https : http;
    const postData = JSON.stringify(payloadObj);
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json, text/plain, */*',
      },
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c.toString(); });
      resp.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Explorer API returned non-JSON (status ${resp.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('TIMEOUT')); });
    req.write(postData);
    req.end();
  });
}

// Generic GET returning parsed JSON
function httpsJsonGet(apiUrl, query) {
  return new Promise((resolve, reject) => {
    const u = new URL(apiUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json, text/plain, */*' },
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c.toString(); });
      resp.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Explorer API returned non-JSON (status ${resp.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('TIMEOUT')); });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Poll checkverifystatus until Pass/Fail or timeout
async function pollVerifyStatus(apiUrl, guid, apiKey, maxAttempts = 20, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    let json;
    try {
      json = await httpsJsonGet(apiUrl, { apikey: apiKey, module: 'contract', action: 'checkverifystatus', guid });
    } catch (e) {
      // transient error, retry
      continue;
    }
    const msg = String(json && json.result || '');
    if (/pending/i.test(msg)) continue;
    if (/pass|already verified|verified/i.test(msg)) return { success: true, message: msg };
    if (/fail/i.test(msg)) return { success: false, message: msg };
    // Unknown terminal status
    return { success: json && json.status === '1', message: msg };
  }
  return { success: false, message: 'Verification status polling timed out' };
}

/**
 * Direct verification via explorer API using the solc standard-json-input.
 * Submits as application/json to bypass Cloudflare WAF, then polls status.
 * @param {object} opts
 * @param {string} opts.address           deployed contract address
 * @param {object} opts.standardJsonInput solc standard-json input object (from build-info.input)
 * @param {string} opts.fqName            fully-qualified name "path/File.sol:Contract"
 * @param {string} opts.compilerVersion   long version, e.g. "v0.8.20+commit.a1b79de6"
 * @param {string} opts.network           network key
 * @param {boolean} opts.optimizerEnabled
 * @param {number} opts.runs
 * @param {string} opts.constructorArgs   hex-encoded constructor args (no 0x)
 */
async function verifyViaExplorerAPI(opts) {
  const { address, standardJsonInput, fqName, compilerVersion, network, optimizerEnabled, runs, constructorArgs } = opts;
  const apiUrl = EXPLORER_API_URLS[network];
  if (!apiUrl) throw new Error(`No explorer API URL for network: ${network}`);
  const apiKey = process.env.BOT_CHAIN_EXPLORER_API_KEY || 'abc';

  const submitResult = await httpsJsonPost(apiUrl, {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: address,
    sourceCode: JSON.stringify(standardJsonInput),
    codeformat: 'solidity-standard-json-input',
    contractname: fqName,
    compilerversion: compilerVersion,
    optimizationUsed: optimizerEnabled ? '1' : '0',
    runs: String(runs || 200),
    constructorArguements: constructorArgs || '',
  });

  // Already verified short-circuit
  if (submitResult && submitResult.status === '0' && /already verified/i.test(String(submitResult.result || ''))) {
    return { verified: true, alreadyVerified: true, message: submitResult.result };
  }
  if (!submitResult || submitResult.status !== '1' || !submitResult.result) {
    return { verified: false, message: (submitResult && submitResult.result) || 'Submission rejected', raw: submitResult };
  }

  const guid = submitResult.result;
  const status = await pollVerifyStatus(apiUrl, guid, apiKey);
  return { verified: status.success, message: status.message, guid };
}

// Locate the build-info artifact for a job sandbox and return { input, solcLongVersion, fqName }
function loadBuildInfo(sandboxDir, preferredFqName) {
  const biDir = path.join(sandboxDir, 'artifacts', 'build-info');
  if (!fs.existsSync(biDir)) return null;
  const files = fs.readdirSync(biDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;
  // Pick the most recently modified build-info
  files.sort((a, b) => fs.statSync(path.join(biDir, b)).mtimeMs - fs.statSync(path.join(biDir, a)).mtimeMs);
  const bi = JSON.parse(fs.readFileSync(path.join(biDir, files[0]), 'utf8'));

  let fqName = preferredFqName;
  if (!fqName || !fqName.includes(':')) {
    // Derive from the project source (contracts/*.sol) and its compiled contract name
    const contractSource = Object.keys(bi.input.sources).find((s) => s.startsWith('contracts/'));
    let contractName = 'Contract';
    const outContracts = bi.output && bi.output.contracts && bi.output.contracts[contractSource];
    if (outContracts) contractName = Object.keys(outContracts)[0];
    fqName = `${contractSource}:${contractName}`;
  }

  return {
    input: bi.input,
    solcLongVersion: bi.solcLongVersion,
    optimizerEnabled: !!(bi.input.settings && bi.input.settings.optimizer && bi.input.settings.optimizer.enabled),
    runs: (bi.input.settings && bi.input.settings.optimizer && bi.input.settings.optimizer.runs) || 200,
    fqName,
  };
}

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * /api/verify/byAddress:
   *   post:
   *     tags: [Verify]
   *     summary: Verify a deployed contract by address using repository contracts
   *     description: |
   *       Uses a temporary Hardhat config with Blockscout customChains. Compiles from the repo's `contracts/`.
   *       Provide `fullyQualifiedName` if multiple contracts exist in a file.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               address: { type: string }
   *               network: { type: string, example: 'basecamp' }
   *               // license: deprecated for Hardhat Verify v2
   *               fullyQualifiedName: { type: string, example: 'contracts/File.sol:Contract' }
   *               args: { type: array, items: { type: string }, description: 'Constructor arguments, if any' }
   *     responses:
   *       200: { description: Verification result }
   *       400: { description: Bad request }
   */
  router.post('/byAddress', async (req, res) => {
    try {
      const { address = '', network = 'basecamp', fullyQualifiedName = '', args = [] } = req.body || {};
      const addr = String(address || '').trim();
      if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return res.status(400).json({ ok: false, error: 'ADDRESS_INVALID' });

      const projectRoot = path.join(__dirname, '..', '..');
      const verifyTmpDir = path.join(projectRoot, 'tmp', 'verify', `address_${addr.toLowerCase()}`);
      fs.mkdirSync(verifyTmpDir, { recursive: true });
      const configPath = buildVerifyConfig(verifyTmpDir, { useRepoPaths: true });
      const net = normalizeNetwork(network || 'basecamp');

      // First compile to refresh artifacts with the temp config
      await runNpx(projectRoot, ['hardhat', 'compile', '--force', '--config', configPath]);

      // Build CLI args: npx hardhat verify --network <net> [--contract FQN] <address> <args...>
      const cliArgs = ['hardhat', 'verify', '--network', net, '--config', configPath];
      if (fullyQualifiedName && typeof fullyQualifiedName === 'string') {
        cliArgs.push('--contract', fullyQualifiedName);
      }
      cliArgs.push(addr);
      if (Array.isArray(args)) {
        for (const a of args) cliArgs.push(typeof a === 'string' ? a : JSON.stringify(a));
      }

      const { code, stdout, stderr } = await runNpx(projectRoot, cliArgs);
      {
        let explorerBase = null;
        if (net === 'basecamp') explorerBase = 'https://basecamp.cloud.blockscout.com/address/';
        else if (net === 'basecamp-testnet') explorerBase = 'https://sepolia-explorer.base.org/address/';
        else if (net === 'botchain') explorerBase = 'https://scan.botchain.ai/address/';
        else if (net === 'botchain-testnet') explorerBase = 'https://scan.bohr.life/address/';
        const explorerUrl = explorerBase ? `${explorerBase}${addr}#code` : undefined;
        const already = /already verified/i.test(stdout) || /already verified/i.test(stderr);
        const success = code === 0 || already;
        if (!success) {
          return res.status(500).json({ ok: false, error: `VERIFY_FAILED${already ? '_ALREADY_VERIFIED' : ''}`, stdout, stderr, explorerUrl });
        }
        return res.json({ ok: true, verified: true, explorerUrl, stdout });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /**
   * @swagger
   * /api/verify/byJob:
   *   post:
   *     tags: [Verify]
   *     summary: Verify a deployed contract on Blockscout/Etherscan using artifacts from a previous job
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               jobId: { type: string }
   *               network: { type: string, example: 'basecamp' }
   *               fullyQualifiedName: { type: string, example: 'contracts/File.sol:Contract' }
   *     responses:
   *       200: { description: Verification result }
   *       404: { description: Job or deployment data not found }
   */
  router.post('/byJob', async (req, res) => {
    try {
      const { jobId = '', network = 'basecamp', fullyQualifiedName = '' } = req.body || {};
      if (!jobId) return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });

      const projectRoot = path.join(__dirname, '..', '..');
      const sandboxDir = path.join(projectRoot, 'tmp', 'jobs', jobId);

      // Prefer in-memory job result; fall back to DB lookup, then persisted deploy/result.json
      let result = null;
      // Try cache first (sync), then DB (async)
      let job = getJobSync(jobId);
      if (!job) {
        job = await getJob(jobId);
      }
      if (job && job.result) {
        result = job.result;
      } else {
        try {
          const persistedPath = path.join(sandboxDir, 'deploy', 'result.json');
          if (fs.existsSync(persistedPath)) {
            result = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
          }
        } catch (_) {}
      }

      if (!result) {
        return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND', hint: 'No in-memory job and no persisted deploy result located.' });
      }

      const address = result.address;
      const args = (result.params && Array.isArray(result.params.args)) ? result.params.args : [];
      const fqName = fullyQualifiedName || result.fqName || '';
      if (!address) return res.status(404).json({ ok: false, error: 'DEPLOY_ADDRESS_NOT_FOUND_FOR_JOB', jobId });

      if (!fs.existsSync(sandboxDir)) return res.status(404).json({ ok: false, error: 'JOB_SANDBOX_NOT_FOUND', sandboxDir });

      // Decide whether to use repo paths or sandbox paths based on where the source file exists
      const sourceRel = typeof fqName === 'string' ? fqName.split(':')[0] : '';
      const sourceInRepo = sourceRel ? fs.existsSync(path.join(projectRoot, sourceRel)) : false;
      const configPath = buildVerifyConfig(sandboxDir, { useRepoPaths: !!sourceInRepo });
      const net = normalizeNetwork(network || result.network || 'basecamp');

      // First compile to refresh artifacts (produces build-info standard-json-input)
      const compileCwd = sourceInRepo ? projectRoot : sandboxDir;
      await runNpx(compileCwd, ['hardhat', 'compile', '--force', '--config', configPath]);

      const explorerBases = {
        basecamp: 'https://basecamp.cloud.blockscout.com/address/',
        'basecamp-testnet': 'https://sepolia-explorer.base.org/address/',
        botchain: 'https://scan.botchain.ai/address/',
        'botchain-testnet': 'https://scan.bohr.life/address/',
      };
      const explorerUrl = explorerBases[net] ? `${explorerBases[net]}${address}#code` : undefined;

      // ABI-encode constructor args (if any) into a hex string (no 0x) for the explorer
      let encodedConstructorArgs = '';
      if (args.length > 0) {
        try {
          // best-effort: read ABI from artifacts to encode. Fall back to empty on failure.
          const { AbiCoder } = require('ethers');
          // Locate the contract artifact ABI to obtain constructor input types
          const [srcRel, cName] = (fqName || '').split(':');
          const artifactPath = path.join(sandboxDir, 'artifacts', srcRel, `${cName}.json`);
          if (fs.existsSync(artifactPath)) {
            const art = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            const ctor = (art.abi || []).find((x) => x.type === 'constructor');
            if (ctor && ctor.inputs && ctor.inputs.length > 0) {
              const coder = AbiCoder.defaultAbiCoder();
              const types = ctor.inputs.map((i) => i.type);
              encodedConstructorArgs = coder.encode(types, args).slice(2);
            }
          }
        } catch (encErr) {
          console.error('Constructor arg encoding failed, submitting without args:', encErr.message);
        }
      }

      // For BOT Chain networks: Hardhat verify fails because the explorer is behind
      // Cloudflare, which blocks Hardhat's large urlencoded POST. Use the direct
      // JSON API (bypasses the WAF) with the exact solc standard-json-input.
      if (EXPLORER_API_URLS[net]) {
        const bi = loadBuildInfo(sandboxDir, fqName);
        if (!bi) {
          return res.status(500).json({ ok: false, error: 'BUILD_INFO_NOT_FOUND', hint: 'Compile did not produce build-info for direct verification.', explorerUrl });
        }
        try {
          const apiResult = await verifyViaExplorerAPI({
            address,
            standardJsonInput: bi.input,
            fqName: bi.fqName,
            compilerVersion: 'v' + bi.solcLongVersion,
            network: net,
            optimizerEnabled: bi.optimizerEnabled,
            runs: bi.runs,
            constructorArgs: encodedConstructorArgs,
          });
          if (apiResult.verified) {
            return res.json({ ok: true, verified: true, explorerUrl, message: apiResult.message, method: 'direct-api' });
          }
          return res.status(500).json({ ok: false, error: 'VERIFY_FAILED', message: apiResult.message, raw: apiResult.raw, explorerUrl, method: 'direct-api' });
        } catch (apiErr) {
          return res.status(500).json({ ok: false, error: 'VERIFY_FAILED', message: apiErr.message, explorerUrl, method: 'direct-api' });
        }
      }

      // Non-BOT-Chain networks: use Hardhat verify plugin
      const cliArgs = ['hardhat', 'verify', '--network', net, '--config', configPath];
      if (fqName && typeof fqName === 'string') {
        cliArgs.push('--contract', fqName);
      }
      cliArgs.push(address);
      for (const a of args) cliArgs.push(typeof a === 'string' ? a : JSON.stringify(a));

      const { code, stdout, stderr } = await runNpx(compileCwd, cliArgs);
      {
        const already = /already verified/i.test(stdout) || /already verified/i.test(stderr);
        const success = code === 0 || already;
        if (success) {
          return res.json({ ok: true, verified: true, explorerUrl, stdout });
        }
        return res.status(500).json({ ok: false, error: `VERIFY_FAILED${already ? '_ALREADY_VERIFIED' : ''}`, stdout, stderr, explorerUrl });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /**
   * @swagger
   * /api/verify/status:
   *   get:
   *     tags: [Verify]
   *     summary: Check if a contract address is verified on block explorer
   *     description: |
   *       Queries the block explorer API (Blockscout or Etherscan) to check if a contract's source code is verified.
   *       Returns verification status and explorer URL for the contract.
   *     parameters:
   *       - in: query
   *         name: address
   *         required: true
   *         schema:
   *           type: string
   *         description: Contract address to check
   *         example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
   *       - in: query
   *         name: network
   *         schema:
   *           type: string
   *           default: basecamp
   *         description: Network where contract is deployed
   *         example: basecamp
   *     responses:
   *       200:
   *         description: Verification status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *                   example: true
   *                 verified:
   *                   type: boolean
   *                   example: true
   *                   description: Whether the contract source is verified
   *                 explorerUrl:
   *                   type: string
   *                   example: "https://basecamp.cloud.blockscout.com/address/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5#code"
   *       400:
   *         description: Missing or invalid address
   *       500:
   *         description: Error querying block explorer
   */
  // Status: check explorer API to determine if source is verified for the address
  router.get('/status', async (req, res) => {
    try {
      const { address = '', network = 'basecamp' } = req.query || {};
      if (!address) return res.status(400).json({ ok: false, error: 'ADDRESS_REQUIRED' });
      const net = normalizeNetwork(String(network || 'basecamp'));

      // Map network to explorer API/browser
      let apiBase = null;
      let browserBase = null;
      switch (net) {
        case 'basecamp':
          apiBase = 'https://basecamp.cloud.blockscout.com/api';
          browserBase = 'https://basecamp.cloud.blockscout.com';
          break;
        case 'basecamp-testnet':
          apiBase = 'https://api-sepolia.basescan.org/api';
          browserBase = 'https://sepolia-explorer.base.org';
          break;
        default:
          // Unknown network: return link only
          return res.json({ ok: true, verified: false, explorerUrl: undefined, note: 'Unknown network for status check' });
      }

      const explorerUrl = `${browserBase}/address/${address}#code`;

      // Try Etherscan-compatible endpoint first
      let verified = false;
      try {
        const url = `${apiBase}?module=contract&action=getsourcecode&address=${address}`;
        const { json } = await fetchJSON(url);
        if (json && json.status === '1' && Array.isArray(json.result) && json.result.length > 0) {
          const r0 = json.result[0] || {};
          const abi = String(r0.ABI || '');
          // On Etherscan/Blockscout: ABI is 'Contract source code not verified' when not verified
          verified = abi && abi !== 'Contract source code not verified';
        } else if (json && json.message && /not verified/i.test(String(json.result || json.message))) {
          verified = false;
        }
      } catch (_) {
        // ignore and try v2 below if basecamp
      }

      // Fallback to Blockscout v2 if basecamp and still unknown
      if (net === 'basecamp' && verified === false) {
        try {
          const v2 = await fetchJSON(`https://basecamp.cloud.blockscout.com/api/v2/smart-contracts/${address}`);
          const v2j = v2.json || {};
          if (typeof v2j.verified === 'boolean') verified = v2j.verified;
        } catch (_) {}
      }

      return res.json({ ok: true, verified: !!verified, explorerUrl });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
