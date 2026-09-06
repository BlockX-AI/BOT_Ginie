# 📚 Swagger Documentation - Wallet Features

## ✅ Completed: Full Swagger Documentation for Wallet Endpoints

All wallet-based deployment endpoints now have comprehensive Swagger/OpenAPI documentation.

---

## 📝 Documented Endpoints

### **1. POST /api/wallet/deploy-with-wallet**
**Summary:** Start a wallet-based deployment

**Description:** 
- Generates contract code from natural language prompt using AI
- Compiles the contract with Hardhat
- Prepares an unsigned deployment transaction
- Creates a temporary session with transaction data
- Returns a job ID to track progress

**Request Body:**
```json
{
  "prompt": "Create an ERC20 token named MyToken with symbol MTK",
  "network": "basecamp-testnet",
  "callbackUrl": "https://yourapp.com/dashboard",
  "constructorArgs": [],
  "strictArgs": false
}
```

**Response (200):**
```json
{
  "jobId": "ai_wallet_deploy_abc123xyz",
  "status": "processing",
  "message": "Deployment started. Generating contract code...",
  "checkStatusUrl": "/api/jobs/ai_wallet_deploy_abc123xyz"
}
```

**Network Options:**
- `basecamp` - BaseCamp (Gelato RaaS) - Chain ID: 123420001114
- `basecamp-testnet` / `base-sepolia` - Base Sepolia - Chain ID: 84532
- `camp-testnet` - Camp Network Testnet - Chain ID: 325000
- `camp-90354` - Camp Testnet 90354
- `camp-netnet` - Camp Network Mainnet - Chain ID: 325001
- `boba-sepolia` - Boba Sepolia - Chain ID: 28882
- `avalanche-fuji` - Avalanche Fuji - Chain ID: 43113
- `bsc-testnet` - BSC Testnet - Chain ID: 97

---

### **2. GET /api/wallet/sign/{sessionId}**
**Summary:** Get session details for signing

**Description:**
- Retrieves session data for a wallet deployment ready for signing
- Used by the signing page to display transaction details
- Sessions expire after 15 minutes and can only be used once

**Parameters:**
- `sessionId` (path, required): Session ID from the magic link (format: `sess_xxxxx`)

**Response (200):**
```json
{
  "sessionId": "sess_abc123xyz",
  "jobId": "ai_wallet_deploy_abc123",
  "contractName": "MyToken",
  "network": "basecamp-testnet",
  "networkName": "Base Sepolia",
  "estimatedGas": "0.002",
  "unsignedTx": {
    "to": null,
    "data": "0x608060405...",
    "value": "0",
    "gasLimit": "3000000",
    "chainId": 84532,
    "type": 2,
    "maxFeePerGas": "50000000000",
    "maxPriorityFeePerGas": "2000000000"
  },
  "chainId": 84532,
  "callbackUrl": "https://yourapp.com/dashboard",
  "expiresAt": 1697123456789,
  "status": "pending_signature"
}
```

**Status Values:**
- `pending_signature` - Waiting for user to sign
- `signed` - Transaction has been signed and submitted
- `expired` - Session expired (>15 minutes)
- `failed` - Session failed for some reason

---

### **3. POST /api/wallet/sign/{sessionId}/submit**
**Summary:** Submit a signed transaction

**Description:**
- Submits a signed transaction hash after user signs with their wallet
- Backend monitors blockchain for transaction confirmation
- Updates job status when confirmed
- Session is consumed and cannot be reused

**Parameters:**
- `sessionId` (path, required): Session ID from the magic link

**Request Body:**
```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5"
}
```

**Response (200):**
```json
{
  "success": true,
  "jobId": "ai_wallet_deploy_abc123",
  "txHash": "0x1234567890abcdef...",
  "message": "Transaction submitted successfully. Monitoring for confirmation...",
  "callbackUrl": "https://yourapp.com/dashboard?job=ai_wallet_deploy_abc123&status=submitted",
  "checkStatusUrl": "/api/job/ai_wallet_deploy_abc123"
}
```

---

### **4. GET /api/wallet/sessions/stats**
**Summary:** Get session statistics

**Description:**
- Returns statistics about wallet deployment sessions
- Useful for monitoring system health
- Shows counts of active, signed, and expired sessions

