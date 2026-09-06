#!/usr/bin/env node
/**
 * Quick script to check if a contract is verified on a network
 * Usage: node scripts/check-contract.js <ADDRESS> <NETWORK>
 */

const CONTRACT_ADDRESS = process.argv[2];
const NETWORK = process.argv[3] || 'camp-testnet';

const NETWORKS = {
  'camp-testnet': 'https://camp-network-testnet.blockscout.com',
  'camp-netnet': 'https://camp-network-mainnet.blockscout.com',
  'basecamp': 'https://basecamp.cloud.blockscout.com',
  'base-sepolia': 'https://sepolia.basescan.org',
};

if (!CONTRACT_ADDRESS) {
  console.error('Usage: node check-contract.js <CONTRACT_ADDRESS> [NETWORK]');
  console.error('Example: node check-contract.js 0x123... camp-testnet');
  process.exit(1);
}

const explorerUrl = NETWORKS[NETWORK];
if (!explorerUrl) {
  console.error(`Unknown network: ${NETWORK}`);
  console.error(`Available: ${Object.keys(NETWORKS).join(', ')}`);
  process.exit(1);
}

console.log(`\n🔍 Checking contract on ${NETWORK}...`);
console.log(`📍 Address: ${CONTRACT_ADDRESS}`);
console.log(`🌐 Explorer: ${explorerUrl}/address/${CONTRACT_ADDRESS}`);
console.log(`\n✅ Visit the link above to check if your contract is verified`);
console.log(`\n💡 If "Contract" tab shows source code → Contract is verified`);
console.log(`   If "Contract" tab is missing → Contract is NOT verified or doesn't exist\n`);
