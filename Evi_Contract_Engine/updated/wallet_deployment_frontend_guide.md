# Frontend Integration Guide: Wallet-Based Deployment

## 🎯 Overview

This guide shows how to integrate wallet-based deployment into your frontend with **MINIMAL code**. The backend handles all the complexity - your frontend just needs to:

1. Call one API endpoint
2. Open a magic link
3. Poll for results

That's it! No MetaMask integration, no transaction handling, no complex state management in your main app.

---

## 🚀 Quick Start (3 Lines of Code!)

### **Vanilla JavaScript**

```javascript
// 1. Start deployment
const response = await fetch('http://localhost:3000/api/wallet/deploy-with-wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Create an ERC20 token named MyToken',
    network: 'basecamp-testnet',
    callbackUrl: window.location.href  // Where to return after signing
  })
});

const { jobId, magicLink } = await response.json();

// 2. Open signing page (new tab or redirect)
window.open(magicLink, '_blank');  // Opens in new tab
// OR
window.location.href = magicLink;  // Redirect user

// 3. Poll for completion
const interval = setInterval(async () => {
  const status = await fetch(`http://localhost:3000/api/job/${jobId}`);
  const job = await status.json();
  
  if (job.state === 'completed') {
    clearInterval(interval);
    console.log('Deployed at:', job.result.address);
    alert(`Contract deployed at ${job.result.address}!`);
  } else if (job.state === 'failed') {
    clearInterval(interval);
    console.error('Deployment failed:', job.error);
  }
}, 3000);  // Check every 3 seconds
```

---

## 📦 React Example (Complete Component)

```jsx
import { useState, useEffect } from 'react';

export function WalletDeployButton() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Start deployment
  const handleDeploy = async () => {
    try {
      setStatus('starting');
      
      const response = await fetch('http://localhost:3000/api/wallet/deploy-with-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: document.getElementById('prompt').value,
          network: 'basecamp-testnet',
          callbackUrl: window.location.href
        })
      });
      
      const data = await response.json();
      setJobId(data.jobId);
      setStatus('signing');
      
      // Open signing page in new tab
      window.open(data.magicLink, '_blank');
      
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  // Poll for status when job exists
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'error') return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/job/${jobId}`);
        const job = await response.json();
        
        if (job.state === 'completed') {
          setStatus('completed');
          setResult(job.result);
        } else if (job.state === 'failed') {
          setStatus('error');
          setError(job.error);
        } else {
          setStatus(job.state);  // Update with current state
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [jobId, status]);

  return (
    <div>
      <h2>Deploy Smart Contract</h2>
      
      <textarea 
        id="prompt" 
        placeholder="Describe your smart contract..."
        defaultValue="Create an ERC20 token named MyToken with symbol MTK"
      />
      
      <button onClick={handleDeploy} disabled={status !== 'idle'}>
        🦊 Deploy with My Wallet
      </button>
      
      {status === 'starting' && <p>⏳ Preparing deployment...</p>}
      {status === 'signing' && (
        <p>✅ Ready! Check the new tab to sign the transaction.</p>
      )}
      {status === 'running' && <p>🔄 Transaction submitted. Waiting for confirmation...</p>}
      {status === 'completed' && result && (
        <div>
          <p>✅ Deployed successfully!</p>
          <p><strong>Contract:</strong> {result.contract}</p>
          <p><strong>Address:</strong> {result.address}</p>
          <p><strong>Network:</strong> {result.network}</p>
          <p><strong>Transaction:</strong> <a href={result.explorerUrl} target="_blank">{result.txHash}</a></p>
        </div>
      )}
      {status === 'error' && <p>❌ Error: {error}</p>}
    </div>
  );
}
```

---

