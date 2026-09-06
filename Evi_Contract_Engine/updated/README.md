# AcademicChain Frontend Documentation

Complete integration guides for all AcademicChain API features.

---

## 📚 Documentation Index

### Core Features

#### 1. **Wallet-Based Deployment** 🔥 NEW
Deploy smart contracts using user's own wallet (MetaMask, WalletConnect).

- **[Complete Guide](./frontend_wallet_deployment.md)** - Full integration with code examples
- **[Quick Reference](./WALLET_DEPLOYMENT_QUICK_REFERENCE.md)** - API endpoints & minimal code
- **[Comparison Guide](./DEPLOYMENT_COMPARISON.md)** - Backend vs User wallet deployment

**Key Endpoints:**
- `POST /api/wallet/deploy-with-wallet` - Start deployment
- `GET /api/job/:id/status` - Poll for magic link
- `GET /api/wallet/sign/:sessionId` - Get transaction details
- `POST /api/wallet/sign/:sessionId/submit` - Submit signature

---

#### 2. **Security Auditing**
AI-powered smart contract security analysis.

- **[Audit & Compliance Guide](./frontend_audit_compliance_verify.md)** - Complete integration

**Key Endpoints:**
- `POST /api/audit/analyze` - Audit Solidity source code
- `POST /api/audit/byJob` - Audit deployed contract by job ID
- `POST /api/audit/orchestrate` - Full audit workflow with optional fix/deploy

---

#### 3. **Compliance Checking**
Validate contracts against ERC20/721/1155 standards.

- **[Audit & Compliance Guide](./frontend_audit_compliance_verify.md)** - Complete integration

**Key Endpoints:**
- `POST /api/compliance/analyze` - Check source code compliance
- `POST /api/compliance/byJob` - Check deployed contract compliance
- `POST /api/compliance/orchestrate` - Full compliance workflow

---

#### 4. **Contract Verification**
Verify deployed contracts on block explorers (Blockscout, Etherscan).

- **[Verify Guide](./frontend_audit_compliance_verify.md)** - Complete integration

**Key Endpoints:**
- `POST /api/verify/byAddress` - Verify any contract address
- `POST /api/verify/byJob` - Verify by job ID
- `GET /api/verify/status` - Check verification status

---

#### 5. **AI Pipeline (Backend Wallet)**
Traditional deployment where backend signs transactions.

- **[API Documentation](../API_DOCUMENTATION_SUMMARY.md)** - Backend API reference

**Key Endpoint:**
- `POST /api/ai/pipeline` - Generate, compile, and deploy

---

## 🎯 Quick Start

### Install Dependencies

```bash
npm install axios ethers qrcode.react @tanstack/react-query
```

### Basic Setup

```tsx
// 1. Import services
import { walletDeployService } from '@/services/walletDeployService';
import { auditService } from '@/services/auditService';
import { ethers } from 'ethers';

// 2. Deploy with user wallet
const { jobId } = await walletDeployService.startDeployment({
  prompt: "ERC20 token with 1M supply",
  network: "basecamp"
});

// 3. Wait for magic link
const status = await walletDeployService.getJobStatus(jobId);
const magicLink = status.data.magicLink;

// 4. User signs transaction
// (handled in separate signing page)

// 5. Get result
const result = await walletDeployService.getJobStatus(jobId);
console.log('Deployed at:', result.data.result.address);
```

---

## 🔄 Complete Workflow Examples

### Example 1: Deploy → Verify → Audit

```tsx
import { useState } from 'react';
import { walletDeployService, verifyService, auditService } from '@/services';

function CompleteDeployment() {
  const [address, setAddress] = useState(null);
  
  async function deployVerifyAudit(prompt: string) {
    // 1. Deploy with user wallet
    const { jobId } = await walletDeployService.startDeployment({ prompt });
    
    // 2. Wait for deployment
    const deployment = await pollUntilComplete(jobId);
    setAddress(deployment.address);
    
    // 3. Verify on explorer
    await verifyService.verifyByJob({ jobId, network: 'basecamp' });
    
    // 4. Run security audit
    const audit = await auditService.auditByJob({ jobId });
    
    console.log('Audit score:', audit.score);
    return { address, audit };
  }
  
  return (
    <button onClick={() => deployVerifyAudit("ERC20 token")}>
      Deploy, Verify & Audit
    </button>
  );
}
```

