// Transaction utilities for wallet-based deployments
// Prepares unsigned transactions and monitors blockchain

const { ethers } = require('ethers');
const logger = require('./logger');

// Network configurations - MATCHES hardhat.config.js EXACTLY
const NETWORK_CONFIG = {
  // BaseCamp - THE DEFAULT (Gelato RaaS)
  'basecamp': {
    chainId: 123420001114,
    name: 'BaseCamp',
    rpcUrl: process.env.BASECAMP_RPC_URL || 'https://rpc.basecamp.t.raas.gelato.cloud',
    explorer: 'https://basecamp.cloud.blockscout.com'
  },
  
  // Camp Network Testnet (325000)
  'camp-testnet': {
    chainId: 325000,
    name: 'Camp Network Testnet',
    rpcUrl: process.env.CAMP_TESTNET_RPC_URL || 'https://325000.rpc.thirdweb.com',
    explorer: 'https://camp-network-testnet.blockscout.com'
  },
  
  // Camp Original Testnet (90354)
  'camp-90354': {
    chainId: 90354,
    name: 'Camp Testnet 90354',
    rpcUrl: process.env.CAMP_TESTNET_90354_RPC_URL || 'https://90354.rpc.thirdweb.com',
    explorer: 'https://camp-network-testnet.blockscout.com'
  },
  
  // Camp Network Mainnet
  'camp-netnet': {
    chainId: 325001,
    name: 'Camp Network Mainnet',
    rpcUrl: process.env.CAMP_NETNET_RPC_URL || 'https://mainnet.campprotocol.xyz',
    explorer: 'https://camp-network-mainnet.blockscout.com'
  },
  
  // Base Sepolia (used by basecamp-testnet alias)
  'basecamp-testnet': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASECAMP_TESTNET_RPC_URL || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org'
  },
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASECAMP_TESTNET_RPC_URL || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org'
  },
  
  // Base Mainnet
  'basecamp-mainnet': {
    chainId: 8453,
    name: 'Base Mainnet',
    rpcUrl: process.env.BASECAMP_MAINNET_RPC_URL || 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  'base-mainnet': {
    chainId: 8453,
    name: 'Base Mainnet',
    rpcUrl: process.env.BASECAMP_MAINNET_RPC_URL || 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  
  // Other Networks
  'boba-sepolia': {
    chainId: 28882,
    name: 'Boba Sepolia',
    rpcUrl: process.env.BOBA_SEPOLIA_RPC_URL || 'https://sepolia.boba.network',
    explorer: 'https://testnet.bobascan.com'
  },
  'avalanche-fuji': {
    chainId: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io'
  },
  'bsc-testnet': {
    chainId: 97,
    name: 'BSC Testnet',
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
    explorer: 'https://testnet.bscscan.com'
  }
};

/**
 * Get network configuration
 * @param {string} networkName - Network name
 * @returns {object} Network config
 */
function getNetworkConfig(networkName) {
  const normalized = networkName.toLowerCase().replace(/_/g, '-');
  const config = NETWORK_CONFIG[normalized];
  
  if (!config) {
    logger.warn({ networkName }, 'Unknown network, using basecamp-testnet');
    return NETWORK_CONFIG['basecamp-testnet'];
  }
  
  return config;
}

/**
 * Get provider for network
 * @param {string} networkName - Network name
 * @returns {ethers.JsonRpcProvider} Provider instance
 */
function getProvider(networkName) {
  const config = getNetworkConfig(networkName);
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

/**
 * Prepare unsigned deployment transaction
 * @param {object} params - Parameters
 * @returns {object} Unsigned transaction data
 */
async function prepareUnsignedDeployTx({ bytecode, abi, constructorArgs = [], network = 'basecamp-testnet' }) {
  try {
    const config = getNetworkConfig(network);
    const provider = getProvider(network);
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode);
    
    // Get deployment transaction data
    const deployTx = await factory.getDeployTransaction(...constructorArgs);
    
    // Get current gas parameters from network
    let feeData;
    try {
      feeData = await provider.getFeeData();
    } catch (e) {
      logger.warn({ network, error: e.message }, 'Failed to fetch fee data, using defaults');
      feeData = {
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
      };
    }
    
    // Estimate gas limit
    let gasLimit = 3000000; // Default
    try {
      // Estimate gas by simulating with a dummy address
      const dummyAddress = '0x' + '1'.repeat(40);
      const estimatedGas = await provider.estimateGas({
        from: dummyAddress,
        data: deployTx.data
      });
      gasLimit = Math.ceil(Number(estimatedGas) * 1.2); // Add 20% buffer
    } catch (e) {
      logger.warn({ network, error: e.message }, 'Gas estimation failed, using default');
    }
    
    // Build unsigned transaction
    const unsignedTx = {
      to: null, // null for contract creation
      data: deployTx.data,
      value: '0',
      gasLimit: gasLimit.toString(),
      chainId: config.chainId,
      type: 2, // EIP-1559
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null
    };
    
    // Calculate estimated cost
    const maxFee = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
    const estimatedCostWei = BigInt(gasLimit) * BigInt(maxFee);
    const estimatedCostEth = ethers.formatEther(estimatedCostWei);
    
    logger.info({ 
      network, 
      gasLimit, 
      estimatedCostEth,
      chainId: config.chainId
    }, 'Unsigned transaction prepared');
    
    return {
      unsignedTx,
      estimatedGas: estimatedCostEth,
      gasLimit,
      chainId: config.chainId,
      networkName: config.name,
      explorerUrl: config.explorer
    };
    
  } catch (e) {
    logger.error({ error: e.message, network }, 'Failed to prepare unsigned transaction');
    throw new Error(`Transaction preparation failed: ${e.message}`);
  }
}

/**
 * Monitor transaction on blockchain
 * @param {string} txHash - Transaction hash
 * @param {string} networkName - Network name
 * @param {number} confirmations - Required confirmations (default 1)
 * @returns {Promise<object>} Transaction receipt
 */
async function monitorTransaction(txHash, networkName, confirmations = 1) {
  try {
    const provider = getProvider(networkName);
    const config = getNetworkConfig(networkName);
    
    logger.info({ 
      txHash, 
      network: networkName, 
      confirmations 
    }, 'Monitoring transaction');
    
    // Wait for transaction receipt
    const receipt = await provider.waitForTransaction(txHash, confirmations, 120000); // 2 min timeout
    
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }
    
    const success = receipt.status === 1;
    
    const result = {
      success,
      txHash,
      contractAddress: receipt.contractAddress,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasUsed ? receipt.gasUsed.toString() : null,
      confirmations: receipt.confirmations || confirmations,
      explorerUrl: `${config.explorer}/tx/${txHash}`,
      receipt
    };
    
    if (success) {
      logger.info({ 
        txHash, 
        contractAddress: receipt.contractAddress,
        blockNumber: receipt.blockNumber 
      }, 'Transaction confirmed successfully');
    } else {
      logger.error({ txHash }, 'Transaction failed on-chain');
    }
    
    return result;
    
  } catch (e) {
    logger.error({ 
      txHash, 
      network: networkName, 
      error: e.message 
    }, 'Transaction monitoring failed');
    throw new Error(`Transaction monitoring failed: ${e.message}`);
  }
}