## 🔄 How It Works (Backend Does Everything!)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Your App)                                         │
│                                                              │
│  1. User enters prompt: "Create ERC20 token"                │
│  2. Click "Deploy with Wallet"                              │
│  3. Call: POST /api/wallet/deploy-with-wallet               │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Heavy Lifting)                                      │
│                                                              │
│  ✅ Generate smart contract code (AI)                       │
│  ✅ Compile contract (Hardhat)                              │
│  ✅ Prepare unsigned transaction                            │
│  ✅ Create session with transaction data                    │
│  ✅ Generate magic link                                     │
│  ✅ Return: { jobId, magicLink }                            │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Simple Action)                                     │
│                                                              │
│  4. Open magic link in new tab                              │
│     window.open(magicLink, '_blank')                        │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ SIGNING PAGE (Isolated, Simple)                             │
│                                                              │
│  5. Shows contract details                                  │
│  6. User clicks "Sign with MetaMask"                        │
│  7. MetaMask pops up → User signs                           │
│  8. Auto-submits to backend                                 │
│  9. Redirects back to main app                              │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Monitoring)                                         │
│                                                              │
│  ✅ Receives signed transaction                             │
│  ✅ Monitors blockchain                                     │
│  ✅ Updates job status                                      │
│  ✅ Job state → 'completed'                                 │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Polling)                                           │
│                                                              │
│  10. GET /api/job/{jobId} every 3 seconds                   │
│  11. When state === 'completed', show result!               │
│      - Contract address                                     │
│      - Transaction hash                                     │
│      - Explorer link                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 API Endpoints Reference

### **1. Start Deployment**

```http
POST /api/wallet/deploy-with-wallet
Content-Type: application/json

{
  "prompt": "Create an ERC20 token named MyToken",
  "network": "basecamp-testnet",
  "callbackUrl": "https://yourapp.com/dashboard",
  "constructorArgs": [],  // Optional
  "strictArgs": false     // Optional
}
```

**Response:**
```json
{
  "jobId": "ai_wallet_deploy_abc123",
  "status": "processing",
  "message": "Deployment started...",
  "checkStatusUrl": "/api/job/ai_wallet_deploy_abc123"
}
```

---

### **2. Check Job Status**

```http
GET /api/job/{jobId}
```

**Response (In Progress):**
```json
{
  "id": "ai_wallet_deploy_abc123",
  "type": "ai_wallet_deploy",
  "state": "pending_signature",
  "progress": 75,
  "step": "awaiting_signature",
  "result": {
    "contractName": "MyToken",
    "network": "Base Sepolia",
    "estimatedGas": "0.002 ETH",
    "sessionId": "sess_xyz789",
    "magicLink": "http://localhost:3000/sign/sess_xyz789",
    "expiresAt": 1697123456789,
    "requiresSignature": true
  }
}
```

**Response (Completed):**
```json
{
  "id": "ai_wallet_deploy_abc123",
  "type": "ai_wallet_deploy",
  "state": "completed",
  "progress": 100,
  "result": {
    "network": "Base Sepolia",
    "deployer": "0xYourWalletAddress",
    "contract": "MyToken",
    "address": "0xContractAddress",
    "txHash": "0xTransactionHash",
    "blockNumber": 12345,
    "gasUsed": "1234567",
    "explorerUrl": "https://sepolia.basescan.org/tx/0x...",
    "deployMode": "user-wallet"
  }
}
```

---

### **3. Get Session Details** (Used by signing page)

```http
GET /api/wallet/sign/{sessionId}
```

**Response:**
```json
{
  "sessionId": "sess_xyz789",
  "jobId": "ai_wallet_deploy_abc123",
  "contractName": "MyToken",
  "network": "basecamp-testnet",
  "networkName": "Base Sepolia",
  "estimatedGas": "0.002",
  "unsignedTx": {
    "to": null,
    "data": "0x608060...",
    "value": "0",
    "gasLimit": "3000000",
    "chainId": 84532,
    "type": 2
  },
  "chainId": 84532,
  "callbackUrl": "https://yourapp.com/dashboard",
  "expiresAt": 1697123456789,
  "status": "pending_signature"
}
```

---

### **4. Submit Signed Transaction** (Used by signing page)

```http
POST /api/wallet/sign/{sessionId}/submit
Content-Type: application/json

{
  "txHash": "0x...",
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "ai_wallet_deploy_abc123",
  "txHash": "0x...",
  "message": "Transaction submitted successfully...",
  "callbackUrl": "https://yourapp.com/dashboard?job=ai_wallet_deploy_abc123",
  "checkStatusUrl": "/api/job/ai_wallet_deploy_abc123"
}
```

---

## 🎨 UI/UX Best Practices

### **Option 1: New Tab (Recommended)**

✅ User stays on your main page  
✅ Can continue browsing while signing  
✅ No navigation disruption

```javascript
window.open(magicLink, '_blank');
```

### **Option 2: Full Redirect**

✅ Simpler user flow  
✅ Works better on mobile  
⚠️ User leaves your app temporarily

```javascript
window.location.href = magicLink;
```

### **Option 3: Modal/Iframe** (Advanced)

