# Blockscout Contract Retrieval Tools

## Overview
Two scripts for retrieving verified smart contract source code from Base Sepolia Blockscout explorer:

1. **`retrieve-blockscout.js`** - Main retrieval utility
2. **`test-blockscout-retrieval.js`** - Comprehensive test suite

---

## Quick Start

### 1. Basic Retrieval
```bash
# Retrieve a verified contract
node scripts/retrieve-blockscout.js 0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Custom output directory
node scripts/retrieve-blockscout.js 0x036CbD53842c5426634e7929541eC2318f3dCF7e ./my-contracts
```

### 2. Run Test Suite
```bash
# Basic test (no API integration)
node scripts/test-blockscout-retrieval.js

# Test with custom contract
CONTRACT_ADDRESS=0xYourAddress node scripts/test-blockscout-retrieval.js

# Test with Audit/Compliance API integration
BASE_URL=http://localhost:3000 node scripts/test-blockscout-retrieval.js --integrate
```

---

## Output Structure

For contract `0xABC...123`, creates:

```
./contracts/0xABC...123/
├── metadata.json           # Compiler version, optimization, proxy info
├── abi.json               # Contract ABI
├── compiler-settings.json # Full compiler configuration (multi-file)
├── ContractName.sol       # Main source (single-file)
└── contracts/             # Multi-file sources (if applicable)
    ├── MyContract.sol
    └── interfaces/
        └── IMyInterface.sol
```

---

## Features

### ✅ Handles All Contract Types
- **Single-file contracts** (e.g., simple ERC20)
- **Multi-file projects** (Hardhat/Foundry with imports)
- **Proxy contracts** (detects implementation address)
- **Sourcify verified** (multiple verification sources)

### ✅ Complete Metadata
- Exact compiler version
- Optimization settings and runs
- Constructor arguments
- License information
- EVM version

### ✅ Edge Case Handling
- API response format variations
- Double-wrapped JSON (`{{...}}`)
- Missing/incomplete verification
- Network errors with retry suggestions

---

## Integration Examples

### With Audit API