/**
 * Verify transaction is actually deployed
 * @param {string} txHash - Transaction hash
 * @param {string} networkName - Network name
 * @returns {Promise<object>} Verification result
 */
async function verifyTransaction(txHash, networkName) {
  try {
    const provider = getProvider(networkName);
    
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { valid: false, error: 'Receipt not found' };
    }
    
    return {
      valid: true,
      contractAddress: receipt.contractAddress,
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: receipt.blockNumber
    };
    
  } catch (e) {
    logger.error({ txHash, error: e.message }, 'Transaction verification failed');
    return { valid: false, error: e.message };
  }
}

/**
 * Get transaction status
 * @param {string} txHash - Transaction hash
 * @param {string} networkName - Network name
 * @returns {Promise<object>} Status
 */
async function getTransactionStatus(txHash, networkName) {
  try {
    const provider = getProvider(networkName);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      // Check if transaction exists in mempool
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        return { status: 'pending', inMempool: true };
      }
      return { status: 'not_found' };
    }
    
    return {
      status: receipt.status === 1 ? 'success' : 'failed',
      confirmations: receipt.confirmations || 0,
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.contractAddress
    };
    
  } catch (e) {
    logger.error({ txHash, error: e.message }, 'Failed to get transaction status');
    return { status: 'error', error: e.message };
  }
}

module.exports = {
  getNetworkConfig,
  getProvider,
  prepareUnsignedDeployTx,
  monitorTransaction,
  verifyTransaction,
  getTransactionStatus
};
