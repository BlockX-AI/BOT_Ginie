# 🦊 User Wallet Deployment - Frontend Developer Guide

> **New Feature:** Users deploy contracts using their own wallets (MetaMask, WalletConnect, etc.)

---

## 📋 Overview

### **System Wallet vs User Wallet**

| Feature | System Wallet (OLD) | User Wallet (NEW) |
|---------|---------------------|-------------------|
| **Gas Payment** | System pays | User pays |
| **Ownership** | System wallet | User wallet |
| **User Action** | None | Sign transaction |
| **Speed** | Instant | ~30 sec |
| **Trust** | Trust platform | Trustless |

---

## 🛠️ API Endpoints

### **1. Create Deployment**
```http
POST /api/wallet/deploy-with-wallet
Content-Type: application/json

{
  "prompt": "Create ERC20 token MyToken",
  "network": "basecamp",
  "constructorArgs": ["MyToken", "MTK", 1000000],
  "callbackUrl": "https://app.com/dashboard"
}
```

**Response:**
```json
{
  "jobId": "ai_wallet_deploy_xxxxx",
  "status": "processing",
  "checkStatusUrl": "/api/jobs/ai_wallet_deploy_xxxxx"
}
```

---

### **2. Poll Job Status**
```http
GET /api/job/{jobId}
```

**Response (Ready for Signing):**
```json
{
  "jobId": "ai_wallet_deploy_xxxxx",
  "state": "pending_signature",
  "progress": 75,
  "result": {
    "contractName": "MyToken",
    "network": "BaseCamp Testnet",
    "estimatedGas": "0.00075306 ETH",
    "magicLink": "http://localhost:3000/sign/sess_xxxxx",
    "sessionId": "sess_xxxxx",
    "expiresAt": "2025-10-22T11:04:01Z",
    "requiresSignature": true,
    "code": "// Solidity source..."
  }
}
```

**Response (Completed):**
```json
{
  "jobId": "ai_wallet_deploy_xxxxx",
  "state": "completed",
  "result": {
    "contractAddress": "0x1234...",
    "txHash": "0xabc...",
    "blockNumber": 12345,
    "deployerAddress": "0xUser...",
    "gasUsed": 753063,
    "gasCost": "0.00075306 ETH"
  }
}
```

---

### **3. Get Signing Session**
```http
GET /api/wallet/sign/{sessionId}
```

**Response:**
```json
{
  "sessionId": "sess_xxxxx",
  "contractName": "MyToken",
  "networkName": "BaseCamp Testnet",
  "chainId": 123420001114,
  "estimatedGas": "0.00075306",
  "unsignedTx": { ... },
  "constructorArgs": ["MyToken", "MTK", 1000000],
  "code": "// Full source...",
  "expiresAt": "2025-10-22T11:04:01Z"
}
```

---

## ⚛️ React Integration

### **Custom Hook**

```jsx
// hooks/useWalletDeployment.js
import { useState, useCallback } from 'react';

export const useWalletDeployment = () => {
  const [state, setState] = useState({
    status: 'idle', // idle, preparing, ready, signing, deploying, success, error
    jobId: null,
    progress: 0,
    magicLink: null,
    contractAddress: null,
    error: null,
    logs: []
  });

  const deploy = useCallback(async (prompt, network) => {
    try {
      setState(s => ({ ...s, status: 'preparing' }));

      // Create job
      const res = await fetch('/api/wallet/deploy-with-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, network })
      });
      const { jobId } = await res.json();
      
      setState(s => ({ ...s, jobId }));

      // Poll until ready
      const job = await pollUntilReady(jobId, (data) => {
        setState(s => ({ ...s, progress: data.progress, logs: data.logs }));
      });

      // Ready for signing
      setState(s => ({ 
        ...s, 
        status: 'ready',
        magicLink: job.result.magicLink 
      }));

      // Wait for user to sign
      setState(s => ({ ...s, status: 'signing' }));
      await waitForSigning(jobId);

      // Wait for deployment
      setState(s => ({ ...s, status: 'deploying' }));
      const result = await waitForCompletion(jobId);

      // Success
      setState(s => ({ 
        ...s, 
        status: 'success',
        contractAddress: result.result.contractAddress
      }));

      return result;
    } catch (error) {
      setState(s => ({ ...s, status: 'error', error: error.message }));
      throw error;
    }
  }, []);

  return { ...state, deploy };
};

// Helper functions
const pollUntilReady = (jobId, onUpdate) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/job/${jobId}`);
      const data = await res.json();
      onUpdate(data);

      if (data.state === 'pending_signature') {
        clearInterval(interval);
        resolve(data);
      }
      if (data.state === 'failed') {
        clearInterval(interval);
        reject(new Error(data.error));
      }
    }, 2000);
  });
};

const waitForSigning = (jobId) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/job/${jobId}`);
      const data = await res.json();

      if (data.state === 'submitted' || data.state === 'deploying') {
        clearInterval(interval);
        resolve(data);
      }
      if (data.state === 'failed') {
        clearInterval(interval);
        reject(new Error('Signing failed'));
      }
    }, 2000);
  });
};

const waitForCompletion = (jobId) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/job/${jobId}`);
      const data = await res.json();

      if (data.state === 'completed') {
        clearInterval(interval);
        resolve(data);
      }
      if (data.state === 'failed') {
        clearInterval(interval);
        reject(new Error(data.error));
      }
    }, 2000);
  });
};
```

---

### **Component Example**

```jsx
// components/WalletDeploy.jsx
import React, { useState } from 'react';
import { useWalletDeployment } from '../hooks/useWalletDeployment';
import QRCode from 'qrcode.react';

