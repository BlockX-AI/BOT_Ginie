# Frontend Integration Guide: Wallet-Based Deployment

## Overview

The Wallet-Based Deployment feature allows users to deploy AI-generated smart contracts using their own wallets (MetaMask, WalletConnect, etc.) instead of trusting the backend with private keys. The backend generates and compiles the contract, creates an unsigned transaction, and the user signs it with their wallet.

**Key Benefits:**
- ✅ No private key sharing
- ✅ User controls deployment
- ✅ Full transaction transparency
- ✅ Enterprise-ready security
- ✅ Multi-wallet support

---

## API Endpoints

### Base URL
```
Production: https://evi-wallet-production.up.railway.app
Development: http://localhost:8080
```

---

## 1. Start Wallet Deployment

**Endpoint:** `POST /api/wallet/deploy-with-wallet`

Initiates AI contract generation and creates unsigned transaction for user to sign.

### Request

```bash
curl -X POST https://evi-wallet-production.up.railway.app/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ERC20 token with 1 million supply and burn function",
    "network": "basecamp",
    "callbackUrl": "https://yourapp.com/dashboard",
    "constructorArgs": [],
    "strictArgs": false
  }'
```

### Request Body

```typescript
interface WalletDeployRequest {
  prompt: string;              // Natural language description
  network?: string;            // 'basecamp' | 'basecamp-testnet' | 'base-sepolia' etc.
  callbackUrl?: string;        // Redirect after signing
  constructorArgs?: string[];  // Constructor arguments (if known)
  strictArgs?: boolean;        // Fail if args don't match
}
```

### Response

```json
{
  "jobId": "ai_wallet_deploy_1733421234567",
  "status": "processing",
  "message": "Deployment started. Generating contract code and preparing transaction...",
  "checkStatusUrl": "/api/jobs/ai_wallet_deploy_1733421234567"
}
```

### Response Schema

```typescript
interface WalletDeployResponse {
  jobId: string;
  status: 'processing' | 'failed';
  message: string;
  checkStatusUrl: string;
  error?: string;  // Only present if failed immediately
}
```

---

## 2. Poll Job Status (Get Magic Link)

**Endpoint:** `GET /api/job/:jobId/status`

Poll this endpoint until `state` becomes `awaiting_signature` to get the magic link.

### Request

```bash
curl https://evi-wallet-production.up.railway.app/api/job/ai_wallet_deploy_1733421234567/status
```

### Response (Processing)

```json
{
  "ok": true,
  "data": {
    "id": "ai_wallet_deploy_1733421234567",
    "kind": "ai_wallet_deploy",
    "state": "running",
    "progress": 45,
    "result": null,
    "error": null,
    "logs": [
      {"level": "info", "message": "AI generation complete", "timestamp": 1733421240000},
      {"level": "info", "message": "Compiling contract...", "timestamp": 1733421245000}
    ]
  }
}
```

### Response (Ready for Signature)

```json
{
  "ok": true,
  "data": {
    "id": "ai_wallet_deploy_1733421234567",
    "kind": "ai_wallet_deploy",
    "state": "awaiting_signature",
    "progress": 75,
    "magicLink": "https://evi-wallet-production.up.railway.app/sign/sess_abc123xyz",
    "sessionId": "sess_abc123xyz",
    "result": null,
    "error": null
  }
}
```

### Response (Completed)

```json
{
  "ok": true,
  "data": {
    "id": "ai_wallet_deploy_1733421234567",
    "kind": "ai_wallet_deploy",
    "state": "completed",
    "progress": 100,
    "result": {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
      "network": "basecamp",
      "explorerUrl": "https://basecamp.cloud.blockscout.com/address/0x742d35...",
      "txHash": "0x1234567890abcdef...",
      "deployedBy": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E"
    },
    "error": null
  }
}
```

### Job State Schema

