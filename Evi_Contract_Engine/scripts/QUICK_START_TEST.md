# 🚀 Quick Start - Test Blockscout Retrieval

## Test Right Now!

### 1️⃣ Basic Test - Camp Network (Basecamp)

```bash
# Run the test suite on Camp Network Mainnet
npm run test:retrieval
```

**For your own contract:**
```bash
# Test with your verified Basecamp contract
CONTRACT_ADDRESS=0xYourContractAddress npm run test:retrieval
```

**For Camp Testnet:**
```bash
# Test on Camp Network Testnet V2
npm run test:retrieval:camp-testnet

# Or with your testnet contract
CONTRACT_ADDRESS=0xYourTestnetContract npm run test:retrieval:camp-testnet
```

This will:
- ✅ Retrieve verified contract from Camp Network Blockscout
- ✅ Save source code, ABI, and metadata
- ✅ Verify all files are created correctly
- ✅ Display contract details

**Expected output:**
```
╔════════════════════════════════════════════════════════════╗
║  Blockscout Contract Retrieval Test Suite                 ║
╚════════════════════════════════════════════════════════════╝

📍 Network: Camp Network Mainnet
🌐 Network: Camp Network Mainnet
🔍 Fetching: 0xYourContract...
  ✅ metadata.json
  ✅ YourContract.sol
  ✅ abi.json

📦 Saved to: ./test-contracts-output/0x...

📋 Metadata:
   Contract: YourContract
   Compiler: v0.8.19+commit.7dd6d404
   Optimization: true (runs: 200)

🎉 All tests passed!
```

---

### 2️⃣ Retrieve a Specific Contract

```bash
# Direct retrieval from Basecamp (saves to ./contracts/ by default)
npm run retrieve:basecamp 0xYourContractAddress

# From Camp Testnet
npm run retrieve:camp-testnet 0xYourTestnetContract

# Custom output directory
node scripts/retrieve-blockscout.js 0xYourContract ./my-contracts basecamp
```

**All supported networks:**
```bash
# Camp Network Mainnet (default)
NETWORK=basecamp npm run retrieve:contract 0x...

# Camp Network Testnet V2
NETWORK=camp-testnet npm run retrieve:contract 0x...

# Base Sepolia (for testing with known contracts)
NETWORK=base-sepolia npm run retrieve:contract 0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Base Mainnet
NETWORK=base npm run retrieve:contract 0x...
```

---

### 3️⃣ Test with Audit/Compliance Integration

**Prerequisites:**
- Start your API server: `npm start` (in another terminal)
- Ensure `.env` has `GEMINI_API_KEY` set

```bash
# Run integration test
npm run test:retrieval:integrate
```

This will:
- ✅ Retrieve contract from Blockscout
- ✅ Send source to `/api/audit/code`
- ✅ Send source to `/api/compliance/analyze`
- ✅ Display audit findings and compliance scores

---

## 📁 Where to Find Output

After running tests:

```bash
# View test output
tree test-contracts-output/

# Read contract metadata
cat test-contracts-output/0x036CbD53842c5426634e7929541eC2318f3dCF7e/metadata.json

# View contract source
cat test-contracts-output/0x036CbD53842c5426634e7929541eC2318f3dCF7e/*.sol

# View ABI
cat test-contracts-output/0x036CbD53842c5426634e7929541eC2318f3dCF7e/abi.json | jq
```

---

## 🎯 Try These Verified Contracts

**On Camp Network (Basecamp):**

```bash
# Your deployed and verified contracts
npm run retrieve:basecamp 0xYourContractAddress
```

**On Camp Network Testnet:**

```bash
# Your testnet contracts
npm run retrieve:camp-testnet 0xYourTestnetContract
```

**For testing on Base Sepolia (known contract):**

```bash
# USDC Token (ERC20 Proxy)
NETWORK=base-sepolia npm run retrieve:contract 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

**Note:** Make sure your contracts are verified on the respective Blockscout explorer:
- Basecamp: https://camp-network-mainnet.blockscout.com
- Camp Testnet: https://camp-network-testnet.blockscout.com

---

## 🔍 What Gets Retrieved

For each contract:

```
📦 Output/
└── <CONTRACT_ADDRESS>/
    ├── metadata.json          ← Compiler, optimization, proxy info
    ├── abi.json              ← Full ABI for contract interaction
    ├── compiler-settings.json ← Exact compiler configuration
    └── <ContractName>.sol    ← Source code (or directory for multi-file)
```

---

## ✅ Success Criteria

You'll know it worked if you see:

1. ✅ `Found: <ContractName>`
2. ✅ Multiple `.sol` files created
3. ✅ `metadata.json` and `abi.json` present
4. ✅ Compiler version displayed
5. ✅ "Complete!" message

---

## ❌ Common Issues

### "Contract not verified"
**Fix:** Verify contract on Blockscout first
- Visit: https://base-sepolia.blockscout.com/contract-verification

### "fetch is not defined"
**Fix:** Use Node.js 18+ (check with `node --version`)

### Integration test fails
**Fix:** Start API server first: `npm start`

---

## 💡 Next: Integrate with Your Audit Workflow

If tests pass, integrate into your audit/compliance APIs:

### Example: Add to `api/routes/audit.js`

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

router.post('/audit/from-blockscout', async (req, res) => {
  const { contractAddress } = req.body;
  
  try {
    // 1. Retrieve from Blockscout
    execSync(`node scripts/retrieve-blockscout.js ${contractAddress} ./temp`);
    
    // 2. Read source
    const metadata = JSON.parse(
      fs.readFileSync(`./temp/${contractAddress}/metadata.json`, 'utf8')
    );
    
    const sourceFile = fs.readdirSync(`./temp/${contractAddress}`)
      .find(f => f.endsWith('.sol'));
    
    const source = fs.readFileSync(
      `./temp/${contractAddress}/${sourceFile}`, 
      'utf8'
    );
    
    // 3. Perform audit
    const audit = await auditService.analyzeCode(source, {
      filename: sourceFile,
      metadata
    });
    
    // 4. Return results
    res.json({
      ok: true,
      contractAddress,
      contractName: metadata.name,
      audit
    });
    
    // 5. Cleanup
    fs.rmSync('./temp', { recursive: true, force: true });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

---

## 📚 Full Documentation

See `scripts/BLOCKSCOUT_RETRIEVAL_GUIDE.md` for complete documentation.

---

## 🚀 Ready to Test?

Run this now:

```bash
npm run test:retrieval
```

Then check the output in `test-contracts-output/` directory!