```javascript
// api/routes/audit.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

router.post('/audit/from-address', async (req, res) => {
  const { contractAddress } = req.body;
  const outputDir = './temp-contracts';
  
  try {
    // 1. Retrieve source from Blockscout
    execSync(
      `node scripts/retrieve-blockscout.js ${contractAddress} ${outputDir}`,
      { stdio: 'inherit' }
    );
    
    // 2. Read retrieved files
    const metadataPath = path.join(outputDir, contractAddress, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    const solFiles = fs.readdirSync(path.join(outputDir, contractAddress), { recursive: true })
      .filter(f => f.endsWith('.sol'));
    
    const mainSource = fs.readFileSync(
      path.join(outputDir, contractAddress, solFiles[0]),
      'utf8'
    );
    
    // 3. Perform audit
    const audit = await auditService.analyzeCode(mainSource, {
      filename: solFiles[0],
      compiler: metadata.compiler,
      optimization: metadata.optimization
    });
    
    // 4. Return results
    res.json({
      ok: true,
      contractAddress,
      contractName: metadata.name,
      audit,
      metadata
    });
    
    // 5. Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

### With Compliance API

```javascript
// api/routes/compliance.js
router.post('/compliance/from-address', async (req, res) => {
  const { contractAddress, profile = 'generic', strict = false } = req.body;
  
  try {
    // Retrieve source
    const { source, metadata } = await retrieveContractSource(contractAddress);
    
    // Run compliance check
    const compliance = await complianceService.analyze(source, {
      filename: `${metadata.name}.sol`,
      profile,
      strict,
      metadata // Pass compiler info for context
    });
    
    res.json({ ok: true, contractAddress, compliance, metadata });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Helper function
async function retrieveContractSource(address) {
  const { execSync } = require('child_process');
  const outputDir = './temp';
  
  execSync(`node scripts/retrieve-blockscout.js ${address} ${outputDir}`);
  
  const metadata = JSON.parse(
    fs.readFileSync(`${outputDir}/${address}/metadata.json`, 'utf8')
  );
  
  const solFile = fs.readdirSync(`${outputDir}/${address}`, { recursive: true })
    .find(f => f.endsWith('.sol'));
  
  const source = fs.readFileSync(`${outputDir}/${address}/${solFile}`, 'utf8');
  
  return { source, metadata };
}
```

### With Job-Based Workflow

```javascript
// api/routes/verify.js
router.post('/verify/re-verify', async (req, res) => {
  const { jobId } = req.body;
  
  // 1. Get job details
  const job = await db.getJob(jobId);
  const { contractAddress } = job;
  
  // 2. Retrieve current on-chain source
  execSync(`node scripts/retrieve-blockscout.js ${contractAddress} ./temp`);
  
  const onChainSource = fs.readFileSync(/* ... */);
  
  // 3. Compare with original artifacts
  const originalSource = await artifacts.getSource(jobId);
  
  const match = onChainSource === originalSource;
  
  res.json({
    ok: true,
    jobId,
    contractAddress,
    verified: match,
    details: match ? 'Source matches original' : 'Source has been modified'
  });
});
```

---

## Error Handling

### Contract Not Verified
```bash
❌ Contract not verified
Verify at: https://base-sepolia.blockscout.com/contract-verification
```

**Solution:** Verify contract on Blockscout first

### Network Issues
```bash
❌ Error: fetch failed
```

**Solutions:**
- Check internet connection
- Verify Blockscout API is accessible
- Try again (temporary API issues)

### Invalid Address
```bash
❌ Usage: node retrieve-blockscout.js <CONTRACT_ADDRESS> [OUTPUT_DIR]
```

**Solution:** Provide valid Ethereum address (0x...)

---

## Testing Workflow

### Step 1: Test Retrieval
```bash
# Test with known verified contract (USDC on Base Sepolia)
node scripts/test-blockscout-retrieval.js
```

Expected output:
```
✅ Found: FiatTokenV2_1
  ✅ metadata.json
  ✅ FiatTokenV2_1.sol
  ✅ abi.json
📦 Saved to: ./test-contracts-output/0x036...
```

### Step 2: Test API Integration
```bash
# Start your API server first
node api/server.js

# In another terminal, run integration test
BASE_URL=http://localhost:3000 node scripts/test-blockscout-retrieval.js --integrate
```

### Step 3: Inspect Results
```bash
# View retrieved contract structure
tree test-contracts-output/

# Read metadata
cat test-contracts-output/0x036CbD53842c5426634e7929541eC2318f3dCF7e/metadata.json | jq

# View source
cat test-contracts-output/0x036CbD53842c5426634e7929541eC2318f3dCF7e/*.sol
```

---

## Known Verified Contracts on Base Sepolia

For testing:

| Contract | Address | Type |
|----------|---------|------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ERC20 |

To find more: Visit [Base Sepolia Blockscout](https://base-sepolia.blockscout.com) and filter by verified contracts.

---

## Proxy Contract Handling

When a proxy is detected:

```bash
✅ Found: TransparentUpgradeableProxy
  ✅ metadata.json
  ✅ abi.json

🔗 This is a proxy contract
   Implementation: 0xDEF...456
   To retrieve implementation, run:
   node scripts/retrieve-blockscout.js 0xDEF...456
```

**Best Practice:** Always retrieve both proxy and implementation for complete audits.

---

## Performance

- Single contract: ~2-5 seconds
- Multi-file contract: ~5-10 seconds
- Proxy + implementation: ~10-15 seconds

**Rate Limiting:** Blockscout API has rate limits. Add delays for batch processing:

```javascript
for (const address of addresses) {
  execSync(`node scripts/retrieve-blockscout.js ${address}`);
  await sleep(1000); // 1 second delay
}
```

---

## Next Steps

1. ✅ **Test the retrieval script** with test suite
2. ✅ **Review output structure** in `test-contracts-output/`
3. 🔄 **Integrate with audit API** (see examples above)
4. 🔄 **Add to compliance workflow**
5. 🔄 **Update Swagger docs** for new endpoints

---

## Troubleshooting

### Issue: "Command not found: node"
**Solution:** Ensure Node.js is installed and in PATH

### Issue: "Permission denied"
**Solution:** Make script executable:
```bash
chmod +x scripts/retrieve-blockscout.js
chmod +x scripts/test-blockscout-retrieval.js
```

### Issue: Test fails with "fetch is not defined"
**Solution:** Use Node.js v18+ (fetch is built-in) or install node-fetch

### Issue: API integration test fails
**Solution:** 
1. Start API server: `node api/server.js`
2. Verify server is running: `curl http://localhost:3000/`
3. Check GEMINI_API_KEY is set in .env

---

## Support

For issues or questions:
1. Check Blockscout API status: https://base-sepolia.blockscout.com
2. Review test output logs
3. Verify contract is verified on Blockscout
4. Check Node.js version (v18+ recommended)
