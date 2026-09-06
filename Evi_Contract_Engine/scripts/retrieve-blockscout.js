#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Retrieve contract source from Blockscout explorer
 * Usage: node retrieve-blockscout.js <CONTRACT_ADDRESS> [OUTPUT_DIR] [NETWORK]
 * 
 * Networks:
 *   basecamp        - Camp Network Mainnet (default)
 *   camp-testnet    - Camp Network Testnet V2
 *   base-sepolia    - Base Sepolia Testnet
 *   base            - Base Mainnet
 */

// Network configurations (matching hardhat.config.js)
const NETWORKS = {
  // Camp Networks
  'camp-testnet': {
    name: 'Camp Network Testnet V2',
    chainId: 325000,
    api: 'https://camp-network-testnet.blockscout.com/api',
    explorer: 'https://camp-network-testnet.blockscout.com'
  },
  'camp-90354': {
    name: 'Camp Original Testnet',
    chainId: 90354,
    api: 'https://camp-network-testnet.blockscout.com/api',
    explorer: 'https://camp-network-testnet.blockscout.com'
  },
  'camp-netnet': {
    name: 'Camp Network Mainnet',
    chainId: 325001,
    api: 'https://camp-network-mainnet.blockscout.com/api',
    explorer: 'https://camp-network-mainnet.blockscout.com'
  },
  'basecamp': {
    name: 'Basecamp',
    chainId: 123420001114,
    api: 'https://basecamp.cloud.blockscout.com/api',
    explorer: 'https://basecamp.cloud.blockscout.com'
  },
  // Base Networks (use Basescan, not Blockscout)
  'basecamp-testnet': {
    name: 'Base Sepolia',
    chainId: 84532,
    api: 'https://api-sepolia.basescan.org/api',
    explorer: 'https://sepolia.basescan.org',
    note: 'Uses Basescan API'
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    api: 'https://api-sepolia.basescan.org/api',
    explorer: 'https://sepolia.basescan.org',
    note: 'Uses Basescan API (requires API key)'
  },
  'basecamp-mainnet': {
    name: 'Base Mainnet',
    chainId: 8453,
    api: 'https://api.basescan.org/api',
    explorer: 'https://basescan.org',
    note: 'Uses Basescan API (requires API key)'
  },
  // Other supported networks with Blockscout
  'boba-sepolia': {
    name: 'Boba Sepolia',
    chainId: 28882,
    api: 'https://blockexplorer.sepolia.boba.network/api',
    explorer: 'https://blockexplorer.sepolia.boba.network'
  },
  'avalanche-fuji': {
    name: 'Avalanche Fuji Testnet',
    chainId: 43113,
    api: 'https://api-testnet.snowtrace.io/api',
    explorer: 'https://testnet.snowtrace.io',
    note: 'Uses Snowtrace API (may require API key)'
  },
  'bsc-testnet': {
    name: 'BSC Testnet',
    chainId: 97,
    api: 'https://api-testnet.bscscan.com/api',
    explorer: 'https://testnet.bscscan.com',
    note: 'Uses BscScan API (may require API key)'
  }
};

const CONTRACT_ADDRESS = process.argv[2];
const OUTPUT_DIR = process.argv[3] || './contracts';
const NETWORK = process.argv[4] || process.env.NETWORK || 'camp-testnet';

// Get network config
const networkConfig = NETWORKS[NETWORK];
if (!networkConfig) {
  console.error(`❌ Unknown network: ${NETWORK}`);
  console.error(`Available networks: ${Object.keys(NETWORKS).join(', ')}`);
  process.exit(1);
}

const BLOCKSCOUT_API = networkConfig.api;

if (!CONTRACT_ADDRESS) {
  console.error('❌ Usage: node retrieve-blockscout.js <CONTRACT_ADDRESS> [OUTPUT_DIR] [NETWORK]');
  console.error('');
  console.error('Available networks:');
  Object.entries(NETWORKS).forEach(([key, config]) => {
    console.error(`  ${key.padEnd(15)} - ${config.name}`);
  });
  console.error('');
  console.error('Examples:');
  console.error('  node retrieve-blockscout.js 0xABC... ./contracts camp-testnet');
  console.error('  NETWORK=camp-netnet node retrieve-blockscout.js 0xABC...');
  console.error('  node retrieve-blockscout.js 0xABC... ./contracts basecamp');
  process.exit(1);
}