**Response (200):**
```json
{
  "total": 5,
  "active": 2,
  "signed": 2,
  "expired": 1
}
```

**Statistics Explained:**
- `total` - Total number of sessions in memory
- `active` - Sessions pending signature (not expired)
- `signed` - Sessions that have been signed
- `expired` - Sessions older than 15 minutes

---

## 🔄 Complete Workflow Example

### **Step 1: Start Deployment**
```bash
POST /api/wallet/deploy-with-wallet
{
  "prompt": "Create an ERC20 token named TestToken",
  "network": "basecamp-testnet"
}

# Response:
{
  "jobId": "ai_wallet_deploy_xyz",
  "status": "processing"
}
```

### **Step 2: Poll Job Status**
```bash
GET /api/job/ai_wallet_deploy_xyz

# When state == "pending_signature":
{
  "state": "pending_signature",
  "result": {
    "magicLink": "https://yourapp.com/sign/sess_abc123",
    "contractName": "TestToken",
    "estimatedGas": "0.002"
  }
}
```

### **Step 3: User Opens Magic Link**
User navigates to the signing page at `/sign/sess_abc123`

The signing page calls:
```bash
GET /api/wallet/sign/sess_abc123

# Returns transaction details for user to review
```

### **Step 4: User Signs with MetaMask**
Signing page submits signed transaction:
```bash
POST /api/wallet/sign/sess_abc123/submit
{
  "txHash": "0x...",
  "walletAddress": "0x..."
}
```

### **Step 5: Backend Monitors Transaction**
Backend automatically monitors blockchain and updates job:
```bash
GET /api/job/ai_wallet_deploy_xyz

# When confirmed:
{
  "state": "completed",
  "result": {
    "address": "0x...",
    "txHash": "0x...",
    "deployer": "0x...",
    "explorerUrl": "https://..."
  }
}
```

---

## 📊 Swagger UI Access

After deployment, view all wallet endpoints in Swagger UI:

**Local:**
```
http://localhost:3000/api-docs
```

**Railway:**
```
https://evi-wallet-production.up.railway.app/api-docs
```

**OpenAPI JSON:**
```
https://evi-wallet-production.up.railway.app/api-docs.json
```

---

## 🏷️ Swagger Tags

All wallet endpoints are grouped under the **`Wallet`** tag in Swagger UI.

To see only wallet endpoints in Swagger UI:
1. Open `/api-docs`
2. Click on "Wallet" tag
3. All 4 endpoints will be displayed

---

## 🎯 Key Features Documented

✅ **Request/Response Schemas** - Full TypeScript-style schemas  
✅ **Parameter Validation** - Required fields, types, examples  
✅ **Error Responses** - 400, 404, 500 with example messages  
✅ **Descriptions** - Detailed explanations of each endpoint  
✅ **Examples** - Real-world example values for all fields  
✅ **Enums** - Network options, status values  
✅ **Workflow Guide** - Step-by-step deployment flow  

---

## 🚀 Testing with Swagger UI

You can test all endpoints directly from Swagger UI:

1. Open `/api-docs`
2. Navigate to "Wallet" tag
3. Click "Try it out" on any endpoint
4. Fill in the request body/parameters
5. Click "Execute"
6. View the response

---

## 📝 Additional Notes

### **Session Lifecycle**
- Created: When deployment is ready for signing
- Expires: After 15 minutes
- Consumed: When transaction is submitted
- Auto-cleanup: Expired sessions removed every 5 minutes

### **Security**
- No private keys stored on server
- Client-side signing only
- One-time use sessions
- Automatic expiry

### **Monitoring**
- Use `/sessions/stats` to check system health
- Track active sessions
- Monitor for stuck/expired sessions

---

## 🔗 Related Documentation

- **Wallet Deployment README:** `/WALLET_DEPLOYMENT_README.md`
- **Test Report:** `/RAILWAY_TEST_REPORT.md`
- **Frontend Guide:** `/updated/wallet_deployment_frontend_guide.md`

---

**Documentation Updated:** Nov 22, 2025  
**Swagger Version:** OpenAPI 3.0.0  
**Total Wallet Endpoints:** 4
