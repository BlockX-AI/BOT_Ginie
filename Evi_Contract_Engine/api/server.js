const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { exec, spawn, execSync } = require('child_process');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const pinoHttp = require('pino-http');
const logger = require('./lib/logger');

// Load environment variables
dotenv.config();

// Initialize PostgreSQL database for persistent job storage
const db = require('./lib/db');
const jobStore = require('./lib/jobStore');

// Initialize database schema and warm cache on startup
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      await db.initializeDatabase();
      await jobStore.warmCache();
      logger.info('PostgreSQL database initialized for persistent job storage');
    } else {
      logger.warn('DATABASE_URL not set - jobs will not persist across redeployments');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to initialize database - falling back to in-memory storage');
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;

// Simple request ID generator
let __reqIdSeq = 0;

// Helper to ensure artifacts exist (compile at runtime if necessary)
let __artifactsPrepared = false;
function ensureArtifactsPrepared() {
  if (__artifactsPrepared) return true;
  try {
    if (process.env.DISABLE_RUNTIME_COMPILE === '1') {
      logger.warn('Runtime compile disabled by DISABLE_RUNTIME_COMPILE=1');
      __artifactsPrepared = true;
      return false;
    }
    const projectRoot = path.join(__dirname, '..');
    const artifactsDir = path.join(projectRoot, 'artifacts');
    // If artifacts folder missing or looks empty, compile
    const needsCompile = !fs.existsSync(artifactsDir) || (fs.existsSync(artifactsDir) && fs.readdirSync(artifactsDir).length === 0);
    if (needsCompile) {
      logger.info('Artifacts missing; running hardhat compile at runtime');
      execSync('npx hardhat compile', { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, HARDHAT_DISABLE_TELEMETRY: '1' } });
    }
    __artifactsPrepared = true;
    return true;
  } catch (e) {
    logger.error({ err: e }, 'Runtime hardhat compile failed');
    return false;
  }
}

// Helper function to safely load files or use environment variables
function loadContractData(artifactPath, envAbiKey, envAddressKey) {
  try {
    // Prefer vendored static artifacts committed to repo
    const staticPath = path.join(__dirname, 'static-artifacts', artifactPath);
    if (fs.existsSync(staticPath)) {
      return require(staticPath);
    }
    // Try to load from artifacts directory in same folder
    const localPath = path.join(__dirname, 'artifacts', artifactPath);
    if (fs.existsSync(localPath)) {
      return require(localPath);
    }
    
    // Try to load from parent directory
    const parentPath = path.join(__dirname, '..', 'artifacts', artifactPath);
    if (fs.existsSync(parentPath)) {
      return require(parentPath);
    }

    // Attempt runtime compile as a fallback, then retry
    if (ensureArtifactsPrepared()) {
      if (fs.existsSync(localPath)) return require(localPath);
      if (fs.existsSync(parentPath)) return require(parentPath);
    }
    
    // Fall back to environment variables if available
    if (process.env[envAbiKey] && process.env[envAddressKey]) {
      return {
        abi: JSON.parse(process.env[envAbiKey]),
        address: process.env[envAddressKey]
      };
    }
    
    throw new Error(`Could not load contract artifact: ${artifactPath}`);
  } catch (error) {
    console.error(`Error loading contract data for ${artifactPath}:`, error);
    return null;
  }
}

// Safely create a contract instance when abi or address may be missing
function safeNewContract(address, artifact, name, signer) {
  try {
    if (!artifact || !artifact.abi) {
      logger.error({ name }, `${name} ABI missing; skipping contract init`);
      return null;
    }
    if (!address) {
      logger.error({ name }, `${name} address missing; skipping contract init`);
      return null;
    }
    return new ethers.Contract(address, artifact.abi, signer);
  } catch (e) {
    logger.error({ err: e, name }, `Failed to init ${name}`);
    return null;
  }
}

// Load contract artifacts with fallback to environment variables
const researchPaperArtifact = loadContractData(
  'contracts/ResearchPaper.sol/ResearchPaper.json',
  'RESEARCH_PAPER_ABI',
  'RESEARCH_PAPER_ADDRESS'
);

const citationRegistryArtifact = loadContractData(
  'contracts/CitationRegistry.sol/CitationRegistry.json',
  'CITATION_REGISTRY_ABI',
  'CITATION_REGISTRY_ADDRESS'
);

const royaltyDistributorArtifact = loadContractData(
  'contracts/RoyaltyDistributor.sol/RoyaltyDistributor.json',
  'ROYALTY_DISTRIBUTOR_ABI',
  'ROYALTY_DISTRIBUTOR_ADDRESS'
);

const mockOriginProtocolArtifact = loadContractData(
  'contracts/mocks/MockOriginProtocol.sol/MockOriginProtocol.json',
  'MOCK_ORIGIN_PROTOCOL_ABI',
  'MOCK_ORIGIN_PROTOCOL_ADDRESS'
);