✅ Never leaves your page  
⚠️ More complex implementation  
⚠️ MetaMask may not work in iframe

```javascript
// Show modal with iframe
<iframe src={magicLink} />
```

---

## 📱 Mobile Considerations

For mobile wallets (Trust Wallet, Rainbow, etc.):

```javascript
// Detect mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  // Generate deep link for mobile wallet
  const deepLink = `https://metamask.app.link/dapp/${encodeURIComponent(magicLink)}`;
  window.location.href = deepLink;
} else {
  window.open(magicLink, '_blank');
}
```

---

## 🔍 Job State Machine

Your frontend should handle these states:

```
queued           → Job created, waiting to start
running          → AI generating code / compiling
pending_signature → Ready for user to sign (show magicLink)
awaiting_tx      → Transaction submitted, monitoring blockchain
completed        → ✅ Success! Show contract address
failed           → ❌ Error (show job.error)
```

---

## ⚡ Advanced: Real-Time Updates with SSE

Instead of polling, use Server-Sent Events:

```javascript
const eventSource = new EventSource(`/api/job/${jobId}/stream`);

eventSource.addEventListener('update', (event) => {
  const job = JSON.parse(event.data);
  console.log('Job update:', job.state, job.progress);
  
  if (job.state === 'completed') {
    console.log('Deployed at:', job.result.address);
    eventSource.close();
  }
});

eventSource.addEventListener('error', (error) => {
  console.error('SSE error:', error);
  eventSource.close();
});
```

*(Note: You'll need to implement SSE endpoint on backend)*

---

## 🧪 Testing

### **Test with cURL**

```bash
# 1. Start deployment
curl -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an ERC20 token",
    "network": "basecamp-testnet"
  }'

# Response: {"jobId":"ai_wallet_deploy_...","status":"processing"}

# 2. Check status
curl http://localhost:3000/api/job/ai_wallet_deploy_...

# 3. When state === "pending_signature", open magicLink in browser
# Example: http://localhost:3000/sign/sess_xyz789

# 4. Sign in MetaMask

# 5. Check final status
curl http://localhost:3000/api/job/ai_wallet_deploy_...
```

---

## 🚨 Error Handling

```javascript
try {
  const response = await fetch('/api/wallet/deploy-with-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, network })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const { jobId, magicLink } = await response.json();
  
  // ... rest of code
  
} catch (error) {
  // Handle errors
  if (error.message.includes('GEMINI_API_KEY')) {
    alert('Server configuration error. Please contact support.');
  } else if (error.message.includes('network')) {
    alert('Invalid network. Please try again.');
  } else {
    alert(`Deployment failed: ${error.message}`);
  }
}
```

---

## 🔐 Security Notes

1. **Session Expiry**: Sessions expire after 15 minutes if not used
2. **One-Time Use**: Each session can only be used once
3. **No Private Keys**: Server never sees user's private key
4. **Callback URLs**: Validate callback URLs to prevent open redirects
5. **Rate Limiting**: Implement rate limiting on deployment endpoint

---

## 📊 Comparison: Before vs After

### **Before (Server Wallet)**

```javascript
// Single API call, server handles everything
const response = await fetch('/api/ai/pipeline', {
  method: 'POST',
  body: JSON.stringify({ prompt })
});

// ⚠️ Problem: Server controls deployment, user doesn't own contract
```

### **After (User Wallet)**

```javascript
// Start deployment
const { jobId, magicLink } = await deployWithWallet(prompt);

// Open signing page
window.open(magicLink, '_blank');

// Poll for result
await pollJobUntilComplete(jobId);

// ✅ User owns contract, pays gas, controls everything
```

---

## 🎯 Summary

**What Frontend Needs:**
1. Call `/api/wallet/deploy-with-wallet`
2. Open `magicLink`
3. Poll `/api/job/{jobId}`

**What Backend Handles:**
- AI code generation ✅
- Contract compilation ✅
- Transaction preparation ✅
- Session management ✅
- Blockchain monitoring ✅
- State tracking ✅

**Frontend Complexity:** ~50-80 lines of code  
**Backend Complexity:** ~500+ lines (already implemented!)

---

## 🚀 Next Steps

1. **Try it now**: Use the React example above
2. **Customize**: Add your own UI/styling
3. **Extend**: Add features like QR codes, email notifications
4. **Deploy**: Works same in production

Your users get wallet-controlled deployments with minimal frontend changes! 🎉