```typescript
interface JobStatus {
  ok: boolean;
  data: {
    id: string;
    kind: 'ai_wallet_deploy';
    state: 'idle' | 'running' | 'awaiting_signature' | 'broadcasting' | 'completed' | 'failed';
    progress: number;  // 0-100
    magicLink?: string;  // Present when state = 'awaiting_signature'
    sessionId?: string;  // Present when state = 'awaiting_signature'
    result?: {
      address: string;
      network: string;
      explorerUrl: string;
      txHash: string;
      deployedBy: string;
    };
    error?: string;
    logs?: Array<{
      level: 'info' | 'warn' | 'error';
      message: string;
      timestamp: number;
    }>;
  };
}
```

---

## 3. Get Session Details (Signing Page)

**Endpoint:** `GET /api/wallet/sign/:sessionId`

Retrieves unsigned transaction details for user to review and sign.

### Request

```bash
curl https://evi-wallet-production.up.railway.app/api/wallet/sign/sess_abc123xyz
```

### Response

```json
{
  "sessionId": "sess_abc123xyz",
  "jobId": "ai_wallet_deploy_1733421234567",
  "contractName": "MyToken",
  "network": "basecamp-testnet",
  "networkName": "Base Sepolia",
  "estimatedGas": "0.002",
  "unsignedTx": {
    "to": null,
    "data": "0x608060405234801561001057600080fd5b50...",
    "value": "0x0",
    "gasLimit": "0x2dc6c0",
    "chainId": 84532,
    "type": 2,
    "maxFeePerGas": "0x3b9aca00",
    "maxPriorityFeePerGas": "0x59682f00"
  },
  "chainId": 84532,
  "callbackUrl": "https://yourapp.com/dashboard",
  "expiresAt": 1733422134567,
  "status": "pending_signature"
}
```

### Session Schema

```typescript
interface SessionDetails {
  sessionId: string;
  jobId: string;
  contractName: string;
  network: string;
  networkName: string;
  estimatedGas: string;  // In ETH
  unsignedTx: {
    to: string | null;
    data: string;  // Hex-encoded bytecode
    value: string;  // Hex-encoded wei amount
    gasLimit: string;  // Hex-encoded
    chainId: number;
    type: number;  // EIP-1559 = 2
    maxFeePerGas: string;  // Hex-encoded
    maxPriorityFeePerGas: string;  // Hex-encoded
  };
  chainId: number;
  callbackUrl?: string;
  expiresAt: number;  // Unix timestamp
  status: 'pending_signature' | 'signed' | 'expired' | 'failed';
}
```

### Error Response (Session Expired)

```json
{
  "error": "Session not found or expired"
}
```

---

## 4. Submit Signed Transaction

**Endpoint:** `POST /api/wallet/sign/:sessionId/submit`

Submits the transaction hash after user signs with their wallet.

### Request

```bash
curl -X POST https://evi-wallet-production.up.railway.app/api/wallet/sign/sess_abc123xyz/submit \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
  }'
```

### Request Body

```typescript
interface SubmitSignatureRequest {
  txHash: string;       // Transaction hash from wallet
  walletAddress: string; // Signer's wallet address
}
```

### Response

```json
{
  "success": true,
  "message": "Transaction submitted successfully. Monitoring blockchain for confirmation...",
  "txHash": "0x1234567890abcdef...",
  "jobId": "ai_wallet_deploy_1733421234567",
  "checkStatusUrl": "/api/job/ai_wallet_deploy_1733421234567/status"
}
```

### Response Schema

```typescript
interface SubmitSignatureResponse {
  success: boolean;
  message: string;
  txHash: string;
  jobId: string;
  checkStatusUrl: string;
  error?: string;
}
```

---

## 5. Get Deployment Statistics

**Endpoint:** `GET /api/wallet/sessions/stats`

Retrieves deployment statistics for monitoring and analytics.

### Request

```bash
curl https://evi-wallet-production.up.railway.app/api/wallet/sessions/stats
```

### Response