// Load deployment data with fallback to environment variables
let deploymentData = null;
try {
  function loadDeploymentFrom(dir) {
    if (!fs.existsSync(dir)) return null;
    const all = fs.readdirSync(dir).filter(f => f.includes('basecamp'));
    if (all.length === 0) return null;
    // Prefer comprehensive file name pattern first
    const preferred = all.filter(f => f.includes('basecamp-deployment'));
    const ordered = [...preferred, ...all.filter(f => !f.includes('basecamp-deployment'))];
    for (const file of ordered) {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        // Heuristic: ensure core contracts exist
        if (json && json.contracts && json.contracts.ResearchPaper && json.contracts.CitationRegistry && json.contracts.RoyaltyDistributor && json.contracts.MockOriginProtocol) {
          return json;
        }
        // If not comprehensive, keep as fallback if nothing else found
        if (!deploymentData) deploymentData = json;
      } catch (_) {}
    }
    return null;
  }

  // Try local and parent paths
  loadDeploymentFrom(path.join(__dirname, 'deployments'));
  if (!deploymentData) {
    const found = loadDeploymentFrom(path.join(__dirname, '..', 'deployments'));
    if (found) deploymentData = found;
  }

  // Fall back to environment variables if needed
  if (!deploymentData && process.env.DEPLOYMENT_DATA) {
    deploymentData = JSON.parse(process.env.DEPLOYMENT_DATA);
  }
} catch (error) {
  logger.error({ err: error }, 'Error loading deployment data');
}

// Middleware (CORS: allow all origins unconditionally)
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
// Structured HTTP logging
app.use(pinoHttp({
  logger,
  genReqId: function genReqId(req, res) {
    // preserve if provided
    if (req.id) return req.id;
    __reqIdSeq = (__reqIdSeq || 0) + 1;
    const id = String(__reqIdSeq);
    res.setHeader('X-Request-Id', id);
    req.__reqId = id;
    return id;
  },
  customLogLevel: function (res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      const headers = req.headers || {};
      // Avoid logging sensitive headers
      const { authorization, cookie, ...safeHeaders } = headers;
      return { id: req.id || req.__reqId, method: req.method, url: req.url, headers: safeHeaders, remoteAddress: req.ip };
    },
    res(res) {
      return { statusCode: res.statusCode };
    }
  },
  customSuccessMessage: function (req, res) {
    return `HTTP ${res.statusCode} ${req.method} ${req.url}`;
  },
  customErrorMessage: function (req, res, err) {
    return `HTTP ERROR ${res.statusCode} ${req.method} ${req.url}: ${err && err.message}`;
  }
}));

// Setup Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AcademicChain API',
      version: '1.0.0',
      description: 'API for interacting with AcademicChain smart contracts',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  // Only include AI, Jobs, and Artifacts routes in the API docs (and this server file for deploy docs)
  apis: [
    path.join(__dirname, 'routes', 'ai.js'),
    path.join(__dirname, 'routes', 'jobs.js'),
    path.join(__dirname, 'server.js'),
    path.join(__dirname, 'routes', 'artifacts.js'),
    path.join(__dirname, 'routes', 'audit.js'),
    path.join(__dirname, 'routes', 'compliance.js'),
    path.join(__dirname, 'routes', 'verify.js'),
    path.join(__dirname, 'routes', 'wallet-deploy.js'),
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the raw OpenAPI spec for programmatic access
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});
// Common alias
app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// Create provider and connection to Basecamp network
const provider = new ethers.JsonRpcProvider(process.env.BASECAMP_RPC_URL || "https://rpc.basecamp.t.raas.gelato.cloud");

// Safe wallet creation with private key validation
let wallet;
try {
  // Check if we have a valid private key (must be 64 or 66 chars for hex)
  const privateKey = process.env.BASECAMP_PRIVATE_KEY;
  if (privateKey && (privateKey.length === 64 || privateKey.length === 66)) {
    // Format key properly (add 0x prefix if missing)
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    wallet = new ethers.Wallet(formattedKey, provider);
    logger.info({ address: wallet.address }, 'Connected with wallet');
  } else {
    // Use a dummy wallet for read-only operations
    logger.warn('No valid private key found. Creating a read-only connection.');
    // Generate a random wallet for read-only operations
    wallet = ethers.Wallet.createRandom().connect(provider);
    logger.warn({ address: wallet.address }, 'Using read-only mode with random address');
  }
} catch (error) {
  logger.error({ err: error }, 'Error creating wallet');
  // Generate a random wallet as fallback
  wallet = ethers.Wallet.createRandom().connect(provider);
  logger.warn({ address: wallet.address }, 'Using fallback random address');
}

// Contract instances
let researchPaper, citationRegistry, royaltyDistributor, mockOriginProtocol;