async function getContractSource(address) {
  const url = `${BLOCKSCOUT_API}?module=contract&action=getsourcecode&address=${address}`;
  
  console.log(`🌐 Network: ${networkConfig.name}`);
  console.log(`🔍 Fetching: ${address}`);
  console.log(`📡 API: ${url}`);
  
  const response = await fetch(url);
  
  // Check if response is OK
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  // Try to parse JSON
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('❌ API returned non-JSON response:');
    console.error(text.substring(0, 500)); // Show first 500 chars
    throw new Error(`API returned invalid JSON. This usually means the contract is not verified on ${networkConfig.name}.`);
  }
  
  if (data.status !== '1' || !data.result || data.result.length === 0) {
    throw new Error(data.message || 'Contract not verified or not found on this network');
  }
  
  return data.result[0];
}

async function getContractABI(address) {
  const url = `${BLOCKSCOUT_API}?module=contract&action=getabi&address=${address}`;
  const response = await fetch(url);
  const data = await response.json();
  
  return data.status === '1' ? data.result : null;
}

function saveContract(contract, address) {
  const dir = path.join(OUTPUT_DIR, address);
  fs.mkdirSync(dir, { recursive: true });
  
  // Metadata
  const metadata = {
    address: address,
    name: contract.ContractName,
    compiler: contract.CompilerVersion,
    optimization: contract.OptimizationUsed === '1',
    runs: contract.Runs,
    evmVersion: contract.EVMVersion,
    constructorArgs: contract.ConstructorArguments,
    isProxy: contract.IsProxy === '1',
    implementation: contract.ImplementationAddress || null,
    licenseType: contract.LicenseType,
    retrievedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(dir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  console.log('  ✅ metadata.json');
  
  // Main source code
  if (contract.SourceCode) {
    // Check if multi-file (JSON format)
    if (contract.SourceCode.startsWith('{')) {
      try {
        // Remove extra braces if present
        let jsonStr = contract.SourceCode;
        if (jsonStr.startsWith('{{')) {
          jsonStr = jsonStr.slice(1, -1);
        }
        
        const sourceData = JSON.parse(jsonStr);
        const sources = sourceData.sources || sourceData;
        
        // Save each file
        Object.entries(sources).forEach(([filePath, fileData]) => {
          const content = fileData.content || fileData;
          const fullPath = path.join(dir, filePath);
          
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content);
          console.log(`  ✅ ${filePath}`);
        });
        
        // Compiler settings
        if (sourceData.settings) {
          fs.writeFileSync(
            path.join(dir, 'compiler-settings.json'),
            JSON.stringify(sourceData.settings, null, 2)
          );
          console.log('  ✅ compiler-settings.json');
        }
      } catch (e) {
        // Fallback to single file
        saveSingleFile(dir, contract);
      }
    } else {
      // Single file
      saveSingleFile(dir, contract);
    }
  }
  
  // Additional sources (for Sourcify verified contracts)
  if (contract.AdditionalSources && contract.AdditionalSources.length > 0) {
    contract.AdditionalSources.forEach(source => {
      const filePath = source.FileName || source.Filename || `additional_${Date.now()}.sol`;
      const fullPath = path.join(dir, filePath);
      
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, source.SourceCode);
      console.log(`  ✅ ${filePath}`);
    });
  }
  
  // ABI
  if (contract.ABI && contract.ABI !== 'Contract source code not verified') {
    fs.writeFileSync(
      path.join(dir, 'abi.json'),
      typeof contract.ABI === 'string' ? contract.ABI : JSON.stringify(contract.ABI, null, 2)
    );
    console.log('  ✅ abi.json');
  }
  
  console.log(`\n📦 Saved to: ${dir}`);
}

function saveSingleFile(dir, contract) {
  const fileName = `${contract.ContractName}.sol`;
  fs.writeFileSync(
    path.join(dir, fileName),
    contract.SourceCode
  );
  console.log(`  ✅ ${fileName}`);
}

async function main() {
  try {
    const contract = await getContractSource(CONTRACT_ADDRESS);
    
    if (!contract.SourceCode) {
      console.error('❌ Contract not verified');
      console.log(`Verify at: ${networkConfig.explorer}/contract-verification`);
      process.exit(1);
    }
    
    console.log(`✅ Found: ${contract.ContractName}`);
    saveContract(contract, CONTRACT_ADDRESS);
    
    // Show proxy info if applicable
    if (contract.IsProxy === '1' && contract.ImplementationAddress) {
      console.log(`\n🔗 This is a proxy contract`);
      console.log(`   Implementation: ${contract.ImplementationAddress}`);
      console.log(`   To retrieve implementation, run:`);
      console.log(`   node ${__filename} ${contract.ImplementationAddress}`);
    }
    
    console.log('\n✅ Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