### Example 2: Audit Existing Contract

```tsx
import { auditService, complianceService } from '@/services';

async function auditExistingContract(sourceCode: string) {
  // 1. Run security audit
  const audit = await auditService.auditSource(sourceCode, 'MyToken.sol');
  
  // 2. Check ERC20 compliance
  const compliance = await complianceService.checkCompliance({
    code: sourceCode,
    profile: 'token',
    strict: true
  });
  
  return {
    securityScore: audit.score,
    isCompliant: compliance.isCompliant,
    criticalIssues: audit.findings.filter(f => f.severity === 'error')
  };
}
```

### Example 3: Verify External Contract

```tsx
import { verifyService } from '@/services';

async function verifyContract(address: string) {
  // 1. Check if already verified
  const status = await verifyService.checkStatus(address, 'basecamp');
  
  if (status.verified) {
    console.log('Already verified:', status.explorerUrl);
    return;
  }
  
  // 2. Verify the contract
  const result = await verifyService.verifyByAddress({
    address,
    network: 'basecamp',
    args: ['1000000'] // Constructor args if any
  });
  
  console.log('Verified:', result.explorerUrl);
}
```

---

## 🎨 UI Component Templates

### Deployment Flow

```tsx
<DeploymentWizard>
  <Step1_PromptInput />
  <Step2_NetworkSelection />
  <Step3_ProcessingState />
  <Step4_MagicLinkDisplay />
  <Step5_SigningPage />
  <Step6_SuccessState />
</DeploymentWizard>
```

### Audit Dashboard

```tsx
<AuditDashboard>
  <SecurityScore score={85} />
  <FindingsList findings={findings} />
  <ComplianceStatus isCompliant={true} />
  <VerificationBadge verified={true} />
</AuditDashboard>
```

---

## 🔐 Security Best Practices

### 1. **Wallet Integration**
```tsx
// Always check network before signing
const network = await provider.getNetwork();
if (network.chainId !== expectedChainId) {
  throw new Error('Please switch to Base Sepolia');
}
```

### 2. **Session Expiry**
```tsx
// Show countdown timer
const timeLeft = Math.max(0, expiresAt - Date.now());
if (timeLeft === 0) {
  alert('Session expired. Please start over.');
}
```

### 3. **Gas Estimation**
```tsx
// Always show gas cost upfront
<div>Estimated gas: {estimatedGas} ETH</div>
```

### 4. **Transaction Review**
```tsx
// Let users inspect bytecode
<details>
  <summary>View bytecode</summary>
  <code>{unsignedTx.data}</code>
</details>
```

---

## 🐛 Error Handling

### Common Errors & Solutions

```typescript
const ERROR_HANDLERS = {
  'Session not found or expired': () => {
    alert('Link expired. Please start a new deployment.');
    router.push('/deploy');
  },
  
  'NETWORK_MISMATCH': () => {
    alert('Please switch to Base Sepolia in MetaMask');
  },
  
  'INSUFFICIENT_FUNDS': () => {
    alert('You need at least 0.002 ETH for gas fees');
  },
  
  'USER_REJECTED': () => {
    alert('Transaction cancelled');
  }
};

try {
  await signTransaction(sessionId);
} catch (error) {
  const handler = ERROR_HANDLERS[error.code];
  if (handler) handler();
  else console.error('Unexpected error:', error);
}
```

---

## 📊 API Response Types

### Wallet Deployment
```typescript
interface DeploymentResult {
  address: string;
  network: string;
  explorerUrl: string;
  txHash: string;
  deployedBy: string;
}
```

### Audit Report
```typescript
interface AuditReport {
  score: number; // 0-100
  summary: string;
  findings: Array<{
    severity: 'error' | 'warning' | 'info';
    title: string;
    line: number;
    exploitScenario: string;
    remediationCode: string;
  }>;
  coverage: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
```

### Compliance Report
```typescript
interface ComplianceReport {
  isCompliant: boolean;
  standard: 'ERC20' | 'ERC721' | 'ERC1155';
  confidence: number; // 0-100
  requiredFunctions: string[];
  missingFunctions: string[];
  findings: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
  }>;
}
```