// Resolve an address via deploymentData, environment, artifact.address, or fallback
function resolveAddress(name, envKey, artifact, fallback) {
  try {
    const fromDeployment = (deploymentData && deploymentData.contracts && deploymentData.contracts[name]) ? deploymentData.contracts[name] : null;
    const fromEnv = process.env[envKey] && String(process.env[envKey]).trim() ? String(process.env[envKey]).trim() : null;
    const fromArtifact = artifact && artifact.address ? artifact.address : null;
    const addr = fromDeployment || fromEnv || fromArtifact || fallback || null;
    if (!addr) {
      logger.warn({ name }, `No address resolved for ${name}`);
    }
    return addr;
  } catch (e) {
    logger.warn({ name, err: e }, `Failed to resolve address for ${name}`);
    return fallback || null;
  }
}

// Resolve addresses with sensible fallbacks
const rpAddress = resolveAddress('ResearchPaper', 'RESEARCH_PAPER_ADDRESS', researchPaperArtifact, '0x0D3afa3339Cad61d7a4f4390D651d933B5Dc913d');
const crAddress = resolveAddress('CitationRegistry', 'CITATION_REGISTRY_ADDRESS', citationRegistryArtifact, '0xF09B40Dfc07A584970312D1f62Ed84A4EDd575c9');
const rdAddress = resolveAddress('RoyaltyDistributor', 'ROYALTY_DISTRIBUTOR_ADDRESS', royaltyDistributorArtifact, '0x41D13507f38b4acd2ED99BFbBc785D96Ce420386');
const mopAddress = resolveAddress('MockOriginProtocol', 'MOCK_ORIGIN_PROTOCOL_ADDRESS', mockOriginProtocolArtifact, '0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1');

// Initialize contracts
researchPaper = safeNewContract(rpAddress, researchPaperArtifact, 'ResearchPaper', wallet);
citationRegistry = safeNewContract(crAddress, citationRegistryArtifact, 'CitationRegistry', wallet);
royaltyDistributor = safeNewContract(rdAddress, royaltyDistributorArtifact, 'RoyaltyDistributor', wallet);
mockOriginProtocol = safeNewContract(mopAddress, mockOriginProtocolArtifact, 'MockOriginProtocol', wallet);

// Disabled router to keep server healthy if a contract isn't initialized
function disabledRouter(name) {
  const r = express.Router();
  r.use((req, res) => res.status(503).json({ error: `${name} contract is not initialized on this service` }));
  return r;
}

// Import routes with fallbacks
const researchPaperRoutes = researchPaper ? require('./routes/researchPaper')(researchPaper) : disabledRouter('ResearchPaper');
const citationRegistryRoutes = citationRegistry ? require('./routes/citationRegistry')(citationRegistry) : disabledRouter('CitationRegistry');
const royaltyDistributorRoutes = royaltyDistributor ? require('./routes/royaltyDistributor')(royaltyDistributor) : disabledRouter('RoyaltyDistributor');
const originProtocolRoutes = mockOriginProtocol ? require('./routes/originProtocol')(mockOriginProtocol) : disabledRouter('MockOriginProtocol');
const jobsRoutes = require('./routes/jobs')();
const aiRoutes = require('./routes/ai')();
const artifactsRoutes = require('./routes/artifacts')();
const auditRoutes = require('./routes/audit')();
const complianceRoutes = require('./routes/compliance')();
const verifyRoutes = require('./routes/verify')();
const walletDeployRoutes = require('./routes/wallet-deploy')();

// Serve static files for signing pages
app.use('/sign', express.static(path.join(__dirname, 'public')));
app.use('/sign-with-privy', express.static(path.join(__dirname, 'public')));
app.use('/sign-with-walletconnect', express.static(path.join(__dirname, 'public')));

// Serve signing pages for any session ID
app.get('/sign/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sign.html'));
});

app.get('/sign-with-privy/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sign-with-privy.html'));
});

app.get('/sign-with-walletconnect/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sign-with-walletconnect.html'));
});

// Serve demo page
app.get('/demo-wallet-deploy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo-wallet-deploy.html'));
});

// Routes
app.use('/api/papers', researchPaperRoutes);
app.use('/api/citations', citationRegistryRoutes);
app.use('/api/royalties', royaltyDistributorRoutes);
app.use('/api/origin', originProtocolRoutes);
app.use('/api/job', jobsRoutes);

app.all(['/generate', '/generate/'], (req, res) => res.redirect(307, '/api/ai/generate'));