```json
{
  "totalSessions": 1247,
  "activeSessions": 23,
  "expiredSessions": 142,
  "completedDeployments": 1082,
  "failedDeployments": 165,
  "successRate": 86.8,
  "avgTimeToSign": "2m 34s",
  "avgDeploymentTime": "1m 12s",
  "byNetwork": {
    "basecamp": 856,
    "basecamp-testnet": 391
  },
  "recentDeployments": [
    {
      "sessionId": "sess_xyz789",
      "contractName": "MyToken",
      "network": "basecamp",
      "timestamp": 1733421234567,
      "status": "completed"
    }
  ]
}
```

---

## Frontend Service Implementation

### Axios Service Wrapper

```typescript
// services/walletDeployService.ts
import axios from 'axios';

const API_BASE = 'https://evi-wallet-production.up.railway.app';

export const walletDeployService = {
  /**
   * Start wallet-based deployment
   */
  async startDeployment(params: {
    prompt: string;
    network?: string;
    callbackUrl?: string;
  }) {
    const response = await axios.post(`${API_BASE}/api/wallet/deploy-with-wallet`, {
      prompt: params.prompt,
      network: params.network || 'basecamp',
      callbackUrl: params.callbackUrl,
      constructorArgs: [],
      strictArgs: false
    });
    return response.data;
  },

  /**
   * Poll job status to get magic link
   */
  async getJobStatus(jobId: string) {
    const response = await axios.get(`${API_BASE}/api/job/${jobId}/status`);
    return response.data;
  },

  /**
   * Get session details for signing page
   */
  async getSessionDetails(sessionId: string) {
    const response = await axios.get(`${API_BASE}/api/wallet/sign/${sessionId}`);
    return response.data;
  },

  /**
   * Submit signed transaction
   */
  async submitSignature(sessionId: string, txHash: string, walletAddress: string) {
    const response = await axios.post(
      `${API_BASE}/api/wallet/sign/${sessionId}/submit`,
      { txHash, walletAddress }
    );
    return response.data;
  },

  /**
   * Get deployment statistics
   */
  async getStats() {
    const response = await axios.get(`${API_BASE}/api/wallet/sessions/stats`);
    return response.data;
  }
};
```

---

## React Query Hooks

```typescript
// hooks/useWalletDeploy.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { walletDeployService } from '@/services/walletDeployService';

/**
 * Start deployment mutation
 */
export function useStartDeployment() {
  return useMutation({
    mutationFn: walletDeployService.startDeployment,
    onSuccess: (data) => {
      console.log('Deployment started:', data.jobId);
    },
    onError: (error) => {
      console.error('Deployment failed:', error);
    }
  });
}

/**
 * Poll job status for magic link
 */
export function useJobStatus(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => walletDeployService.getJobStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (data) => {
      // Stop polling when awaiting signature or completed/failed
      const state = data?.data?.state;
      if (state === 'awaiting_signature' || 
          state === 'completed' || 
          state === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    }
  });
}

/**
 * Get session details for signing
 */
export function useSessionDetails(sessionId: string | null) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => walletDeployService.getSessionDetails(sessionId!),
    enabled: !!sessionId,
    retry: 1
  });
}

/**
 * Submit signature mutation
 */
export function useSubmitSignature() {
  return useMutation({
    mutationFn: ({ 
      sessionId, 
      txHash, 
      walletAddress 
    }: { 
      sessionId: string; 
      txHash: string; 
      walletAddress: string;
    }) => walletDeployService.submitSignature(sessionId, txHash, walletAddress),
    onSuccess: (data) => {
      console.log('Signature submitted:', data.txHash);
    }
  });
}

/**
 * Get deployment stats
 */
export function useDeploymentStats() {
  return useQuery({
    queryKey: ['deploymentStats'],
    queryFn: walletDeployService.getStats,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}
```

---

## Complete React Component Example

