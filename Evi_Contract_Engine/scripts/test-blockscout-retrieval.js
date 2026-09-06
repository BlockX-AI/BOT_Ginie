#!/usr/bin/env node
/**
 * Test suite for Blockscout contract retrieval
 * 
 * Usage:
 *   node scripts/test-blockscout-retrieval.js
 * 
 * With custom contract:
 *   CONTRACT_ADDRESS=0x... node scripts/test-blockscout-retrieval.js
 * 
 * Test with audit/compliance integration:
 *   BASE_URL=http://localhost:3000 node scripts/test-blockscout-retrieval.js --integrate
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const testWithIntegration = process.argv.includes('--integrate');
const customAddress = process.env.CONTRACT_ADDRESS;
const network = process.env.NETWORK || 'camp-testnet';

// Network display names (matching hardhat.config.js)
const NETWORK_NAMES = {
  'camp-testnet': 'Camp Network Testnet V2 (Chain ID: 325000)',
  'camp-90354': 'Camp Original Testnet (Chain ID: 90354)',
  'camp-netnet': 'Camp Network Mainnet (Chain ID: 325001)',
  'basecamp': 'Basecamp (Chain ID: 123420001114)',
  'basecamp-testnet': 'Base Sepolia (Chain ID: 84532)',
  'base-sepolia': 'Base Sepolia (Chain ID: 84532)',
  'basecamp-mainnet': 'Base Mainnet (Chain ID: 8453)',
  'boba-sepolia': 'Boba Sepolia (Chain ID: 28882)',
  'avalanche-fuji': 'Avalanche Fuji Testnet (Chain ID: 43113)',
  'bsc-testnet': 'BSC Testnet (Chain ID: 97)'
};

// Known verified contracts by network
const KNOWN_CONTRACTS = {
  'camp-testnet': [
    // Add your verified Camp Network Testnet V2 contracts here
    // Example: { name: 'MyContract', address: '0x...', description: 'My deployed contract' }
  ],
  'camp-90354': [
    // Add your verified Camp Original Testnet contracts here
  ],
  'camp-netnet': [
    // Add your verified Camp Network Mainnet contracts here
  ],
  'basecamp': [
    // Add your verified Basecamp contracts here
  ],
  'basecamp-testnet': [
    // Base Sepolia known contracts
    {
      name: 'USDC Proxy',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      description: 'USDC token proxy contract on Base Sepolia'
    }
  ],
  'base-sepolia': [
    {
      name: 'USDC Proxy',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      description: 'USDC token proxy contract'
    }
  ],
  'basecamp-mainnet': [],
  'boba-sepolia': [],
  'avalanche-fuji': [],
  'bsc-testnet': []
};

const TEST_CONTRACTS = customAddress 
  ? [{ name: 'Custom Contract', address: customAddress, description: 'User-provided contract' }]
  : (KNOWN_CONTRACTS[network] || []).filter(c => c.address);

const OUTPUT_DIR = './test-contracts-output';

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function subsection(title) {
  console.log(`\n→ ${title}`);
}

function cleanup() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    console.log(`🧹 Cleaned up ${OUTPUT_DIR}`);
  }
}

function verifyOutputStructure(address) {
  const dir = path.join(OUTPUT_DIR, address);
  
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory not created: ${dir}`);
    return false;
  }
  
  const requiredFiles = ['metadata.json', 'abi.json'];
  const files = fs.readdirSync(dir, { recursive: true });
  
  console.log(`📁 Files created: ${files.length}`);
  files.forEach(f => console.log(`   - ${f}`));
  
  // Check metadata
  const metadataPath = path.join(dir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log(`\n📋 Metadata:`);
    console.log(`   Contract: ${metadata.name}`);
    console.log(`   Compiler: ${metadata.compiler}`);
    console.log(`   Optimization: ${metadata.optimization} (runs: ${metadata.runs})`);
    console.log(`   License: ${metadata.licenseType || 'Unknown'}`);
    console.log(`   Is Proxy: ${metadata.isProxy}`);
    if (metadata.implementation) {
      console.log(`   Implementation: ${metadata.implementation}`);
    }
    
    // Check ABI
    const abiPath = path.join(dir, 'abi.json');
    if (fs.existsSync(abiPath)) {
      const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
      console.log(`\n📜 ABI: ${Array.isArray(abi) ? abi.length : 0} functions/events`);
      
      // Show sample functions
      if (Array.isArray(abi)) {
        const functions = abi.filter(item => item.type === 'function').slice(0, 3);
        if (functions.length > 0) {
          console.log(`   Sample functions:`);
          functions.forEach(f => {
            const params = f.inputs?.map(i => `${i.type} ${i.name}`).join(', ') || '';
            console.log(`   - ${f.name}(${params})`);
          });
        }
      }
    }
    
    // Find and display source files
    const solFiles = files.filter(f => f.endsWith('.sol'));
    if (solFiles.length > 0) {
      console.log(`\n📝 Source files (${solFiles.length}):`);
      solFiles.forEach(f => {
        const fullPath = path.join(dir, f);
        const size = fs.statSync(fullPath).size;
        console.log(`   - ${f} (${size} bytes)`);
      });
    }
    
    return true;
  }
  
  return false;
}

async function testAuditIntegration(address) {
  try {
    const dir = path.join(OUTPUT_DIR, address);
    const metadataPath = path.join(dir, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Find main source file
    const files = fs.readdirSync(dir, { recursive: true });
    const solFile = files.find(f => f.endsWith('.sol'));
    
    if (!solFile) {
      console.log('⚠️  No .sol file found for audit integration test');
      return;
    }
    
    const sourceCode = fs.readFileSync(path.join(dir, solFile), 'utf8');
    
    subsection('Testing Audit API Integration');
    
    // Test /api/audit/code
    const auditResponse = await fetch(`${baseUrl}/api/audit/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: sourceCode,
        filename: solFile,
        auditType: 'full'
      })
    });
    
    const auditResult = await auditResponse.json();
    console.log(`   Audit API: ${auditResponse.status === 200 ? '✅' : '❌'} Status ${auditResponse.status}`);
    if (auditResult.ok) {
      console.log(`   Findings: ${auditResult.audit?.findings?.length || 0}`);
      console.log(`   Severity distribution:`, auditResult.audit?.summary);
    }
    
    subsection('Testing Compliance API Integration');
    
    // Test /api/compliance/analyze
    const complianceResponse = await fetch(`${baseUrl}/api/compliance/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: sourceCode,
        filename: solFile,
        profile: 'generic',
        strict: false
      })
    });
    
    const complianceResult = await complianceResponse.json();
    console.log(`   Compliance API: ${complianceResponse.status === 200 ? '✅' : '❌'} Status ${complianceResponse.status}`);
    if (complianceResult.ok) {
      console.log(`   Score: ${complianceResult.compliance?.score || 'N/A'}`);
      console.log(`   Checks: ${complianceResult.compliance?.checks?.length || 0}`);
    }
    
  } catch (error) {
    console.error(`❌ Integration test failed: ${error.message}`);
  }
}

async function runTest(testCase, index) {
  section(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Address: ${testCase.address}`);
  console.log(`Description: ${testCase.description}`);
  
  try {
    subsection('Running retrieval script');
    
    const scriptPath = path.join(__dirname, 'retrieve-blockscout.js');
    const cmd = `node "${scriptPath}" ${testCase.address} ${OUTPUT_DIR} ${network}`;
    
    console.log(`Command: ${cmd}\n`);
    
    const output = execSync(cmd, { 
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, NETWORK: network }
    });
    
    console.log(output);
    
    subsection('Verifying output structure');
    const success = verifyOutputStructure(testCase.address);
    
    if (success && testWithIntegration) {
      await testAuditIntegration(testCase.address);
    }
    
    return success;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    if (error.stdout) console.log('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Blockscout Contract Retrieval Test Suite                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\n📍 Network: ${NETWORK_NAMES[network] || network}`);
  console.log(`📂 Output Directory: ${OUTPUT_DIR}`);
  console.log(`🔗 API Integration: ${testWithIntegration ? 'Enabled' : 'Disabled'}`);
  
  if (testWithIntegration) {
    console.log(`🌐 API Base URL: ${baseUrl}`);
    console.log(`\n⚠️  Make sure your API server is running!`);
    console.log(`   Start with: node api/server.js`);
  }
  
  if (TEST_CONTRACTS.length === 0) {
    console.log(`\n⚠️  No test contracts configured for ${network}`);
    console.log(`   Network: ${NETWORK_NAMES[network] || network}`);
    console.log(`\n   💡 To test with your own contract:`);
    console.log(`   CONTRACT_ADDRESS=0xYourContract npm run test:retrieval`);
    console.log(`\n   📚 Make sure your contract is verified on the network's block explorer:`);
    if (network === 'camp-testnet') {
      console.log(`   https://camp-network-testnet.blockscout.com`);
    } else if (network === 'camp-netnet') {
      console.log(`   https://camp-network-mainnet.blockscout.com`);
    } else if (network === 'basecamp') {
      console.log(`   https://basecamp.cloud.blockscout.com`);
    } else if (network === 'base-sepolia' || network === 'basecamp-testnet') {
      console.log(`   https://sepolia.basescan.org`);
    }
    process.exit(0);
  }
  
  // Cleanup previous test outputs
  cleanup();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const results = [];
  
  // Run tests
  const contractsToTest = TEST_CONTRACTS;
  
  for (let i = 0; i < contractsToTest.length; i++) {
    const success = await runTest(contractsToTest[i], i);
    results.push({ testCase: contractsToTest[i], success });
  }
  
  // Summary
  section('Test Summary');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} Test ${i + 1}: ${r.testCase.name}`);
  });
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the retrieved contracts in:', OUTPUT_DIR);
    console.log('   2. Integrate into your audit workflow');
    console.log('   3. Add to api/routes/audit.js or api/routes/compliance.js');
    console.log('\n📚 Example integration:');
    console.log(`
    // Retrieve and audit from ${NETWORK_NAMES[network] || network}
    const { execSync } = require('child_process');
    
    router.post('/audit/from-address', async (req, res) => {
      const { contractAddress } = req.body;
      
      // Retrieve source from ${network}
      execSync(\`node scripts/retrieve-blockscout.js \${contractAddress} ./temp ${network}\`);
      
      // Read source
      const sourceCode = fs.readFileSync(\`./temp/\${contractAddress}/*.sol\`, 'utf8');
      const abi = JSON.parse(fs.readFileSync(\`./temp/\${contractAddress}/abi.json\`, 'utf8'));
      
      // Perform audit
      const audit = await performAudit(sourceCode);
      
      res.json({ ok: true, audit, contractAddress });
    });
    `);
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
  
  console.log(`\n💾 Test output preserved in: ${OUTPUT_DIR}`);
  console.log(`   Run 'rm -rf ${OUTPUT_DIR}' to clean up`);
  console.log(`\n🌐 Network used: ${NETWORK_NAMES[network] || network}`);
  console.log(`\n   📡 Available networks:`);
  console.log(`   - camp-testnet (default)`);
  console.log(`   - camp-netnet (mainnet)`);
  console.log(`   - basecamp`);
  console.log(`   - basecamp-testnet`);
  console.log(`   - boba-sepolia, avalanche-fuji, bsc-testnet`);
  console.log(`\n   Usage: NETWORK=camp-netnet npm run test:retrieval`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
