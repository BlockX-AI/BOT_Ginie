#!/usr/bin/env node
/**
 * Batch Contract Retrieval from CSV
 * 
 * Reads contract addresses from a CSV file and retrieves only the main
 * contract source code (excluding dependencies) to a training_data directory.
 * 
 * Usage:
 *   node scripts/batch-retrieve-contracts.js <CSV_FILE> [NETWORK] [OUTPUT_DIR]
 * 
 * Example:
 *   node scripts/batch-retrieve-contracts.js contracts.csv basecamp ./training_data
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const CSV_FILE = process.argv[2];
const NETWORK = process.argv[3] || 'basecamp';
const OUTPUT_DIR = process.argv[4] || './training_data';

if (!CSV_FILE) {
  console.error('❌ Usage: node batch-retrieve-contracts.js <CSV_FILE> [NETWORK] [OUTPUT_DIR]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/batch-retrieve-contracts.js contracts.csv basecamp ./training_data');
  process.exit(1);
}

if (!fs.existsSync(CSV_FILE)) {
  console.error(`❌ CSV file not found: ${CSV_FILE}`);
  process.exit(1);
}

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Created directory: ${OUTPUT_DIR}`);
}

/**
 * Parse CSV file and extract unique contract addresses
 * Assumes "To" column contains contract addresses
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log(`📋 CSV Headers: ${header.join(', ')}`);
  
  // Find contract address column (try multiple column names)
  const possibleColumns = ['contractaddress', 'to', 'toaddress', 'contract', 'address'];
  let toIndex = -1;
  let columnName = '';
  
  for (const col of possibleColumns) {
    toIndex = header.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '') === col);
    if (toIndex !== -1) {
      columnName = header[toIndex];
      break;
    }
  }
  
  if (toIndex === -1) {
    throw new Error('CSV must have a contract address column (ContractAddress, To, ToAddress, Contract, or Address)');
  }
  
  console.log(`✅ Using column: "${columnName}" for contract addresses`);
  
  // Extract unique addresses
  const addresses = new Set();
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const address = values[toIndex];
    
    // Validate address format (starts with 0x, 42 chars)
    if (address && address.startsWith('0x') && address.length === 42) {
      addresses.add(address.toLowerCase());
    }
  }
  
  return Array.from(addresses);
}

/**
 * Retrieve contract and extract only the main .sol file
 */
async function retrieveMainContract(address, network, outputDir) {
  const tempDir = path.join(__dirname, '..', 'tmp', 'batch', address);
  
  try {
    // Step 1: Retrieve contract to temp directory
    console.log(`  📥 Retrieving ${address}...`);
    const scriptPath = path.join(__dirname, 'retrieve-blockscout.js');
    execSync(
      `node "${scriptPath}" ${address} "${tempDir}" ${network}`,
      { stdio: 'pipe' }
    );
    
    // Step 2: Find the contract directory
    const contractDir = path.join(tempDir, address);
    if (!fs.existsSync(contractDir)) {
      throw new Error(`Contract directory not found: ${contractDir}`);
    }
    
    // Step 3: Read metadata to get contract name
    const metadataPath = path.join(contractDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('metadata.json not found');
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const contractName = metadata.name || 'UnknownContract';
    
    // Step 4: Find the main contract file (usually <ContractName>.sol in root)
    const mainFile = `${contractName}.sol`;
    const mainFilePath = path.join(contractDir, mainFile);
    
    if (!fs.existsSync(mainFilePath)) {
      // Try to find any .sol file in the root directory
      const files = fs.readdirSync(contractDir);
      const solFiles = files.filter(f => f.endsWith('.sol') && !f.includes('/'));
      
      if (solFiles.length === 0) {
        throw new Error('No main .sol file found');
      }
      
      // Use the first .sol file found
      const foundFile = solFiles[0];
      const sourcePath = path.join(contractDir, foundFile);
      const destPath = path.join(outputDir, foundFile);
      
      fs.copyFileSync(sourcePath, destPath);
      console.log(`  ✅ Saved: ${foundFile} (${metadata.compiler || 'unknown compiler'})`);
      
      return { success: true, contractName: foundFile.replace('.sol', ''), file: foundFile };
    } else {
      // Copy main contract file to output directory
      const destPath = path.join(outputDir, mainFile);
      fs.copyFileSync(mainFilePath, destPath);
      console.log(`  ✅ Saved: ${mainFile} (${metadata.compiler || 'unknown compiler'})`);
      
      return { success: true, contractName, file: mainFile };
    }
    
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       Batch Contract Retrieval for Training Data          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📂 CSV File: ${CSV_FILE}`);
  console.log(`🌐 Network: ${NETWORK}`);
  console.log(`📁 Output Directory: ${OUTPUT_DIR}\n`);
  
  // Parse CSV
  console.log('📋 Parsing CSV file...');
  const addresses = parseCSV(CSV_FILE);
  console.log(`✅ Found ${addresses.length} unique contract addresses\n`);
  
  // Process each contract
  const results = {
    success: [],
    failed: []
  };
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    console.log(`\n[${i + 1}/${addresses.length}] Processing: ${address}`);
    
    const result = await retrieveMainContract(address, NETWORK, OUTPUT_DIR);
    
    if (result.success) {
      results.success.push({ address, ...result });
    } else {
      results.failed.push({ address, error: result.error });
    }
    
    // Rate limiting - wait 2 seconds between requests
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                        Summary                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✅ Successfully retrieved: ${results.success.length} contracts`);
  console.log(`❌ Failed: ${results.failed.length} contracts\n`);
  
  if (results.success.length > 0) {
    console.log('📋 Retrieved contracts:');
    results.success.forEach(({ contractName, file }) => {
      console.log(`   - ${file}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed contracts:');
    results.failed.forEach(({ address, error }) => {
      console.log(`   - ${address}: ${error}`);
    });
  }
  
  console.log(`\n📁 All contract files saved to: ${OUTPUT_DIR}`);
  console.log(`\n🎉 Done!\n`);
  
  // Save summary to JSON
  const summaryPath = path.join(OUTPUT_DIR, 'retrieval-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: NETWORK,
    totalAddresses: addresses.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    success: results.success,
    failed: results.failed
  }, null, 2));
  
  console.log(`📊 Summary saved to: ${summaryPath}\n`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