---

## 🧪 Testing Guide

### Unit Tests
```typescript
import { walletDeployService } from '@/services/walletDeployService';

describe('Wallet Deployment', () => {
  it('should start deployment', async () => {
    const result = await walletDeployService.startDeployment({
      prompt: 'ERC20 token',
      network: 'basecamp'
    });
    expect(result.jobId).toMatch(/^ai_wallet_deploy_/);
  });
});
```

### Integration Tests
```typescript
describe('Deploy → Verify → Audit Flow', () => {
  it('should complete full workflow', async () => {
    // Deploy
    const { jobId } = await deploy('ERC20 token');
    
    // Wait for completion
    const result = await waitForCompletion(jobId);
    expect(result.address).toBeTruthy();
    
    // Verify
    const verified = await verify(jobId);
    expect(verified.ok).toBe(true);
    
    // Audit
    const audit = await auditByJob(jobId);
    expect(audit.score).toBeGreaterThan(70);
  });
});
```

---

## 🚀 Deployment Checklist

### Pre-Production
- [ ] Test on testnet (basecamp-testnet)
- [ ] Test with different wallets (MetaMask, WalletConnect)
- [ ] Test on mobile devices
- [ ] Verify all error states
- [ ] Check session expiry handling
- [ ] Test network switching
- [ ] Validate gas estimation accuracy

### Production
- [ ] Use HTTPS for all API calls
- [ ] Set up proper CORS
- [ ] Add analytics tracking
- [ ] Implement error logging (Sentry)
- [ ] Set up monitoring for API health
- [ ] Add rate limiting
- [ ] Enable content security policy
- [ ] Test with hardware wallets

---

## 📱 Mobile Considerations

### QR Code Support
```tsx
import QRCode from 'qrcode.react';

<div className="mobile-friendly">
  <QRCode value={magicLink} size={256} />
  <p>Scan with mobile wallet:</p>
  <ul>
    <li>MetaMask Mobile</li>
    <li>Trust Wallet</li>
    <li>Coinbase Wallet</li>
  </ul>
</div>
```

### Responsive Design
```css
@media (max-width: 768px) {
  .qr-code { size: 200px; }
  .magic-link { font-size: 14px; }
}
```

---

## 🔗 External Resources

- **Ethers.js Docs:** https://docs.ethers.org/v6/
- **MetaMask Docs:** https://docs.metamask.io/
- **WalletConnect:** https://docs.walletconnect.com/
- **React Query:** https://tanstack.com/query/latest
- **Base Sepolia Faucet:** https://www.alchemy.com/faucets/base-sepolia

---

## 💬 Support

- **API Issues:** Check `/api-docs` on your backend
- **Frontend Issues:** See individual guide files
- **Blockchain Issues:** Check block explorer
- **Wallet Issues:** Refer to wallet provider docs

---

## 📝 Changelog

### v3.1.0 - Wallet Deployment
- ✅ Added wallet-based deployment feature
- ✅ Added session management
- ✅ Added QR code support for mobile
- ✅ Added magic link generation

### v3.0.0 - ACV Features
- ✅ Added security auditing
- ✅ Added compliance checking
- ✅ Added contract verification
- ✅ Added SSE log streaming

---

## 🎯 Next Steps

1. **Read the guides** based on your needs:
   - New deployment? → [Wallet Deployment Guide](./frontend_wallet_deployment.md)
   - Security analysis? → [Audit & Compliance Guide](./frontend_audit_compliance_verify.md)
   - Quick reference? → [Quick Reference](./WALLET_DEPLOYMENT_QUICK_REFERENCE.md)

2. **Choose deployment method:**
   - [Compare methods](./DEPLOYMENT_COMPARISON.md)
   - Backend wallet for prototypes
   - User wallet for production

3. **Implement features:**
   - Start with basic deployment
   - Add verification
   - Add audit/compliance
   - Test thoroughly

4. **Deploy to production:**
   - Test on testnet first
   - Monitor API usage
   - Collect user feedback
   - Iterate and improve

---

**Production API:** https://evi-wallet-production.up.railway.app  
**API Documentation:** https://evi-wallet-production.up.railway.app/api-docs  
**Version:** 3.1.0  
**Last Updated:** December 5, 2025