export const WalletDeploy = () => {
  const [prompt, setPrompt] = useState('');
  const [network, setNetwork] = useState('basecamp');
  const { status, progress, magicLink, contractAddress, deploy } = useWalletDeployment();

  const handleDeploy = () => deploy(prompt, network);

  return (
    <div className="wallet-deploy">
      <h2>🦊 Deploy with Your Wallet</h2>

      {/* Input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your contract..."
        rows={4}
      />
      <select value={network} onChange={(e) => setNetwork(e.target.value)}>
        <option value="basecamp">BaseCamp</option>
        <option value="base-sepolia">Base Sepolia</option>
      </select>
      <button onClick={handleDeploy} disabled={status !== 'idle'}>
        Deploy
      </button>

      {/* Status */}
      {status === 'preparing' && (
        <div>
          🔄 Preparing... {progress}%
          <progress value={progress} max={100} />
        </div>
      )}

      {status === 'ready' && (
        <div>
          <h3>✅ Ready to Sign!</h3>
          <a href={magicLink} target="_blank" rel="noopener">
            <button>Open Signing Page →</button>
          </a>
          <QRCode value={magicLink} size={200} />
          <p>Or scan with mobile wallet</p>
        </div>
      )}

      {status === 'signing' && (
        <div>⏳ Waiting for signature...</div>
      )}

      {status === 'deploying' && (
        <div>🚀 Deploying to blockchain...</div>
      )}

      {status === 'success' && (
        <div>
          <h3>🎉 Success!</h3>
          <p>Contract: {contractAddress}</p>
          <button onClick={() => navigator.clipboard.writeText(contractAddress)}>
            Copy Address
          </button>
        </div>
      )}

      {status === 'error' && (
        <div>❌ Deployment failed</div>
      )}
    </div>
  );
};
```

---

## 🎨 UI Components

### **Progress Bar**

```jsx
export const DeployProgress = ({ progress, step, logs }) => (
  <div className="progress">
    <div className="progress-bar">
      <div style={{ width: `${progress}%` }} />
    </div>
    <p>{progress}% - {step}</p>
    <div className="logs">
      {logs.slice(-3).map((log, i) => (
        <div key={i}>{log.message}</div>
      ))}
    </div>
  </div>
);
```

### **Signing Modal**

```jsx
export const SigningModal = ({ magicLink, onClose }) => (
  <div className="modal">
    <h2>🦊 Sign Transaction</h2>
    <a href={magicLink} target="_blank">Open Signing Page →</a>
    <QRCode value={magicLink} />
    <button onClick={onClose}>Cancel</button>
  </div>
);
```

---

## ⚠️ Error Handling

```javascript
const handleError = (error) => {
  const errors = {
    4001: 'User cancelled transaction',
    '-32000': 'Insufficient funds for gas',
    'TIMEOUT': 'Request timed out',
    'EXPIRED': 'Session expired (1 hour)'
  };

  return errors[error.code] || error.message || 'Unknown error';
};

// Usage
try {
  await deploy(prompt, network);
} catch (error) {
  alert(handleError(error));
}
```

---

## 🧪 Testing

### **cURL Commands**

```bash
# Create deployment
curl -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create ERC20","network":"basecamp"}'

# Get status
curl http://localhost:3000/api/job/ai_wallet_deploy_xxxxx

# Get magic link
curl -s http://localhost:3000/api/job/ai_wallet_deploy_xxxxx | \
  grep magicLink
```

---

## 📱 Mobile Support

### **QR Code**

```jsx
import QRCode from 'qrcode.react';

<QRCode 
  value={magicLink} 
  size={256}
  level="H"
/>
```

### **Deep Link for MetaMask**

```javascript
const openInMetaMask = (magicLink) => {
  const url = magicLink.replace('https://', '');
  window.location.href = `https://metamask.app.link/dapp/${url}`;
};
```

---

## 🔐 Security

- ✅ Sessions expire after 1 hour
- ✅ Magic links are single-use
- ✅ All signing happens in user's wallet
- ✅ No private keys ever sent to server
- ✅ Validate session IDs on backend

---

## 📊 Flow Diagram

```
User Input → Create Job → Poll Status → Show Magic Link
                ↓              ↓
          [Generate]     [Progress]
          [Compile]      [Updates]
          [PrepTX]           ↓
                        [Ready!]
                            ↓
                      User Signs
                            ↓
                  Submit TX → Monitor → Success!
```

---

## 🚀 Quick Start

1. **Install dependencies:**
```bash
npm install qrcode.react
```

2. **Copy the hook:**
Copy `useWalletDeployment` hook

3. **Add component:**
Use `WalletDeploy` component

4. **Test:**
```bash
curl -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -d '{"prompt":"Create ERC20","network":"basecamp"}'
```

---

## 📚 Examples

- **Basic:** Single contract deployment
- **Advanced:** Multi-contract with dependencies
- **Game:** NFT game with multiple tokens
- **DeFi:** Token + Staking + DAO

See `examples/` directory for full code.

---

## 🔗 Resources

- **API Docs:** `/api-docs`
- **Signing Page:** `/sign/:sessionId`
- **Backend Code:** `api/routes/wallet-deploy.js`
- **Sessions:** `api/lib/sessions.js`

---

**Happy Building! 🚀**
