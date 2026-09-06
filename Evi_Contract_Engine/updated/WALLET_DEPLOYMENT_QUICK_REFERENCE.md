# Wallet Deployment - Quick Reference

## 🚀 API Endpoints (Production)

**Base URL:** `https://evi-wallet-production.up.railway.app`

---

## 1️⃣ Start Deployment

```bash
curl -X POST https://evi-wallet-production.up.railway.app/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt": "ERC20 token with 1M supply", "network": "basecamp"}'
```

**Response:**
```json
{"jobId": "ai_wallet_deploy_123", "status": "processing"}
```

---

## 2️⃣ Poll for Magic Link

```bash
curl https://evi-wallet-production.up.railway.app/api/job/ai_wallet_deploy_123/status
```

**Response (when ready):**
```json
{
  "data": {
    "state": "awaiting_signature",
    "magicLink": "https://evi-wallet-production.up.railway.app/sign/sess_abc123",
    "sessionId": "sess_abc123"
  }
}
```

---

## 3️⃣ Get Session Details

```bash
curl https://evi-wallet-production.up.railway.app/api/wallet/sign/sess_abc123
```

**Response:**
```json
{
  "contractName": "MyToken",
  "network": "basecamp-testnet",
  "estimatedGas": "0.002",
  "unsignedTx": {
    "to": null,
    "data": "0x608060...",
    "gasLimit": "0x2dc6c0",
    "chainId": 84532
  }
}
```

---

## 4️⃣ Submit Signed Transaction

```bash
curl -X POST https://evi-wallet-production.up.railway.app/api/wallet/sign/sess_abc123/submit \
  -H "Content-Type: application/json" \
  -d '{"txHash": "0x123...", "walletAddress": "0x742..."}'
```

**Response:**
```json
{"success": true, "txHash": "0x123...", "jobId": "ai_wallet_deploy_123"}
```

---

## 5️⃣ Get Final Result

```bash
curl https://evi-wallet-production.up.railway.app/api/job/ai_wallet_deploy_123/status
```

**Response (completed):**
```json
{
  "data": {
    "state": "completed",
    "result": {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
      "explorerUrl": "https://basecamp.cloud.blockscout.com/address/0x742d35..."
    }
  }
}
```

---

## 💻 Minimal Frontend Code

### React Hook

```tsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function useWalletDeploy(prompt: string) {
  const [jobId, setJobId] = useState(null);
  const [magicLink, setMagicLink] = useState(null);
  const [result, setResult] = useState(null);

  // Start deployment
  const deploy = async () => {
    const res = await fetch('/api/wallet/deploy-with-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, network: 'basecamp' })
    });
    const data = await res.json();
    setJobId(data.jobId);
  };

  // Poll for magic link
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/job/${jobId}/status`);
      const data = await res.json();
      if (data.data.state === 'awaiting_signature') {
        setMagicLink(data.data.magicLink);
        clearInterval(poll);
      } else if (data.data.state === 'completed') {
        setResult(data.data.result);
        clearInterval(poll);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId]);

  return { deploy, magicLink, result };
}
```

### Sign with MetaMask

```tsx
async function signTransaction(sessionId: string) {
  // Get session details
  const sessionRes = await fetch(`/api/wallet/sign/${sessionId}`);
  const session = await sessionRes.json();

  // Connect MetaMask
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();

  // Sign transaction
  const tx = await signer.sendTransaction({
    to: session.unsignedTx.to,
    data: session.unsignedTx.data,
    gasLimit: session.unsignedTx.gasLimit
  });

  // Submit to backend
  await fetch(`/api/wallet/sign/${sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txHash: tx.hash,
      walletAddress: await signer.getAddress()
    })
  });

  return tx.hash;
}
```

---

## 🎯 Complete Flow (5 Steps)

```
1. POST /api/wallet/deploy-with-wallet
   → Returns: jobId

2. GET /api/job/:jobId/status (poll)
   → Returns: magicLink, sessionId

3. GET /api/wallet/sign/:sessionId
   → Returns: unsignedTx details

4. Sign with MetaMask + POST /api/wallet/sign/:sessionId/submit
   → Returns: success + txHash

5. GET /api/job/:jobId/status (poll)
   → Returns: contract address + explorerUrl
```

---

## 📊 States

```typescript
type DeploymentState = 
  | 'idle'                 // Before starting
  | 'running'              // AI generating code
  | 'awaiting_signature'   // Magic link ready
  | 'broadcasting'         // Transaction sent
  | 'completed'            // Contract deployed
  | 'failed';              // Error occurred
```

---

## ⏱️ Timeouts

- **Magic Link Expiry:** 15 minutes
- **Poll Interval:** 2 seconds
- **Generation Time:** 10-30 seconds
- **Compilation Time:** 5-10 seconds
- **Blockchain Confirmation:** 10-60 seconds

---

## 🔐 Security

✅ No private keys sent to backend  
✅ User signs in their own wallet  
✅ Session expires after 15 min  
✅ One-time use links  
✅ Network validation  

---

## 🎨 UI Components Needed

1. **Prompt Input** - Textarea for contract description
2. **Network Selector** - Dropdown for chain selection
3. **Progress Bar** - Shows generation/compilation progress
4. **QR Code** - For mobile wallet scanning
5. **Magic Link Button** - Opens signing page
6. **Countdown Timer** - Shows expiry time
7. **Contract Details** - Name, network, gas estimate
8. **Success Screen** - Contract address + explorer link

---

## 🐛 Common Errors

```typescript
const ERRORS = {
  'Session not found or expired': 'Link expired, start new deployment',
  'NETWORK_MISMATCH': 'Switch to correct network in MetaMask',
  'INSUFFICIENT_FUNDS': 'Need more ETH for gas',
  'USER_REJECTED': 'User cancelled in MetaMask'
};
```

---

## 📱 Mobile Support

**For Mobile Wallets:**
1. Show QR code
2. User scans with MetaMask Mobile/Trust Wallet
3. Wallet opens signing page
4. User signs in-app
5. Desktop shows success automatically

---

## 🧪 Test Script

```bash
#!/bin/bash

# 1. Start
JOB_ID=$(curl -s -X POST http://localhost:8080/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt":"ERC20 token","network":"basecamp"}' | jq -r .jobId)

echo "Job ID: $JOB_ID"

# 2. Poll for magic link
while true; do
  STATUS=$(curl -s http://localhost:8080/api/job/$JOB_ID/status | jq -r .data.state)
  echo "Status: $STATUS"
  if [ "$STATUS" = "awaiting_signature" ]; then
    MAGIC_LINK=$(curl -s http://localhost:8080/api/job/$JOB_ID/status | jq -r .data.magicLink)
    echo "Magic Link: $MAGIC_LINK"
    break
  fi
  sleep 2
done

# 3. Get session (extract sessionId from magic link)
SESSION_ID=$(echo $MAGIC_LINK | sed 's/.*\/sign\///')
curl -s http://localhost:8080/api/wallet/sign/$SESSION_ID | jq .

# Now user would sign with MetaMask...
```

---

## 📚 Full Documentation

See [frontend_wallet_deployment.md](./frontend_wallet_deployment.md) for:
- Complete TypeScript types
- React Query hooks
- Full component examples
- Error handling guide
- Testing strategies

---

**Production API:** https://evi-wallet-production.up.railway.app  
**Swagger Docs:** https://evi-wallet-production.up.railway.app/api-docs