```tsx
// components/WalletDeployment.tsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QRCode from 'qrcode.react';
import { useStartDeployment, useJobStatus, useSessionDetails, useSubmitSignature } from '@/hooks/useWalletDeploy';

export function WalletDeployment() {
  const [prompt, setPrompt] = useState('');
  const [network, setNetwork] = useState('basecamp');
  const [jobId, setJobId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  
  // Mutations and queries
  const startDeployment = useStartDeployment();
  const jobStatus = useJobStatus(jobId, !!jobId);
  const submitSignature = useSubmitSignature();

  // Handle deployment start
  const handleDeploy = async () => {
    try {
      const result = await startDeployment.mutateAsync({
        prompt,
        network,
        callbackUrl: window.location.origin + '/dashboard'
      });
      setJobId(result.jobId);
    } catch (error) {
      console.error('Failed to start deployment:', error);
    }
  };

  // Monitor job status for magic link
  useEffect(() => {
    if (jobStatus.data?.data?.state === 'awaiting_signature') {
      setMagicLink(jobStatus.data.data.magicLink);
      setSessionId(jobStatus.data.data.sessionId);
    }
  }, [jobStatus.data]);

  // Render states
  if (jobStatus.data?.data?.state === 'completed') {
    return (
      <SuccessState 
        address={jobStatus.data.data.result.address}
        explorerUrl={jobStatus.data.data.result.explorerUrl}
      />
    );
  }

  if (magicLink) {
    return (
      <MagicLinkDisplay 
        magicLink={magicLink}
        sessionId={sessionId!}
      />
    );
  }

  if (jobId) {
    return (
      <ProcessingState 
        progress={jobStatus.data?.data?.progress || 0}
        logs={jobStatus.data?.data?.logs || []}
      />
    );
  }

  return (
    <div className="wallet-deployment">
      <h2>Deploy with Your Wallet</h2>
      
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your smart contract..."
        rows={4}
        className="prompt-input"
      />
      
      <select 
        value={network}
        onChange={(e) => setNetwork(e.target.value)}
        className="network-select"
      >
        <option value="basecamp">Base Camp (Mainnet)</option>
        <option value="basecamp-testnet">Base Sepolia (Testnet)</option>
        <option value="boba-sepolia">Boba Sepolia</option>
      </select>
      
      <button 
        onClick={handleDeploy}
        disabled={!prompt.trim() || startDeployment.isPending}
        className="deploy-button"
      >
        {startDeployment.isPending ? 'Starting...' : 'Deploy with My Wallet'}
      </button>
    </div>
  );
}

// Processing state component
function ProcessingState({ progress, logs }: { progress: number; logs: any[] }) {
  return (
    <div className="processing-state">
      <div className="spinner" />
      <h3>Generating Your Contract</h3>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p>{progress}% Complete</p>
      
      <div className="logs">
        {logs.slice(-5).map((log, i) => (
          <div key={i} className={`log log-${log.level}`}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// Magic link display component
function MagicLinkDisplay({ magicLink, sessionId }: { magicLink: string; sessionId: string }) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="magic-link-display">
      <h3>Ready to Sign!</h3>
      
      <div className="qr-code">
        <QRCode value={magicLink} size={256} level="H" />
      </div>
      
      <p className="instructions">
        Scan with mobile wallet or click below:
      </p>
      
      <a 
        href={magicLink}
        target="_blank"
        rel="noopener noreferrer"
        className="sign-button"
      >
        Open Signing Page
      </a>
      
      <div className="timer">
        Expires in: {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
      
      <div className="supported-wallets">
        <p>Supported wallets:</p>
        <ul>
          <li>MetaMask</li>
          <li>WalletConnect</li>
          <li>Coinbase Wallet</li>
          <li>Rainbow</li>
        </ul>
      </div>
    </div>
  );
}

// Success state component
function SuccessState({ address, explorerUrl }: { address: string; explorerUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="success-state">
      <div className="success-icon">✅</div>
      <h2>Contract Deployed Successfully!</h2>
      
      <div className="contract-address">
        <code>{address}</code>
        <button onClick={copyAddress}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      <a 
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="explorer-link"
      >
        View on Block Explorer →
      </a>
      
      <div className="next-steps">
        <h4>Next Steps:</h4>
        <ul>
          <li>Verify your contract on the explorer</li>
          <li>Run security audit</li>
          <li>Check compliance with token standards</li>
          <li>Start interacting with your contract</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Signing Page Component

```tsx
// pages/sign/[sessionId].tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ethers } from 'ethers';
import { useSessionDetails, useSubmitSignature } from '@/hooks/useWalletDeploy';