app.use('/api/ai', aiRoutes);
app.use('/api/artifacts', artifactsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/wallet', walletDeployRoutes);

// Simple per-network deployment queue to avoid nonce collisions across concurrent requests
const __deployQueues = new Map();
function enqueueDeploy(key, task) {
  const prev = __deployQueues.get(key) || Promise.resolve();
  const p = prev.then(() => task());
  __deployQueues.set(key, p.catch(() => {}));
  return p;
}

// Deployment endpoint: deploy ERC20 BusinessToken via Hardhat in project root
// Body: { name: string, symbol: string, initialSupply: string (tokens), owner?: string }
/**
 * @swagger
 * /api/deploy/erc20:
 *   post:
 *     tags: [Deploy]
 *     summary: Deploy an ERC20 BusinessToken via Hardhat
 *     description: |
 *       Deploys the `contracts/BusinessToken.sol` contract using a per-request sandbox and the configured Hardhat networks.
 *       Requires a network with a configured private key in environment variables. Returns deployment result with address.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Business Token
 *               symbol:
 *                 type: string
 *                 example: BUS
 *               initialSupply:
 *                 type: string
 *                 description: Initial token supply in whole tokens (18 decimals will be applied)
 *                 example: "1000000"
 *               owner:
 *                 type: string
 *                 description: Owner address; defaults to deployer
 *                 example: 0x0000000000000000000000000000000000000000
 *               network:
 *                 type: string
 *                 description: |
 *                   Target network key from Hardhat config.
 *                   Aliases supported: camp -> basecamp, camp-testnet -> basecamp-testnet, fuji/avax-fuji -> avalanche-fuji, boba -> boba-sepolia.
 *                 example: basecamp
 *     responses:
 *       200:
 *         description: Deployment succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     network: { type: string }
 *                     address: { type: string }
 *                     name: { type: string }
 *                     symbol: { type: string }
 *                     initialSupplyTokens: { type: string }
 *                     owner: { type: string }
 *                 stdout: { type: string }
 *       400:
 *         description: Missing private key for requested network
 *       500:
 *         description: Deployment failed
 */
app.post('/api/deploy/erc20', async (req, res) => {
  try {
    const { name = 'Business Token', symbol = 'BUS', initialSupply = '1000000', owner = '', network = 'basecamp' } = req.body || {};

    // Normalize/alias network names to those defined in hardhat.config.js
    const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'basecamp';
    const normalizedRequested = requested.replace(/_/g, '-').toLowerCase();
    const aliasMap = {
      'camp': 'basecamp',
      'camp-testnet': 'basecamp-testnet',
      'basecamp-testnet': 'basecamp-testnet',
      'basecamp-mainnet': 'basecamp-mainnet',
      'fuji': 'avalanche-fuji',
      'avax-fuji': 'avalanche-fuji',
      // Boba Sepolia aliases
      'boba-sepolia': 'boba-sepolia',
      'boba': 'boba-sepolia',
    };
    const net = aliasMap[normalizedRequested] || normalizedRequested;

    // Preflight: ensure a private key is configured for the chosen network
    const keyByNetwork = {
      'basecamp': 'BASECAMP_PRIVATE_KEY',
      'basecamp-testnet': 'BASECAMP_PRIVATE_KEY',
      'basecamp-mainnet': 'BASECAMP_PRIVATE_KEY',
      'camp-testnet': 'CAMP_PRIVATE_KEY',
      'avalanche-fuji': (process.env.AVALANCHE_PRIVATE_KEY ? 'AVALANCHE_PRIVATE_KEY' : (process.env.BASECAMP_PRIVATE_KEY ? 'BASECAMP_PRIVATE_KEY' : null)),
      // Use the same PRIVATE_KEY env for Boba Sepolia across the system
      'boba-sepolia': 'PRIVATE_KEY',
    };
    const requiredKeyEnv = keyByNetwork[net] || null;
    // Allow local hardhat without a private key; require keys for real networks
    if (net !== 'hardhat') {
      const hasKey = requiredKeyEnv && process.env[requiredKeyEnv] && String(process.env[requiredKeyEnv]).trim().length >= 64;
      if (!hasKey) {
        return res.status(400).json({
          ok: false,
          error: 'MISSING_PRIVATE_KEY_FOR_NETWORK',
          details: { network: net, requiredEnv: requiredKeyEnv || 'UNKNOWN', hint: 'Set the appropriate private key env var in your deployment environment.' }
        });
      }
    }

    // Build isolated sandbox under project root to compile only BusinessToken
    const projectRoot = path.join(__dirname, '..');
    const sandboxDir = path.join(projectRoot, 'tmp', 'jobs', `erc20_${Date.now()}`);
    const sandboxContractsDir = path.join(sandboxDir, 'contracts');
    const sandboxScriptsDir = path.join(sandboxDir, 'scripts');
    const sandboxConfigPath = path.join(sandboxDir, 'hardhat.config.js');
    fs.mkdirSync(sandboxContractsDir, { recursive: true });
    fs.mkdirSync(sandboxScriptsDir, { recursive: true });

    // Minimal isolated Hardhat config importing networks from root
    const sandboxConfig = `require("@nomicfoundation/hardhat-toolbox");\nrequire("dotenv").config();\nconst path = require('path');\n\nlet rootNetworks = {};\ntry {\n  // __dirname here points to the sandbox dir: /app/tmp/jobs/erc20_xxx\n  // Walk up three levels to reach project root: /app/hardhat.config.js\n  const rootCfg = require(path.join(__dirname, '..', '..', '..', 'hardhat.config.js'));\n  if (rootCfg && rootCfg.networks) rootNetworks = rootCfg.networks;\n} catch (e) { rootNetworks = {}; }\n\nconst normalizeKey = (k) => (k ? (k.startsWith('0x') ? k : '0x' + k) : undefined);\nconst fallbackNetworks = {\n  basecamp: {\n    url: process.env.BASECAMP_RPC_URL || "https://rpc.basecamp.t.raas.gelato.cloud",\n    accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],\n  },\n  'basecamp-testnet': {\n    url: process.env.BASECAMP_TESTNET_RPC_URL || "https://sepolia.base.org",\n    accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],\n  },\n};\n\nmodule.exports = {\n  solidity: {\n    compilers: [\n      { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },\n      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },\n    ],\n  },\n  networks: { hardhat: {}, ...fallbackNetworks, ...rootNetworks },\n  paths: {\n    sources: path.join(__dirname, 'contracts'),\n    tests: path.join(__dirname, 'test'),\n    cache: path.join(__dirname, 'cache'),\n    artifacts: path.join(__dirname, 'artifacts'),\n  },\n};\n`;
    fs.writeFileSync(sandboxConfigPath, sandboxConfig, 'utf8');

    // Copy only BusinessToken.sol into sandbox
    const sourceTokenPath = path.join(projectRoot, 'contracts', 'BusinessToken.sol');
    if (!fs.existsSync(sourceTokenPath)) {
      return res.status(500).json({ ok: false, error: 'BUSINESS_TOKEN_SOURCE_NOT_FOUND', hint: sourceTokenPath });
    }
    const targetTokenPath = path.join(sandboxContractsDir, 'BusinessToken.sol');
    fs.copyFileSync(sourceTokenPath, targetTokenPath);

    // Write a self-contained deploy script inside sandbox
    const deployScriptPath = path.join(sandboxScriptsDir, 'deploy-erc20.js');
    const deployScript = `const hre = require('hardhat');\nasync function main() {\n  const network = hre.network.name;\n  const name = process.env.NAME || 'Business Token';\n  const symbol = process.env.SYMBOL || 'BUS';\n  const initialSupplyTokens = process.env.INITIAL_SUPPLY || '1000000';\n  const ownerArg = process.env.OWNER || '';\n  const [deployer] = await hre.ethers.getSigners();\n  const owner = ownerArg && ownerArg !== '' ? ownerArg : deployer.address;\n  const initialSupplyWei = hre.ethers.parseUnits(String(initialSupplyTokens), 18);\n  const Factory = await hre.ethers.getContractFactory('BusinessToken');\n  const c = await Factory.connect(deployer).deploy(name, symbol, initialSupplyWei, owner);\n  await c.waitForDeployment();\n  const address = await c.getAddress();\n  const result = { network, address, name, symbol, initialSupplyTokens, owner };\n  console.log('DEPLOY_RESULT ' + JSON.stringify(result));\n}\nmain().catch((e) => { console.error(e); process.exit(1); });\n`;
    fs.writeFileSync(deployScriptPath, deployScript, 'utf8');

    // Execute in queue to avoid nonce collisions
    await enqueueDeploy(`erc20:${net}`, () => new Promise((resolve) => {
      const args = ['hardhat', 'run', path.relative(sandboxDir, deployScriptPath), '--network', net, '--config', sandboxConfigPath];
      const childEnv = { ...process.env, NAME: name, SYMBOL: symbol, INITIAL_SUPPLY: initialSupply, OWNER: owner };
      const child = spawn('npx', args, { cwd: sandboxDir, env: childEnv, shell: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => { stderr += `\nspawn error: ${err.message}`; });
      child.on('close', (code) => {
        if (code !== 0) {
          return resolve(res.status(500).json({ ok: false, error: `exit ${code}`, network: net, stderr }));
        }
        const match = (stdout || '').split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
        let result = null;
        if (match) {
          try { result = JSON.parse(match.replace('DEPLOY_RESULT ', '')); } catch (_) {}
        }
        try {
          const address = result?.address;
          if (address && typeof address === 'string') {
            let explorer = null;
            if (net === 'basecamp') explorer = `https://basecamp.cloud.blockscout.com/address/${address}`;
            if (net === 'basecamp-testnet') explorer = `https://testnet.basescan.org/address/${address}`;
            if (explorer) result = { ...result, explorerUrl: explorer };
          }
        } catch (_) {}
        return resolve(res.json({ ok: true, result, stdout, network: net }));
      });
    }));
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * @swagger
 * /api/deploy/research-paper:
 *   post:
 *     tags: [Deploy]
 *     summary: Deploy ResearchPaper contract (ERC721 NFT for academic papers)
 *     description: |
 *       Deploys the ResearchPaper contract which represents academic papers as NFTs.
 *       Requires origin protocol address for IP protection integration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the NFT collection
 *                 example: "ResearchPaper"
 *               symbol:
 *                 type: string
 *                 description: Symbol for the NFT collection
 *                 example: "RPR"
 *               originProtocol:
 *                 type: string
 *                 description: Address of the Origin Protocol contract for IP protection
 *                 example: "0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1"
 *               network:
 *                 type: string
 *                 description: Target network (basecamp, camp-testnet, boba-sepolia, avalanche-fuji)
 *                 default: "camp-testnet"
 *                 example: "basecamp"
 *     responses:
 *       200:
 *         description: Deployment succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     network: { type: string }
 *                     address: { type: string }
 *                     explorerUrl: { type: string }
 *                 stdout: { type: string }
 *       400:
 *         description: Missing origin protocol address
 *       500:
 *         description: Deployment failed
 */
// Deployment endpoint: deploy ResearchPaper
// Body: { name: string, symbol: string, originProtocol: string, network?: string }
app.post('/api/deploy/research-paper', async (req, res) => {
  try {
    const { name = 'ResearchPaper', symbol = 'RPR', originProtocol = '', network = 'camp-testnet' } = req.body || {};
    if (!originProtocol || typeof originProtocol !== 'string') {
      return res.status(400).json({ ok: false, error: 'ORIGIN_PROTOCOL_REQUIRED' });
    }
    const projectRoot = path.join(__dirname, '..');
    const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'camp-testnet';
    const normalizedRequested = requested.replace(/_/g, '-').toLowerCase();
    const aliasMap = {
      'camp': 'basecamp',
      'camp-testnet': 'basecamp-testnet',
      'fuji': 'avalanche-fuji',
      'avax-fuji': 'avalanche-fuji',
      'boba': 'boba-sepolia',
    };
    const net = aliasMap[normalizedRequested] || normalizedRequested;
    const cmd = `npx hardhat run scripts/deploy-research-paper.js --network ${net}`;
    const childEnv = { ...process.env, RP_NAME: name, RP_SYMBOL: symbol, ORIGIN_PROTOCOL: originProtocol };
    exec(cmd, { cwd: projectRoot, env: childEnv }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ ok: false, error: error.message, stderr });
      }
      const match = stdout.split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
      let result = null;
      if (match) {
        try { result = JSON.parse(match.replace('DEPLOY_RESULT ', '')); } catch (_) {}
      }
      try {
        const address = result?.address;
        if (address && typeof address === 'string') {
          const explorer = (net === 'basecamp') ? `https://basecamp.cloud.blockscout.com/address/${address}` : null;
          if (explorer) result = { ...result, explorerUrl: explorer };
        }
      } catch (_) {}
      return res.json({ ok: true, result, stdout });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * @swagger
 * /api/deploy/citation-registry:
 *   post:
 *     tags: [Deploy]
 *     summary: Deploy CitationRegistry contract
 *     description: |
 *       Deploys the CitationRegistry contract which tracks citations between research papers.
 *       Creates immutable citation relationships on-chain.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               network:
 *                 type: string
 *                 description: Target network (basecamp, camp-testnet, boba-sepolia, avalanche-fuji)
 *                 default: "camp-testnet"
 *                 example: "basecamp"
 *     responses:
 *       200:
 *         description: Deployment succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     network: { type: string }
 *                     address: { type: string }
 *                     explorerUrl: { type: string }
 *                 stdout: { type: string }
 *       500:
 *         description: Deployment failed
 */
// Deployment endpoint: deploy CitationRegistry
// Body: { network?: string }
app.post('/api/deploy/citation-registry', async (req, res) => {
  try {
    const { network = 'camp-testnet' } = req.body || {};
    const projectRoot = path.join(__dirname, '..');
    const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'camp-testnet';
    const normalizedRequested = requested.replace(/_/g, '-').toLowerCase();
    const aliasMap = {
      'camp': 'basecamp',
      'camp-testnet': 'basecamp-testnet',
      'fuji': 'avalanche-fuji',
      'avax-fuji': 'avalanche-fuji',
      'boba': 'boba-sepolia',
    };
    const net = aliasMap[normalizedRequested] || normalizedRequested;
    const cmd = `npx hardhat run scripts/deploy-citation-registry.js --network ${net}`;
    exec(cmd, { cwd: projectRoot, env: { ...process.env } }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ ok: false, error: error.message, stderr });
      }
      const match = stdout.split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
      let result = null;
      if (match) {
        try { result = JSON.parse(match.replace('DEPLOY_RESULT ', '')); } catch (_) {}
      }
      try {
        const address = result?.address;
        if (address && typeof address === 'string') {
          const explorer = (net === 'basecamp') ? `https://basecamp.cloud.blockscout.com/address/${address}` : null;
          if (explorer) result = { ...result, explorerUrl: explorer };
        }
      } catch (_) {}
      return res.json({ ok: true, result, stdout });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * @swagger
 * /api/deploy/royalty-distributor:
 *   post:
 *     tags: [Deploy]
 *     summary: Deploy RoyaltyDistributor contract
 *     description: |
 *       Deploys the RoyaltyDistributor contract which automatically distributes royalty payments
 *       when research papers are cited. Supports configurable platform fees and treasury.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originProtocol
 *             properties:
 *               originProtocol:
 *                 type: string
 *                 description: Address of the Origin Protocol contract
 *                 example: "0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1"
 *               treasury:
 *                 type: string
 *                 description: Treasury address for platform fees (defaults to deployer)
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
 *               platformFeeBps:
 *                 type: string
 *                 description: Platform fee in basis points (500 = 5%)
 *                 default: "500"
 *                 example: "500"
 *               network:
 *                 type: string
 *                 description: Target network
 *                 default: "camp-testnet"
 *                 example: "basecamp"
 *     responses:
 *       200:
 *         description: Deployment succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     network: { type: string }
 *                     address: { type: string }
 *                     explorerUrl: { type: string }
 *                 stdout: { type: string }
 *       400:
 *         description: Missing origin protocol address
 *       500:
 *         description: Deployment failed
 */
// Deployment endpoint: deploy RoyaltyDistributor
// Body: { originProtocol: string, treasury?: string, platformFeeBps?: number|string, network?: string }
app.post('/api/deploy/royalty-distributor', async (req, res) => {
  try {
    const { originProtocol = '', treasury = '', platformFeeBps = '500', network = 'camp-testnet' } = req.body || {};
    if (!originProtocol || typeof originProtocol !== 'string') {
      return res.status(400).json({ ok: false, error: 'ORIGIN_PROTOCOL_REQUIRED' });
    }
    const projectRoot = path.join(__dirname, '..');
    const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'camp-testnet';
    const normalizedRequested = requested.replace(/_/g, '-').toLowerCase();
    const aliasMap = {
      'camp': 'basecamp',
      'camp-testnet': 'basecamp-testnet',
      'fuji': 'avalanche-fuji',
      'avax-fuji': 'avalanche-fuji',
      'boba': 'boba-sepolia',
    };
    const net = aliasMap[normalizedRequested] || normalizedRequested;
    const cmd = `npx hardhat run scripts/deploy-royalty-distributor.js --network ${net}`;
    const childEnv = { ...process.env, ORIGIN_PROTOCOL: originProtocol, TREASURY: treasury, PLATFORM_FEE_BPS: String(platformFeeBps) };
    exec(cmd, { cwd: projectRoot, env: childEnv }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ ok: false, error: error.message, stderr });
      }
      const match = stdout.split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
      let result = null;
      if (match) {
        try { result = JSON.parse(match.replace('DEPLOY_RESULT ', '')); } catch (_) {}
      }
      try {
        const address = result?.address;
        if (address && typeof address === 'string') {
          const explorer = (net === 'basecamp') ? `https://basecamp.cloud.blockscout.com/address/${address}` : null;
          if (explorer) result = { ...result, explorerUrl: explorer };
        }
      } catch (_) {}
      return res.json({ ok: true, result, stdout });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Centralized error handler (last middleware)
app.use((err, req, res, next) => {
  const reqId = req.id || req.__reqId || '-';
  req.log ? req.log.error({ err }, 'Uncaught error') : logger.error({ err, reqId }, 'Uncaught error');
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'INTERNAL_SERVER_ERROR', reqId });
});

/**
 * @swagger
 * /api/deploy/academic-suite:
 *   post:
 *     tags: [Deploy]
 *     summary: Deploy complete Academic Suite (all 3 contracts together)
 *     description: |
 *       Deploys all three academic contracts in a single operation:
 *       1. CitationRegistry - Citation tracking
 *       2. ResearchPaper - NFT-based paper registry
 *       3. RoyaltyDistributor - Automatic royalty distribution
 *       
 *       All contracts are deployed with proper integration and addresses are cross-configured.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originProtocol
 *             properties:
 *               rpName:
 *                 type: string
 *                 description: Name for the ResearchPaper NFT collection
 *                 default: "ResearchPaper"
 *                 example: "AcademicPapers"
 *               rpSymbol:
 *                 type: string
 *                 description: Symbol for the ResearchPaper NFT collection
 *                 default: "RPR"
 *                 example: "ACP"
 *               originProtocol:
 *                 type: string
 *                 description: Address of the Origin Protocol contract (required)
 *                 example: "0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1"
 *               treasury:
 *                 type: string
 *                 description: Treasury address for platform fees (defaults to deployer)
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
 *               platformFeeBps:
 *                 type: string
 *                 description: Platform fee in basis points (500 = 5%)
 *                 default: "500"
 *                 example: "250"
 *               network:
 *                 type: string
 *                 description: Target network
 *                 default: "camp-testnet"
 *                 example: "basecamp"
 *     responses:
 *       200:
 *         description: All contracts deployed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     network: { type: string }
 *                     citationRegistry: { type: string, description: "CitationRegistry contract address" }
 *                     researchPaper: { type: string, description: "ResearchPaper contract address" }
 *                     royaltyDistributor: { type: string, description: "RoyaltyDistributor contract address" }
 *                     explorers:
 *                       type: object
 *                       properties:
 *                         CitationRegistry: { type: string }
 *                         ResearchPaper: { type: string }
 *                         RoyaltyDistributor: { type: string }
 *                 stdout: { type: string }
 *       400:
 *         description: Missing origin protocol address
 *       500:
 *         description: Deployment failed
 */
// Deployment endpoint: deploy Academic Suite (CitationRegistry, ResearchPaper, RoyaltyDistributor)
// Body: {
//   rpName: string,
//   rpSymbol: string,
//   originProtocol: string (address),
//   treasury?: string (address),
//   platformFeeBps?: string|number,
//   network?: string (e.g., 'basecamp')
// }
app.post('/api/deploy/academic-suite', async (req, res) => {
  try {
    const {
      rpName = 'ResearchPaper',
      rpSymbol = 'RPR',
      originProtocol = '',
      treasury = '',
      platformFeeBps = '500',
      network = 'camp-testnet'
    } = req.body || {};

    if (!originProtocol || typeof originProtocol !== 'string') {
      return res.status(400).json({ ok: false, error: 'ORIGIN_PROTOCOL_REQUIRED' });
    }

    const projectRoot = path.join(__dirname, '..');
    const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'camp-testnet';
    const normalizedRequested = requested.replace(/_/g, '-').toLowerCase();
    const aliasMap = {
      'camp': 'basecamp',
      'camp-testnet': 'basecamp-testnet',
      'fuji': 'avalanche-fuji',
      'avax-fuji': 'avalanche-fuji',
      'boba': 'boba-sepolia',
    };
    const net = aliasMap[normalizedRequested] || normalizedRequested;
    const cmd = `npx hardhat run scripts/deploy-academic-suite.js --network ${net}`;
    const childEnv = {
      ...process.env,
      RP_NAME: rpName,
      RP_SYMBOL: rpSymbol,
      ORIGIN_PROTOCOL: originProtocol,
      TREASURY: treasury,
      PLATFORM_FEE_BPS: String(platformFeeBps)
    };

    exec(cmd, { cwd: projectRoot, env: childEnv }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ ok: false, error: error.message, stderr });
      }

      const match = stdout.split('\n').find((l) => l.startsWith('DEPLOY_SUITE_RESULT '));
      let result = null;
      if (match) {
        try { result = JSON.parse(match.replace('DEPLOY_SUITE_RESULT ', '')); } catch (_) {}
      }

      // Attach explorer URLs for basecamp
      try {
        if (result && net === 'basecamp') {
          const base = 'https://basecamp.cloud.blockscout.com/address/';
          result = {
            ...result,
            explorers: {
              CitationRegistry: result.citationRegistry ? `${base}${result.citationRegistry}` : null,
              ResearchPaper: result.researchPaper ? `${base}${result.researchPaper}` : null,
              RoyaltyDistributor: result.royaltyDistributor ? `${base}${result.royaltyDistributor}` : null,
            }
          };
        }
      } catch (_) {}

      return res.json({ ok: true, result, stdout });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (health.healthy) {
      return res.json({ ok: true, database: 'postgresql', ...health });
    }
    return res.status(503).json({ ok: false, database: 'postgresql', ...health });
  } catch (err) {
    return res.status(503).json({ ok: false, error: err.message });
  }
});

// Root route
app.get('/', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const health = await db.healthCheck();
    dbStatus = health.healthy ? 'connected' : 'disconnected';
  } catch (_) {
    dbStatus = 'error';
  }
  res.json({
    message: 'Welcome to AcademicChain API',
    documentation: '/api-docs',
    status: 'online',
    database: dbStatus,
    contractAddresses: {
      ResearchPaper: researchPaper ? researchPaper.target : null,
      CitationRegistry: citationRegistry ? citationRegistry.target : null,
      RoyaltyDistributor: royaltyDistributor ? royaltyDistributor.target : null,
      MockOriginProtocol: mockOriginProtocol ? mockOriginProtocol.target : null
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'AcademicChain API server running');
  logger.info({ url: `http://localhost:${PORT}/api-docs` }, 'API documentation available');
  logger.info('Connected contracts:');
  if (researchPaper) logger.info({ address: researchPaper.target }, 'ResearchPaper'); else logger.warn('ResearchPaper not initialized');
  if (citationRegistry) logger.info({ address: citationRegistry.target }, 'CitationRegistry'); else logger.warn('CitationRegistry not initialized');
  if (royaltyDistributor) logger.info({ address: royaltyDistributor.target }, 'RoyaltyDistributor'); else logger.warn('RoyaltyDistributor not initialized');
  if (mockOriginProtocol) logger.info({ address: mockOriginProtocol.target }, 'MockOriginProtocol'); else logger.warn('MockOriginProtocol not initialized');
});

module.exports = app;
