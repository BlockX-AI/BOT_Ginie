# 🌐 Multi-Network Support - Updated!

## ✅ What Changed

The Blockscout retrieval scripts now support **Camp Network (Basecamp)** as the default network, along with multiple other networks.

---

## 🏕️ Default Network: Basecamp

All commands now default to **Camp Network Mainnet** instead of Base Sepolia.

```bash
# These all use Basecamp by default
npm run retrieve:contract 0xYourContract
npm run test:retrieval
```

---

## 📡 Supported Networks

| Network | Key | Blockscout API |
|---------|-----|----------------|
| **Camp Network Mainnet** ⭐ | `basecamp` | https://camp-network-mainnet.blockscout.com/api |
| **Camp Network Testnet V2** | `camp-testnet` | https://camp-network-testnet.blockscout.com/api |
| Base Sepolia | `base-sepolia` | https://base-sepolia.blockscout.com/api |
| Base Mainnet | `base` | https://base.blockscout.com/api |

⭐ = Default network

---

## 🚀 New NPM Scripts

### Basecamp Scripts

```json
{
  "retrieve:basecamp": "Retrieve from Camp Network Mainnet",
  "retrieve:camp-testnet": "Retrieve from Camp Network Testnet",
  "test:retrieval": "Test with Basecamp (default)",
  "test:retrieval:camp-testnet": "Test with Camp Testnet",
  "test:retrieval:integrate": "Test with API integration (Basecamp)"
}
```

### Usage Examples

```bash
# Basecamp Mainnet (default)
npm run retrieve:basecamp 0xYourContract

# Camp Testnet
npm run retrieve:camp-testnet 0xYourTestnetContract

# Test retrieval
npm run test:retrieval

# Test with custom contract
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# Test with API integration
npm run test:retrieval:integrate
```

---

## 🔧 Updated Scripts

### 1. retrieve-blockscout.js

**New Features:**
- ✅ Multi-network support via `NETWORK` env variable or 3rd argument
- ✅ Defaults to `basecamp` network
- ✅ Network config validation
- ✅ Network-specific explorer links

**Usage:**
```bash
# Method 1: Using network argument
node scripts/retrieve-blockscout.js 0xAddress ./output basecamp

# Method 2: Using environment variable
NETWORK=camp-testnet node scripts/retrieve-blockscout.js 0xAddress

# Method 3: Using npm script
npm run retrieve:basecamp 0xAddress
```

**Help Output:**
```bash
node scripts/retrieve-blockscout.js

❌ Usage: node retrieve-blockscout.js <CONTRACT_ADDRESS> [OUTPUT_DIR] [NETWORK]

Available networks:
  basecamp        - Camp Network Mainnet
  camp-testnet    - Camp Network Testnet V2
  base-sepolia    - Base Sepolia
  base            - Base Mainnet

Examples:
  node retrieve-blockscout.js 0xABC... ./contracts basecamp
  NETWORK=camp-testnet node retrieve-blockscout.js 0xABC...
```

### 2. test-blockscout-retrieval.js

**New Features:**
- ✅ Network-aware testing
- ✅ Network-specific test contracts
- ✅ Displays network in test output
- ✅ Integration examples show network parameter

**Usage:**
```bash
# Test on Basecamp (default)
npm run test:retrieval

# Test on Camp Testnet
npm run test:retrieval:camp-testnet

# Test with custom contract and network
CONTRACT_ADDRESS=0xYourContract NETWORK=basecamp npm run test:retrieval

# Test with API integration
npm run test:retrieval:integrate
```

---

## 📝 Test It Now

### Quick Test with Your Contract

```bash
# 1. Make sure your contract is verified on Camp Network Blockscout
#    Visit: https://camp-network-mainnet.blockscout.com

# 2. Run the test
CONTRACT_ADDRESS=0xYourVerifiedContract npm run test:retrieval
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║  Blockscout Contract Retrieval Test Suite                 ║
╚════════════════════════════════════════════════════════════╝

📍 Network: Camp Network Mainnet
📂 Output Directory: ./test-contracts-output
🔗 API Integration: Disabled

🌐 Network: Camp Network Mainnet
🔍 Fetching: 0xYourVerifiedContract
✅ Found: YourContract
  ✅ metadata.json
  ✅ YourContract.sol
  ✅ abi.json

📦 Saved to: test-contracts-output/0xYourVerifiedContract

✅ Test 1: Custom Contract

🎉 All tests passed!
```