export default function SigningPage() {
  const router = useRouter();
  const { sessionId } = router.query as { sessionId: string };
  
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { data: session, isLoading } = useSessionDetails(sessionId);
  const submitSignature = useSubmitSignature();

  const handleSign = async () => {
    if (!session) return;
    
    try {
      setSigning(true);
      setError(null);
      
      // Connect to MetaMask
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      
      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== session.chainId) {
        throw new Error(`Please switch to ${session.networkName}`);
      }
      
      // Sign transaction
      const txResponse = await signer.sendTransaction({
        to: session.unsignedTx.to,
        data: session.unsignedTx.data,
        value: session.unsignedTx.value,
        gasLimit: session.unsignedTx.gasLimit
      });
      
      // Submit to backend
      await submitSignature.mutateAsync({
        sessionId,
        txHash: txResponse.hash,
        walletAddress
      });
      
      // Redirect to callback URL or dashboard
      if (session.callbackUrl) {
        window.location.href = session.callbackUrl;
      } else {
        router.push(`/deployment/${session.jobId}`);
      }
      
    } catch (err: any) {
      console.error('Signing error:', err);
      setError(err.message || 'Failed to sign transaction');
      setSigning(false);
    }
  };

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (!session) {
    return <div>Session not found or expired</div>;
  }

  return (
    <div className="signing-page">
      <h1>Review Transaction</h1>
      
      <div className="contract-details">
        <h3>Contract Details</h3>
        <div className="detail-row">
          <span>Contract Name:</span>
          <strong>{session.contractName}</strong>
        </div>
        <div className="detail-row">
          <span>Network:</span>
          <strong>{session.networkName}</strong>
        </div>
        <div className="detail-row">
          <span>Estimated Gas:</span>
          <strong>{session.estimatedGas} ETH</strong>
        </div>
      </div>
      
      <div className="transaction-data">
        <h3>Transaction Data</h3>
        <details>
          <summary>View bytecode ({session.unsignedTx.data.length / 2 - 1} bytes)</summary>
          <code className="bytecode">
            {session.unsignedTx.data}
          </code>
        </details>
      </div>
      
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      <button 
        onClick={handleSign}
        disabled={signing}
        className="sign-button"
      >
        {signing ? 'Signing...' : 'Connect Wallet & Sign'}
      </button>
      
      <div className="security-notice">
        <p>🔒 Your private keys never leave your wallet</p>
        <p>Review all details before signing</p>
      </div>
    </div>
  );
}
```

---

## Error Handling

```typescript
// utils/walletDeployErrors.ts

export const WALLET_DEPLOY_ERRORS = {
  PROMPT_REQUIRED: 'Please describe what contract you want to deploy',
  NETWORK_MISMATCH: 'Please switch your wallet to the correct network',
  SESSION_EXPIRED: 'This signing link has expired. Please start a new deployment.',
  SESSION_NOT_FOUND: 'Invalid signing link',
  USER_REJECTED: 'You cancelled the transaction',
  INSUFFICIENT_FUNDS: 'Insufficient funds for gas fees',
  METAMASK_NOT_INSTALLED: 'Please install MetaMask to continue',
  COMPILATION_FAILED: 'Contract compilation failed. Try a different prompt.',
  GENERATION_FAILED: 'AI generation failed. Please try again.',
  TX_BROADCAST_FAILED: 'Failed to broadcast transaction to blockchain',
  INVALID_TX_HASH: 'Invalid transaction hash provided'
};

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return WALLET_DEPLOY_ERRORS[error as keyof typeof WALLET_DEPLOY_ERRORS] || error;
  }
  
  if (error?.code === 4001) {
    return WALLET_DEPLOY_ERRORS.USER_REJECTED;
  }
  
  if (error?.code === 'INSUFFICIENT_FUNDS') {
    return WALLET_DEPLOY_ERRORS.INSUFFICIENT_FUNDS;
  }
  
  return error?.message || 'An unexpected error occurred';
}
```

---

## Testing Guide

### Manual Testing Flow

```bash
# 1. Start deployment
curl -X POST http://localhost:8080/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Simple ERC20 token", "network": "basecamp"}'

