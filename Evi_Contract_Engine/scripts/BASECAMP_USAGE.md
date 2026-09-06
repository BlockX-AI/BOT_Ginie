# 🏕️ Basecamp Network - Contract Retrieval Guide

## Quick Commands

### Retrieve Your Basecamp Contract

```bash
# Camp Network Mainnet
npm run retrieve:basecamp 0xYourContractAddress

# Camp Network Testnet V2
npm run retrieve:camp-testnet 0xYourTestnetContract
```

### Test the Retrieval Tool

```bash
# Test with your contract on Basecamp Mainnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# Test with your contract on Camp Testnet
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:camp-testnet
```

---

## Supported Networks

| Network | Command | Blockscout Explorer |
|---------|---------|-------------------|
| **Camp Network Mainnet** | `npm run retrieve:basecamp 0x...` | https://camp-network-mainnet.blockscout.com |
| **Camp Network Testnet V2** | `npm run retrieve:camp-testnet 0x...` | https://camp-network-testnet.blockscout.com |
| Base Sepolia | `NETWORK=base-sepolia npm run retrieve:contract 0x...` | https://base-sepolia.blockscout.com |
| Base Mainnet | `NETWORK=base npm run retrieve:contract 0x...` | https://base.blockscout.com |

---

## Examples

### Example 1: Retrieve from Basecamp Mainnet

```bash
# Using npm script
npm run retrieve:basecamp 0x1234567890abcdef1234567890abcdef12345678

# Using environment variable
NETWORK=basecamp node scripts/retrieve-blockscout.js 0x1234567890abcdef1234567890abcdef12345678

# Custom output directory
node scripts/retrieve-blockscout.js 0x1234... ./my-contracts basecamp
```

**Output:**
```
🌐 Network: Camp Network Mainnet
🔍 Fetching: 0x1234567890abcdef1234567890abcdef12345678
✅ Found: MyContract
  ✅ metadata.json
  ✅ MyContract.sol
  ✅ abi.json

📦 Saved to: contracts/0x1234567890abcdef1234567890abcdef12345678
```

### Example 2: Retrieve from Camp Testnet

```bash
npm run retrieve:camp-testnet 0xabcdef1234567890abcdef1234567890abcdef12
```

### Example 3: Test with Integration

```bash
# Start API server first
npm start

# In another terminal, test with integration
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:integrate
```

This will:
1. Retrieve your contract from Basecamp
2. Send it to `/api/audit/code` for security analysis
3. Send it to `/api/compliance/analyze` for compliance check
4. Display results

---

## File Structure

Retrieved contracts are saved with this structure:

```
./contracts/0xYourContractAddress/
├── metadata.json          # Compiler version, optimization, etc.
├── abi.json              # Contract ABI for interaction
├── MyContract.sol        # Main contract source
└── interfaces/           # Imported contracts (if multi-file)
    └── IMyInterface.sol
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

## Integration with Audit/Compliance APIs

### 1. Audit Deployed Contract

```javascript
// api/routes/audit.js
router.post('/audit/from-basecamp', async (req, res) => {
  const { contractAddress } = req.body;
  
  try {
    // Retrieve from Basecamp
    execSync(`node scripts/retrieve-blockscout.js ${contractAddress} ./temp basecamp`);
    
    // Read files
    const metadata = JSON.parse(fs.readFileSync(`./temp/${contractAddress}/metadata.json`));
    const abi = JSON.parse(fs.readFileSync(`./temp/${contractAddress}/abi.json`));
    
    const solFiles = fs.readdirSync(`./temp/${contractAddress}`, { recursive: true })
      .filter(f => f.endsWith('.sol'));
    
    const sourceCode = fs.readFileSync(`./temp/${contractAddress}/${solFiles[0]}`, 'utf8');
    
    // Perform audit
    const audit = await auditService.analyzeCode(sourceCode, {
      filename: solFiles[0],
      compiler: metadata.compiler
    });
    
    res.json({
      ok: true,
      network: 'basecamp',
      contractAddress,
      contractName: metadata.name,
      audit
    });
    
    // Cleanup
    fs.rmSync('./temp', { recursive: true, force: true });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

### 2. Compliance Check

```javascript
// api/routes/compliance.js
router.post('/compliance/from-basecamp', async (req, res) => {
  const { contractAddress, profile = 'generic' } = req.body;
  
  // Retrieve from Basecamp
  execSync(`node scripts/retrieve-blockscout.js ${contractAddress} ./temp basecamp`);
  
  // Load and analyze
  const sourceCode = fs.readFileSync(/* ... */);
  const compliance = await complianceService.analyze(sourceCode, { profile });
  
  res.json({ ok: true, network: 'basecamp', contractAddress, compliance });
});
```

---

## Verify Your Contract First

Before retrieval, ensure your contract is verified on Blockscout:

### Camp Network Mainnet
1. Visit: https://camp-network-mainnet.blockscout.com
2. Navigate to your contract
3. Click "Verify & Publish"
4. Follow the verification wizard

### Camp Network Testnet V2
1. Visit: https://camp-network-testnet.blockscout.com
2. Same process as above

### Verification Options
- **Standard JSON Input** (recommended for Hardhat/Foundry)
- **Flattened source code**
- **Multi-part files**
- **Sourcify verification**

---

## Troubleshooting

### Contract Not Verified Error

```bash
❌ Contract not verified
Verify at: https://camp-network-mainnet.blockscout.com/contract-verification
```

**Solution:** Verify your contract on Blockscout first.

### Network Not Found

```bash
❌ Unknown network: bascamp
Available networks: basecamp, camp-testnet, base-sepolia, base
```

**Solution:** Use correct network name: `basecamp` not `bascamp`.

### Empty Test Contracts

```bash
⚠️  No test contracts configured for basecamp
   Set CONTRACT_ADDRESS env variable to test with your own contract:
   CONTRACT_ADDRESS=0x... npm run test:retrieval
```

**Solution:** Provide your contract address:
```bash
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval
```

---

## Advanced Usage

### Batch Retrieval

```bash
# Create a script to retrieve multiple contracts
for addr in 0xContract1 0xContract2 0xContract3; do
  npm run retrieve:basecamp $addr
  sleep 2  # Rate limiting
done
```

### Custom Network (if you have your own Blockscout)

Edit `scripts/retrieve-blockscout.js` and add:

```javascript
const NETWORKS = {
  // ... existing networks
  'my-network': {
    name: 'My Custom Network',
    api: 'https://my-blockscout.example.com/api',
    explorer: 'https://my-blockscout.example.com'
  }
};
```

Then use:
```bash
NETWORK=my-network npm run retrieve:contract 0x...
```

---

## Summary

### Most Common Commands

```bash
# 1. Retrieve from Basecamp Mainnet
npm run retrieve:basecamp 0xYourContract

# 2. Test retrieval with your contract
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval

# 3. Retrieve from Camp Testnet
npm run retrieve:camp-testnet 0xYourTestnetContract

# 4. Test with API integration
CONTRACT_ADDRESS=0xYourContract npm run test:retrieval:integrate
```

### Need Help?

1. Check contract is verified on Blockscout
2. Use correct network name: `basecamp` or `camp-testnet`
3. Provide contract address: `CONTRACT_ADDRESS=0x...`
4. Review logs for specific error messages

---

**Network Default:** All commands default to `basecamp` (Camp Network Mainnet) 🏕️