---

## 📚 Documentation

### New Guides Created

1. **`BASECAMP_USAGE.md`** - Complete Basecamp-specific guide
   - Quick commands for Basecamp
   - Integration examples
   - Troubleshooting

2. **`QUICK_START_TEST.md`** - Updated with Basecamp as default
   - Quick start commands
   - Network-specific examples
   - All supported networks

3. **`BLOCKSCOUT_RETRIEVAL_GUIDE.md`** - Comprehensive guide
   - Updated with network support
   - Multi-network examples
   - Integration patterns

---

## 🔄 Migration Guide

### If You Were Using Base Sepolia

**Old way:**
```bash
npm run retrieve:contract 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

**New way (explicit network):**
```bash
NETWORK=base-sepolia npm run retrieve:contract 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Update Your Scripts

If you have custom scripts using the retrieval tool:

**Before:**
```javascript
execSync(`node scripts/retrieve-blockscout.js ${address} ./output`);
```

**After (specify network):**
```javascript
execSync(`node scripts/retrieve-blockscout.js ${address} ./output basecamp`);
// or
execSync(`NETWORK=basecamp node scripts/retrieve-blockscout.js ${address} ./output`);
```

---

## 🎯 Integration Examples

### Audit API with Network Support

```javascript
// api/routes/audit.js
router.post('/audit/from-address', async (req, res) => {
  const { contractAddress, network = 'basecamp' } = req.body;
  
  try {
    // Retrieve from specified network
    execSync(
      `node scripts/retrieve-blockscout.js ${contractAddress} ./temp ${network}`
    );
    
    const metadata = JSON.parse(
      fs.readFileSync(`./temp/${contractAddress}/metadata.json`)
    );
    
    const sourceCode = fs.readFileSync(
      `./temp/${contractAddress}/${metadata.name}.sol`,
      'utf8'
    );
    
    const audit = await auditService.analyzeCode(sourceCode);
    
    res.json({
      ok: true,
      network,
      contractAddress,
      contractName: metadata.name,
      audit
    });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

### Compliance API with Network Support

```javascript
// api/routes/compliance.js
router.post('/compliance/from-address', async (req, res) => {
  const { 
    contractAddress, 
    network = 'basecamp',
    profile = 'generic' 
  } = req.body;
  
  execSync(
    `node scripts/retrieve-blockscout.js ${contractAddress} ./temp ${network}`
  );
  
  // ... rest of compliance logic
  
  res.json({ ok: true, network, contractAddress, compliance });
});
```

---

## ✅ Checklist

Before using the updated scripts:

- [ ] Contract is deployed and verified on Blockscout
- [ ] You know which network (basecamp, camp-testnet, etc.)
- [ ] You have the contract address
- [ ] (Optional) API server running for integration tests

---

## 🆘 Quick Troubleshooting

### Issue: "No test contracts configured"

**Solution:**
```bash
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval
```

### Issue: "Contract not verified"

**Solution:** Verify at https://camp-network-mainnet.blockscout.com/contract-verification

### Issue: Wrong network

**Solution:** Specify network explicitly:
```bash
NETWORK=basecamp npm run retrieve:contract 0x...
```

---

## 📊 Summary

| What | Old Behavior | New Behavior |
|------|-------------|--------------|
| Default network | Base Sepolia | **Camp Network Mainnet (basecamp)** |
| Network support | Single network | **4 networks** (basecamp, camp-testnet, base-sepolia, base) |
| Network selection | Hardcoded | **Environment variable or argument** |
| NPM scripts | Generic | **Network-specific scripts** |
| Documentation | Base Sepolia focused | **Basecamp focused with multi-network support** |

---

## 🎉 Ready to Use!

Try it now with your Basecamp contract:

```bash
CONTRACT_ADDRESS=0xYourBasecampContract npm run test:retrieval
```

For detailed usage, see:
- `scripts/BASECAMP_USAGE.md` - Basecamp-specific guide
- `scripts/QUICK_START_TEST.md` - Quick start examples
- `scripts/BLOCKSCOUT_RETRIEVAL_GUIDE.md` - Complete documentation