# Response: {"jobId": "ai_wallet_deploy_123", ...}

# 2. Poll for magic link (repeat until state = awaiting_signature)
curl http://localhost:8080/api/job/ai_wallet_deploy_123/status

# Response: {"data": {"state": "awaiting_signature", "magicLink": "...", ...}}

# 3. Get session details
curl http://localhost:8080/api/wallet/sign/sess_abc123

# Response: {"unsignedTx": {...}, ...}

# 4. Submit signature (after signing with wallet)
curl -X POST http://localhost:8080/api/wallet/sign/sess_abc123/submit \
  -H "Content-Type: application/json" \
  -d '{"txHash": "0x123...", "walletAddress": "0x742..."}'

# Response: {"success": true, "txHash": "0x123...", ...}

# 5. Poll job status for final result
curl http://localhost:8080/api/job/ai_wallet_deploy_123/status

# Response: {"data": {"state": "completed", "result": {"address": "0x..."}, ...}}
```

---

## UI/UX Best Practices

### Loading States
- Show progress percentage during generation
- Display recent logs for transparency
- Use skeleton loaders for data fetching

### Magic Link Display
- Show QR code for mobile users
- Display countdown timer (15 minutes)
- List supported wallets
- Provide both QR and clickable link

### Signing Page
- Show contract name prominently
- Display estimated gas cost upfront
- Allow viewing full bytecode
- Show network name and chain ID
- Provide "Cancel" option

### Error Handling
- User-friendly error messages
- Suggest solutions (e.g., "Switch to Base Sepolia")
- Show support link for complex issues
- Allow retry without restarting

### Success State
- Show contract address with copy button
- Provide explorer link
- Suggest next steps (verify, audit)
- Show callback URL option

---

## Security Considerations

1. **Session Expiry:** All sessions expire after 15 minutes
2. **One-time Use:** Sessions can only be used once
3. **Network Validation:** Frontend should verify correct network before signing
4. **Gas Estimation:** Show estimated cost to prevent surprise fees
5. **Bytecode Disclosure:** Allow users to inspect bytecode before signing
6. **HTTPS Only:** Always use HTTPS in production
7. **Error Logging:** Don't expose sensitive data in error messages

---

## Troubleshooting

### Common Issues

**Issue:** "Session not found or expired"
- **Cause:** Link used after 15 minutes or already used
- **Solution:** Start new deployment

**Issue:** "Network mismatch"
- **Cause:** Wallet on different network than deployment
- **Solution:** Prompt user to switch network in MetaMask

**Issue:** "Insufficient funds"
- **Cause:** Not enough ETH for gas
- **Solution:** Show exact amount needed

**Issue:** "User rejected transaction"
- **Cause:** User clicked "Reject" in MetaMask
- **Solution:** Allow retry without restarting generation

---

## Next Steps

1. Implement wallet connection (MetaMask, WalletConnect)
2. Add network switching helper
3. Create QR code generation
4. Build countdown timer component
5. Add analytics tracking for each step
6. Implement mobile-responsive design
7. Add internationalization (i18n)
8. Create error boundary components

---

## Related Documentation

- [Audit & Compliance APIs](./frontend_audit_compliance_verify.md)
- [Backend API Documentation](../API_DOCUMENTATION_SUMMARY.md)
- [Wallet Integration Best Practices](https://docs.ethers.org/v6/)

---

**Last Updated:** December 5, 2025
