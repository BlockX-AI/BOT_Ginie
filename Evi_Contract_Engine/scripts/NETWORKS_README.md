# 🌐 Supported Networks - Blockscout Contract Retrieval

## Overview

The Blockscout retrieval scripts support **all networks from your `hardhat.config.js`** with Blockscout or compatible block explorers.

---

## 📡 Supported Networks

### Camp Networks (Primary)

| Network | Key | Chain ID | Explorer | Default |
|---------|-----|----------|----------|---------|
| **Camp Network Testnet V2** | `camp-testnet` | 325000 | https://camp-network-testnet.blockscout.com | ✅ |
| **Camp Original Testnet** | `camp-90354` | 90354 | https://camp-network-testnet.blockscout.com | |
| **Camp Network Mainnet** | `camp-netnet` | 325001 | https://camp-network-mainnet.blockscout.com | |
| **Basecamp** | `basecamp` | 123420001114 | https://basecamp.cloud.blockscout.com | |

### Base Networks

| Network | Key | Chain ID | Explorer | API |
|---------|-----|----------|----------|-----|
| **Base Sepolia** | `basecamp-testnet` | 84532 | https://sepolia.basescan.org | Basescan API |
| **Base Sepolia** | `base-sepolia` | 84532 | https://sepolia.basescan.org | Basescan API |
| **Base Mainnet** | `basecamp-mainnet` | 8453 | https://basescan.org | Basescan API* |

*May require API key for Basescan

### Other Supported Networks

| Network | Key | Chain ID | Explorer |
|---------|-----|----------|----------|
| **Boba Sepolia** | `boba-sepolia` | 28882 | https://blockexplorer.sepolia.boba.network |
| **Avalanche Fuji** | `avalanche-fuji` | 43113 | https://testnet.snowtrace.io |
| **BSC Testnet** | `bsc-testnet` | 97 | https://testnet.bscscan.com |

---

## 🚀 Quick Start

### Default Network (Camp Network Testnet V2)

```bash
# Test retrieval with your contract
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# Retrieve a specific contract
npm run retrieve:camp-testnet 0xYourContract
```

### Camp Network Mainnet

```bash
# Test on mainnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:mainnet

# Retrieve from mainnet
npm run retrieve:camp-netnet 0xYourContract
```

### Basecamp

```bash
# Retrieve from Basecamp
npm run retrieve:basecamp 0xYourContract

# Test with Basecamp
NETWORK=basecamp CONTRACT_ADDRESS=0xYourContract npm run test:retrieval
```

---

## 📋 NPM Scripts Reference

### Retrieval Scripts

```bash
# Generic (uses NETWORK env variable or default camp-testnet)
npm run retrieve:contract 0xYourContract

# Network-specific shortcuts
npm run retrieve:camp-testnet 0xYourContract
npm run retrieve:camp-netnet 0xYourContract
npm run retrieve:basecamp 0xYourContract
```

### Test Scripts

```bash
# Test on default network (camp-testnet)
npm run test:retrieval

# Test on mainnet
npm run test:retrieval:mainnet

# Test with API integration (requires server running)
npm run test:retrieval:integrate
```

### Custom Network

```bash
# Use any supported network
NETWORK=boba-sepolia npm run retrieve:contract 0xYourContract
NETWORK=avalanche-fuji npm run test:retrieval
NETWORK=bsc-testnet npm run retrieve:contract 0xYourContract
```

---

## 🔧 Command Examples

### Example 1: Retrieve from Camp Testnet

```bash
# Method 1: Using npm script
npm run retrieve:camp-testnet 0x1234567890abcdef1234567890abcdef12345678

# Method 2: Using environment variable
NETWORK=camp-testnet node scripts/retrieve-blockscout.js 0x1234...

# Method 3: Using network argument
node scripts/retrieve-blockscout.js 0x1234... ./output camp-testnet
```

### Example 2: Test with Your Contract

```bash
# On Camp Testnet (default)
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# On Camp Mainnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:mainnet

# On Basecamp
CONTRACT_ADDRESS=0xYourContract NETWORK=basecamp npm run test:retrieval
```

### Example 3: Batch Retrieval

```bash
#!/bin/bash
# Retrieve multiple contracts from Camp Testnet

CONTRACTS=(
  "0xContract1..."
  "0xContract2..."
  "0xContract3..."
)

for addr in "${CONTRACTS[@]}"; do
  echo "Retrieving $addr..."
  npm run retrieve:camp-testnet "$addr"
  sleep 2  # Rate limiting
done
```

---

## 📁 Output Structure

Retrieved contracts are saved to:

```
./contracts/<CONTRACT_ADDRESS>/
├── metadata.json              # Compiler, chain ID, optimization
├── abi.json                   # Full contract ABI
├── compiler-settings.json     # Multi-file compiler config
├── ContractName.sol           # Main source
└── contracts/                 # Imports (if multi-file)
    └── interfaces/
        └── IInterface.sol
```

### metadata.json Example

```json
{
  "address": "0x...",
  "name": "MyContract",
  "compiler": "v0.8.19+commit.7dd6d404",
  "optimization": true,
  "runs": 200,
  "evmVersion": "paris",
  "constructorArgs": "0x000000...",
  "isProxy": false,
  "implementation": null,
  "licenseType": "MIT",
  "retrievedAt": "2025-10-13T10:30:00.000Z"
}
```

---

## 🔑 Network Mapping (from hardhat.config.js)

The scripts use the exact same network keys as your Hardhat configuration:

| Hardhat Network | Retrieval Script Network | Chain ID |
|----------------|--------------------------|----------|
| `camp-testnet` | `camp-testnet` | 325000 |
| `camp-90354` | `camp-90354` | 90354 |
| `camp-netnet` | `camp-netnet` | 325001 |
| `basecamp` | `basecamp` | 123420001114 |
| `basecamp-testnet` | `basecamp-testnet` | 84532 |
| `basecamp-mainnet` | `basecamp-mainnet` | 8453 |
| `boba-sepolia` | `boba-sepolia` | 28882 |
| `avalanche-fuji` | `avalanche-fuji` | 43113 |
| `bsc-testnet` | `bsc-testnet` | 97 |

---

## ⚙️ Environment Variables

From your `.env` file:

```bash
# Camp Networks
CAMP_TESTNET_RPC_URL=https://325000.rpc.thirdweb.com
CAMP_TESTNET_90354_RPC_URL=https://90354.rpc.thirdweb.com
CAMP_NETNET_RPC_URL=https://mainnet.campprotocol.xyz

# Basecamp
BASECAMP_RPC_URL=https://rpc.basecamp.t.raas.gelato.cloud
BASECAMP_TESTNET_RPC_URL=https://sepolia.base.org
BASECAMP_MAINNET_RPC_URL=https://mainnet.base.org

# Private Keys
CAMP_PRIVATE_KEY=your_private_key
BASECAMP_PRIVATE_KEY=your_private_key
```

---

## 📝 Verify Your Contract First

Before retrieving, ensure your contract is verified on the respective block explorer:

### Camp Network Testnet V2
1. Visit: https://camp-network-testnet.blockscout.com
2. Navigate to your contract
3. Click "Verify & Publish"
4. Upload source code or use verification wizard

### Camp Network Mainnet
1. Visit: https://camp-network-mainnet.blockscout.com
2. Same verification process

### Basecamp
1. Visit: https://basecamp.cloud.blockscout.com
2. Verify your contract

### Base Sepolia/Mainnet (Basescan)
1. Visit: https://sepolia.basescan.org (or basescan.org for mainnet)
2. May require API key for verification
3. Use Hardhat verification plugin

---

## 🔍 Testing Workflow

### Step 1: Verify Your Contract

```bash
# On Camp Testnet
npx hardhat verify --network camp-testnet 0xYourContract

# On Camp Mainnet
npx hardhat verify --network camp-netnet 0xYourContract
```

### Step 2: Test Retrieval

```bash
# Test on Camp Testnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# Test on Mainnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:mainnet
```

### Step 3: Integrate with Audit/Compliance

```bash
# Start API server
npm start

# In another terminal, test integration
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:integrate
```

---

## 🐛 Troubleshooting

### Issue: "No test contracts configured"

```bash
⚠️  No test contracts configured for camp-testnet
   Network: Camp Network Testnet V2 (Chain ID: 325000)
```

**Solution:**
```bash
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval
```

### Issue: "Contract not verified"

```bash
❌ Contract not verified
Verify at: https://camp-network-testnet.blockscout.com/contract-verification
```

**Solution:** Verify your contract on Blockscout first.

### Issue: Wrong Network

```bash
❌ Unknown network: camp
Available networks: camp-testnet, camp-90354, camp-netnet, basecamp, ...
```

**Solution:** Use exact network key from the list:
```bash
NETWORK=camp-testnet npm run test:retrieval  # ✅ Correct
NETWORK=camp npm run test:retrieval          # ❌ Wrong
```

---

## 📚 Integration with Your Workflow

### From AI Routes (api/routes/ai.js)

Your AI pipeline already supports these networks. The retrieval scripts use the **same network keys**:

```javascript
// From your api/routes/ai.js (lines 538-559)
const netAliasMap = {
  'camp-testnet': 'basecamp-testnet',  // Mapped
  'camp': 'basecamp',
  'fuji': 'avalanche-fuji',
  'boba': 'boba-sepolia',
  'bsc': 'bsc-testnet',
  // ... etc
};
```

The retrieval scripts honor your exact network names from `hardhat.config.js`.

### Audit/Compliance Integration

```javascript
// api/routes/audit.js
router.post('/audit/from-address', async (req, res) => {
  const { contractAddress, network = 'camp-testnet' } = req.body;
  
  // Retrieve from blockchain
  execSync(
    `node scripts/retrieve-blockscout.js ${contractAddress} ./temp ${network}`
  );
  
  // Read and audit
  const source = fs.readFileSync(/* ... */);
  const audit = await auditService.analyzeCode(source);
  
  res.json({ ok: true, network, audit });
});
```

---

## 📊 Summary

| Feature | Value |
|---------|-------|
| **Default Network** | Camp Network Testnet V2 (`camp-testnet`) |
| **Total Networks** | 9+ supported networks |
| **Primary Networks** | Camp Testnet, Camp Mainnet, Basecamp |
| **Block Explorers** | Blockscout, Basescan, Snowtrace, BscScan |
| **Matches** | `hardhat.config.js` network keys |

---

## 🎯 Most Common Commands

```bash
# 1. Test with your Camp Testnet contract
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# 2. Retrieve from Camp Mainnet
npm run retrieve:camp-netnet 0xYourContract

# 3. Retrieve from Basecamp
npm run retrieve:basecamp 0xYourContract

# 4. Test with API integration
npm run test:retrieval:integrate
```

---

**Need Help?** Check that:
- ✅ Contract is verified on the network's block explorer
- ✅ Using correct network key (see table above)
- ✅ Network is listed in `hardhat.config.js`
