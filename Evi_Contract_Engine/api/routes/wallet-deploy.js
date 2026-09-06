// Wallet-based deployment routes
// Handles link-based signing workflow with minimal frontend complexity

const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const { createJob, updateJob, getJob, appendJobLog, saveContract, saveDeployment } = require('../lib/jobStore');
const { createSession, getSession, signSession, getStats } = require('../lib/sessions');
const { prepareUnsignedDeployTx, monitorTransaction, getNetworkConfig } = require('../lib/txUtils');
const logger = require('../lib/logger');

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * /api/wallet/deploy-with-wallet:
   *   post:
   *     tags: [Wallet]
   *     summary: Start a wallet-based deployment (user signs with their own wallet)
   *     description: |
   *       Initiates a smart contract deployment using the user's wallet. This endpoint:
   *       1. Generates contract code from natural language prompt using AI
   *       2. Compiles the contract with Hardhat
   *       3. Prepares an unsigned deployment transaction
   *       4. Creates a temporary session with transaction data
   *       5. Returns a magic link for the user to sign the transaction
   *       
   *       The user then opens the magic link, signs with MetaMask/WalletConnect, and the backend monitors the transaction.
   *       Poll the job status endpoint to track progress and get the magic link when ready.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - prompt
   *             properties:
   *               prompt:
   *                 type: string
   *                 description: Natural language description of the contract to deploy
   *                 example: Create an ERC20 token named MyToken with symbol MTK and initial supply of 1 million tokens
   *               network:
   *                 type: string
   *                 description: Target network for deployment
   *                 default: basecamp
   *                 enum: [basecamp, basecamp-testnet, base-sepolia, camp-testnet, camp-90354, camp-netnet, boba-sepolia, avalanche-fuji, bsc-testnet]
   *                 example: basecamp-testnet
   *               callbackUrl:
   *                 type: string
   *                 description: URL to redirect to after signing (optional)
   *                 example: https://yourapp.com/dashboard
   *               constructorArgs:
   *                 type: array
   *                 description: Constructor arguments for the contract (optional)
   *                 items:
   *                   type: string
   *                 example: []
   *               strictArgs:
   *                 type: boolean
   *                 description: Whether to enforce strict constructor argument validation
   *                 default: false
   *     responses:
   *       200:
   *         description: Deployment job created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobId:
   *                   type: string
   *                   example: ai_wallet_deploy_abc123xyz
   *                 status:
   *                   type: string
   *                   example: processing
   *                 message:
   *                   type: string
   *                   example: Deployment started. Generating contract code and preparing transaction...
   *                 checkStatusUrl:
   *                   type: string
   *                   example: /api/jobs/ai_wallet_deploy_abc123xyz
   *       400:
   *         description: Missing or invalid prompt
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Missing or invalid prompt
   *       500:
   *         description: Internal server error
   */
  router.post('/deploy-with-wallet', async (req, res) => {
    try {
      const { prompt, network = 'basecamp', callbackUrl, constructorArgs, strictArgs } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid prompt' });
      }
      
      // Create job
      const job = await createJob('ai_wallet_deploy', {
        prompt,
        network,
        deployMode: 'user-wallet',
        constructorArgs,
        strictArgs,
        callbackUrl
      });
      
      appendJobLog(job.id, 'info', `Wallet deployment started: ${prompt.substring(0, 100)}`);
      logger.info({ jobId: job.id, prompt: prompt.substring(0, 100), network }, 'Wallet deployment job created');
      
      // Process in background
      setImmediate(async () => {
        await processWalletDeployment(job, req.body);
      });
      
      res.json({
        jobId: job.id,
        status: 'processing',
        message: 'Deployment started. Generating contract code and preparing transaction...',
        checkStatusUrl: `/api/jobs/${job.id}`
      });
      
    } catch (e) {
      logger.error({ error: e.message }, 'Wallet deployment creation failed');
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/wallet/sign/{sessionId}:
   *   get:
   *     tags: [Wallet]
   *     summary: Get session details for signing
   *     description: |
   *       Retrieves session data for a wallet deployment that's ready for signing.
   *       Used by the signing page to display transaction details to the user.
   *       Sessions expire after 15 minutes and can only be used once.
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID from the magic link (format sess_xxxxx)
   *         example: sess_abc123xyz
   *     responses:
   *       200:
   *         description: Session details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessionId:
   *                   type: string
   *                   example: sess_abc123xyz
   *                 jobId:
   *                   type: string
   *                   example: ai_wallet_deploy_abc123
   *                 contractName:
   *                   type: string
   *                   example: MyToken
   *                 network:
   *                   type: string
   *                   example: basecamp-testnet
   *                 networkName:
   *                   type: string
   *                   example: Base Sepolia
   *                 estimatedGas:
   *                   type: string
   *                   description: Estimated gas cost in ETH
   *                   example: "0.002"
   *                 unsignedTx:
   *                   type: object
   *                   description: Unsigned transaction object for signing
   *                   properties:
   *                     to:
   *                       type: string
   *                       nullable: true
   *                     data:
   *                       type: string
   *                     value:
   *                       type: string
   *                     gasLimit:
   *                       type: string
   *                     chainId:
   *                       type: integer
   *                     type:
   *                       type: integer
   *                     maxFeePerGas:
   *                       type: string
   *                     maxPriorityFeePerGas:
   *                       type: string
   *                 chainId:
   *                   type: integer
   *                   example: 84532
   *                 callbackUrl:
   *                   type: string
   *                   example: https://yourapp.com/dashboard
   *                 expiresAt:
   *                   type: integer
   *                   description: Unix timestamp when session expires
   *                   example: 1697123456789
   *                 status:
   *                   type: string
   *                   enum: [pending_signature, signed, expired, failed]
   *                   example: pending_signature
   *       404:
   *         description: Session not found or expired
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Session not found or expired
   *       500:
   *         description: Internal server error
   */
  router.get('/sign/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }
      
      // Return session data needed for signing
      res.json({
        sessionId: session.sessionId,
        jobId: session.jobId,
        contractName: session.contractName,
        network: session.network,
        networkName: getNetworkConfig(session.network).name,
        estimatedGas: session.estimatedGas,
        unsignedTx: session.unsignedTx,
        chainId: session.chainId,
        callbackUrl: session.callbackUrl,
        expiresAt: session.expiresAt,
        status: session.status
      });
      
    } catch (e) {
      logger.error({ error: e.message, sessionId: req.params.sessionId }, 'Get session failed');
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/wallet/sign/{sessionId}/submit:
   *   post:
   *     tags: [Wallet]
   *     summary: Submit a signed transaction
   *     description: |
   *       Submits a signed transaction hash after the user has signed with their wallet.
   *       The backend will then monitor the blockchain for transaction confirmation and update the job status.
   *       The session is consumed and cannot be reused after successful submission.
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID from the magic link
   *         example: sess_abc123xyz
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - txHash
   *               - walletAddress
   *             properties:
   *               txHash:
   *                 type: string
   *                 description: Transaction hash from the signed transaction
   *                 example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
   *               walletAddress:
   *                 type: string
   *                 description: Wallet address that signed the transaction
   *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
   *     responses:
   *       200:
   *         description: Transaction submitted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 jobId:
   *                   type: string
   *                   example: ai_wallet_deploy_abc123
   *                 txHash:
   *                   type: string
   *                   example: "0x1234567890abcdef..."
   *                 message:
   *                   type: string
   *                   example: Transaction submitted successfully. Monitoring for confirmation...
   *                 callbackUrl:
   *                   type: string
   *                   nullable: true
   *                   example: https://yourapp.com/dashboard?job=ai_wallet_deploy_abc123&status=submitted
   *                 checkStatusUrl:
   *                   type: string
   *                   example: /api/job/ai_wallet_deploy_abc123
   *       400:
   *         description: Missing txHash or walletAddress
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Missing txHash or walletAddress
   *       404:
   *         description: Session not found, expired, or already used
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Session not found, expired, or already used
   *       500:
   *         description: Internal server error
   */
  router.post('/sign/:sessionId/submit', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { txHash, walletAddress } = req.body;
      
      if (!txHash || !walletAddress) {
        return res.status(400).json({ error: 'Missing txHash or walletAddress' });
      }
      
      const session = signSession(sessionId, txHash, walletAddress);
      if (!session) {
        return res.status(404).json({ error: 'Session not found, expired, or already used' });
      }
      
      logger.info({ 
        sessionId, 
        jobId: session.jobId, 
        txHash, 
        wallet: walletAddress 
      }, 'Transaction submitted for monitoring');
      
      // Update job
      const job = getJob(session.jobId);
      if (job) {
        updateJob(job.id, {
          state: 'running',
          progress: 85,
          step: 'monitoring_tx',
          result: {
            ...job.result,
            txHash,
            deployer: walletAddress
          }
        });
        appendJobLog(job.id, 'info', `Transaction submitted: ${txHash}. Monitoring blockchain...`);
        
        // Monitor transaction in background
        setImmediate(async () => {
          try {
            const txResult = await monitorTransaction(txHash, session.network, 1);
            
            if (txResult.success && txResult.contractAddress) {
              updateJob(job.id, {
                state: 'completed',
                progress: 100,
                result: {
                  network: session.network,
                  deployer: walletAddress,
                  contract: session.contractName,
                  address: txResult.contractAddress,
                  txHash,
                  blockNumber: txResult.blockNumber,
                  gasUsed: txResult.gasUsed,
                  explorerUrl: txResult.explorerUrl,
                  deployMode: 'user-wallet'
                }
              });
              appendJobLog(job.id, 'info', `✅ Deployment successful! Contract: ${txResult.contractAddress}`);
              logger.info({ 
                jobId: job.id, 
                address: txResult.contractAddress, 
                txHash 
              }, 'Wallet deployment completed');
            } else {
              throw new Error('Transaction failed on-chain');
            }
          } catch (e) {
            updateJob(job.id, {
              state: 'failed',
              progress: 100,
              error: e.message
            });
            appendJobLog(job.id, 'error', `Transaction monitoring failed: ${e.message}`);
            logger.error({ jobId: job.id, error: e.message }, 'Transaction monitoring failed');
          }
        });
      }
      
      // Return callback URL for redirect
      const callbackUrl = session.callbackUrl 
        ? `${session.callbackUrl}?job=${session.jobId}&status=submitted`
        : null;
      
      res.json({
        success: true,
        jobId: session.jobId,
        txHash,
        message: 'Transaction submitted successfully. Monitoring for confirmation...',
        callbackUrl,
        checkStatusUrl: `/api/jobs/${session.jobId}`
      });
      
    } catch (e) {
      logger.error({ error: e.message, sessionId: req.params.sessionId }, 'Submit signed tx failed');
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/wallet/sessions/stats:
   *   get:
   *     tags: [Wallet]
   *     summary: Get session statistics
   *     description: |
   *       Returns statistics about wallet deployment sessions for monitoring purposes.
   *       Includes counts of total, active, signed, and expired sessions.
   *       Useful for debugging and monitoring the wallet deployment system health.
   *     responses:
   *       200:
   *         description: Session statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *                   description: Total number of sessions in memory
   *                   example: 5
   *                 active:
   *                   type: integer
   *                   description: Sessions pending signature (not expired)
   *                   example: 2
   *                 signed:
   *                   type: integer
   *                   description: Sessions that have been signed
   *                   example: 2
   *                 expired:
   *                   type: integer
   *                   description: Sessions that have expired (older than 15 minutes)
   *                   example: 1
   *       500:
   *         description: Internal server error
   */
  router.get('/sessions/stats', (req, res) => {
    try {
      const stats = getStats();
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};

/**
 * Process wallet deployment workflow
 * Generates code, compiles, prepares unsigned tx, creates session
 */
async function processWalletDeployment(job, requestData) {
  try {
    const { prompt, network = 'basecamp-testnet', constructorArgs, strictArgs, callbackUrl } = requestData;
    
    updateJob(job.id, { state: 'running', progress: 10, step: 'generate_code' });
    appendJobLog(job.id, 'info', 'Generating smart contract code...');
    
    // Import AI utilities from ai.js
    const aiModule = require('./ai');
    const { callGemini, extractFirstCodeBlock, sanitizeSolidity } = getAIHelpers(aiModule);
    
    // Generate contract code
    const generatePrompt = buildGeneratePrompt(prompt);
    const genResponse = await callGemini({ contents: [{ role: 'user', parts: [{ text: generatePrompt }] }] });
    const codeBlock = extractFirstCodeBlock(genResponse.text);
    
    if (!codeBlock || !codeBlock.code) {
      throw new Error('Failed to extract contract code from AI response');
    }
    
    const solidity = sanitizeSolidity(codeBlock.code);
    const contractName = extractContractName(solidity);
    
    if (!contractName) {
      throw new Error('Could not extract contract name from generated code');
    }
    
    appendJobLog(job.id, 'info', `Contract ${contractName} generated successfully`);
    
    // Create sandbox for compilation
    updateJob(job.id, { progress: 40, step: 'compile' });
    appendJobLog(job.id, 'info', 'Compiling contract...');
    
    const sandboxResult = await compileContract(job.id, contractName, solidity);
    
    if (!sandboxResult.success) {
      throw new Error(`Compilation failed: ${sandboxResult.error}`);
    }
    
    appendJobLog(job.id, 'info', 'Compilation successful');
    
    // Prepare unsigned transaction
    updateJob(job.id, { progress: 70, step: 'prepare_tx' });
    appendJobLog(job.id, 'info', 'Preparing unsigned transaction...');
    
    const artifact = sandboxResult.artifact;
    const finalConstructorArgs = constructorArgs || [];
    
    const txData = await prepareUnsignedDeployTx({
      bytecode: artifact.bytecode,
      abi: artifact.abi,
      constructorArgs: finalConstructorArgs,
      network
    });
    
    appendJobLog(job.id, 'info', `Transaction prepared. Estimated gas: ${txData.estimatedGas} ETH`);
    
    // Create signing session
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = createSession({
      jobId: job.id,
      unsignedTx: txData.unsignedTx,
      contractName,
      network,
      networkName: txData.networkName,
      chainId: txData.chainId,
      estimatedGas: txData.estimatedGas,
      callbackUrl: callbackUrl || `${baseUrl}/dashboard`,
      constructorArgs: finalConstructorArgs,
      code: solidity, // Pass contract code for preview
      metadata: {
        prompt: prompt.substring(0, 200),
        artifact: artifact.contractName
      }
    });
    
    const magicLink = `${baseUrl}/sign/${session.sessionId}`;
    
    // Update job with session info
    updateJob(job.id, {
      state: 'pending_signature',
      progress: 75,
      step: 'awaiting_signature',
      result: {
        contractName,
        network: txData.networkName,
        estimatedGas: txData.estimatedGas,
        sessionId: session.sessionId,
        magicLink,
        expiresAt: session.expiresAt,
        requiresSignature: true,
        code: solidity
      }
    });
    
    appendJobLog(job.id, 'info', `✅ Ready for signing! Open: ${magicLink}`);
    logger.info({ 
      jobId: job.id, 
      sessionId: session.sessionId, 
      magicLink 
    }, 'Signing session created');
    
  } catch (e) {
    logger.error({ jobId: job.id, error: e.message }, 'Wallet deployment processing failed');
    appendJobLog(job.id, 'error', `Failed: ${e.message}`);
    updateJob(job.id, {
      state: 'failed',
      progress: 100,
      error: e.message
    });
  }
}

/**
 * Helper to extract AI utilities from ai.js module
 */
function getAIHelpers(aiModule) {
  // These functions need to be exported from ai.js or we recreate them here
  // For now, we'll import the minimal needed functionality
  
  const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
  const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
  
  async function callGemini({ contents }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    
    const url = `${GEMINI_ENDPOINT}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Gemini API error: ${error}`);
    }
    
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return { raw: data, text };
  }
  
  function extractFirstCodeBlock(md) {
    const match = md.match(/```(solidity|javascript|js)?\n([\s\S]*?)```/i);
    if (!match) return null;
    return { language: (match[1] || '').toLowerCase(), code: match[2] };
  }
  
  function sanitizeSolidity(input) {
    let code = String(input || '').replace(/```/g, '');
    const pIdx = code.toLowerCase().indexOf('pragma solidity');
    if (pIdx !== -1) code = code.slice(pIdx);
    const lastBrace = code.lastIndexOf('}');
    if (lastBrace !== -1) code = code.slice(0, lastBrace + 1);
    return code.trim() + '\n';
  }
  
  return { callGemini, extractFirstCodeBlock, sanitizeSolidity };
}

/**
 * Build AI prompt for contract generation
 */
function buildGeneratePrompt(userPrompt) {
  // Try to extract contract name from prompt
  const nameMatch = userPrompt.match(/(?:named?|called?)\s+([A-Z][A-Za-z0-9]*)/i);
  const suggestedName = nameMatch ? nameMatch[1] : 'MyContract';
  
  return `You are a Solidity smart contract expert. Generate a complete, production-ready smart contract based on this request:

"${userPrompt}"

CRITICAL REQUIREMENTS:
1. The contract MUST be named exactly: ${suggestedName}
2. Use Solidity ^0.8.0 or higher
3. Include: // SPDX-License-Identifier: MIT
4. For ERC20/ERC721/ERC1155: ONLY inherit from OpenZeppelin, do NOT reimplement
   Example: contract ${suggestedName} is ERC20 { ... }
5. Keep it SIMPLE - inherit, don't override unless necessary
6. Do NOT add unnecessary functions or override existing OpenZeppelin functions
7. Constructor should be simple and call parent constructors properly

EXAMPLE for ERC20:
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ${suggestedName} is ERC20 {
    constructor() ERC20("${suggestedName}", "SYM") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
\`\`\`

Return ONLY the Solidity code in a code block, nothing else. No explanations.`;
}

/**
 * Extract contract name from Solidity code
 */
function extractContractName(solidity) {
  const match = solidity.match(/contract\s+(\w+)/);
  return match ? match[1] : null;
}

/**
 * Compile contract in sandbox
 */
async function compileContract(jobId, contractName, solidityCode) {
  return new Promise((resolve) => {
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      const sandboxDir = path.join(projectRoot, 'ai_pipeline_runs', jobId);
      const contractsDir = path.join(sandboxDir, 'contracts');
      const artifactsDir = path.join(sandboxDir, 'artifacts');
      
      // Create directories
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }
      
      // Write contract file
      const unique = `${contractName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const contractFile = path.join(contractsDir, `${unique}.sol`);
      fs.writeFileSync(contractFile, solidityCode, 'utf8');
      
      // Create minimal hardhat config
      const configContent = `
require('@nomicfoundation/hardhat-toolbox');
module.exports = {
  solidity: { version: '0.8.20', settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { sources: './contracts', artifacts: './artifacts' }
};`;
      fs.writeFileSync(path.join(sandboxDir, 'hardhat.config.js'), configContent, 'utf8');
      
      // Compile
      const child = spawn('npx', ['hardhat', 'compile'], { 
        cwd: sandboxDir, 
        env: { ...process.env, HARDHAT_DISABLE_TELEMETRY: '1' } 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: stderr || 'Compilation failed' });
          return;
        }
        
        // Load artifact
        try {
          const artifactPath = path.join(sandboxDir, 'artifacts', 'contracts', `${unique}.sol`, `${contractName}.json`);
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          
          resolve({
            success: true,
            artifact,
            contractFile: unique
          });
        } catch (e) {
          resolve({ success: false, error: `Failed to load artifact: ${e.message}` });
        }
      });
      
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

module.exports.processWalletDeployment = processWalletDeployment;
