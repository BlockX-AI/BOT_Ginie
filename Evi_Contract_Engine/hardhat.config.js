require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Normalize private keys to always include 0x prefix
const normalizeKey = (k) => (k ? (k.startsWith('0x') ? k : `0x${k}`) : undefined);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // Support multiple compiler versions to match generated contract pragmas
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true, // Enable the new IR-based code generator
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    "camp-testnet": {
      url: process.env.CAMP_TESTNET_RPC_URL || "https://325000.rpc.thirdweb.com",
      accounts: process.env.CAMP_PRIVATE_KEY ? [normalizeKey(process.env.CAMP_PRIVATE_KEY)] : [],
      chainId: 325000,
      // Camp Network Testnet V2 configuration
      verify: {
        etherscan: {
          apiUrl: "https://camp-network-testnet.blockscout.com/api",
          browserURL: "https://camp-network-testnet.blockscout.com",
        }
      }
    },
    // Camp Original Testnet (Chain ID: 90354)
    // Uses the RPC you provided: https://90354.rpc.thirdweb.com
    "camp-90354": {
      url: process.env.CAMP_TESTNET_90354_RPC_URL || "https://90354.rpc.thirdweb.com",
      accounts: process.env.CAMP_PRIVATE_KEY ? [normalizeKey(process.env.CAMP_PRIVATE_KEY)] : [],
      chainId: 90354,
      verify: {
        etherscan: {
          // Use the same Blockscout if applicable or update to the correct explorer for 90354
          apiUrl: process.env.CAMP_90354_EXPLORER_API || "https://camp-network-testnet.blockscout.com/api",
          browserURL: process.env.CAMP_90354_EXPLORER_BROWSER || "https://camp-network-testnet.blockscout.com",
        }
      }
    },
    "basecamp": {
      url: process.env.BASECAMP_RPC_URL || "https://rpc.basecamp.t.raas.gelato.cloud",
      accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
      chainId: 123420001114,
      verify: {
        etherscan: {
          apiUrl: "https://basecamp.cloud.blockscout.com/api",
          browserURL: "https://basecamp.cloud.blockscout.com/",
        }
      }
    },
    "camp-netnet": {
      url: process.env.CAMP_NETNET_RPC_URL || "https://mainnet.campprotocol.xyz",
      accounts: process.env.CAMP_PRIVATE_KEY ? [normalizeKey(process.env.CAMP_PRIVATE_KEY)] : [],
      chainId: 325001, // Camp Network mainnet chain ID
      verify: {
        etherscan: {
          apiUrl: "https://camp-network-mainnet.blockscout.com/api",
          browserURL: "https://camp-network-mainnet.blockscout.com",
        }
      }
    },
    "basecamp-testnet": {
      url: process.env.BASECAMP_TESTNET_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
      chainId: 84532,
    },
    "basecamp_mainnet": {
      url: process.env.BASECAMP_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
    },
    "basecamp-mainnet": {
      url: process.env.BASECAMP_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [],
    },
    // Boba Sepolia testnet (Chain ID: 28882)
    "boba-sepolia": {
      url: process.env.BOBA_SEPOLIA_RPC_URL || "https://sepolia.boba.network",
      accounts: process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : [],
      chainId: 28882,
    },
    // Avalanche Fuji testnet (Chain ID: 43113)
    "avalanche-fuji": {
      url: process.env.AVALANCHE_FUJI_RPC_URL || process.env.REACT_APP_NETWORK_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.AVALANCHE_PRIVATE_KEY ? [normalizeKey(process.env.AVALANCHE_PRIVATE_KEY)] : (process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : []),
      chainId: 43113,
      verify: {
        etherscan: {
          apiUrl: process.env.SNOWTRACE_TESTNET_API_URL || "https://api-testnet.snowtrace.io/api",
          browserURL: process.env.SNOWTRACE_TESTNET_BROWSER_URL || "https://testnet.snowtrace.io",
        }
      }
    },
    // BNB Smart Chain Testnet (Chain ID: 97)
    "bsc-testnet": {
      url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
      accounts: process.env.BSC_PRIVATE_KEY ? [normalizeKey(process.env.BSC_PRIVATE_KEY)] : (process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : (process.env.BASECAMP_PRIVATE_KEY ? [normalizeKey(process.env.BASECAMP_PRIVATE_KEY)] : [])),
      chainId: 97,
      verify: {
        etherscan: {
          apiUrl: process.env.BSCSCAN_TESTNET_API_URL || "https://api-testnet.bscscan.com/api",
          browserURL: process.env.BSCSCAN_TESTNET_BROWSER_URL || "https://testnet.bscscan.com",
        }
      }
    },
    // BOT Chain Mainnet (Chain ID: 677)
    "botchain": {
      url: process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai",
      accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [normalizeKey(process.env.BOT_CHAIN_PRIVATE_KEY)] : (process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : []),
      chainId: 677,
      gasPrice: "auto",
      timeout: 120000,
      verify: {
        etherscan: {
          apiUrl: process.env.BOT_CHAIN_EXPLORER_API || "https://scan.botchain.ai/api",
          browserURL: process.env.BOT_CHAIN_EXPLORER_BROWSER || "https://scan.botchain.ai",
        }
      }
    },
    // BOT Chain Testnet / Bohr Testnet (Chain ID: 968)
    "botchain-testnet": {
      url: process.env.BOT_CHAIN_TESTNET_RPC_URL || "https://rpc.bohr.life",
      accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [normalizeKey(process.env.BOT_CHAIN_PRIVATE_KEY)] : (process.env.PRIVATE_KEY ? [normalizeKey(process.env.PRIVATE_KEY)] : []),
      chainId: 968,
      gasPrice: "auto",
      timeout: 120000,
      verify: {
        etherscan: {
          apiUrl: process.env.BOT_CHAIN_TESTNET_EXPLORER_API || "https://scan.bohr.life/api",
          browserURL: process.env.BOT_CHAIN_TESTNET_EXPLORER_BROWSER || "https://scan.bohr.life",
        }
      }
    },
  },
  etherscan: {
    apiKey: {
      "basecamp-testnet": process.env.BASECAMP_EXPLORER_API_KEY || "",
      "basecamp-mainnet": process.env.BASECAMP_EXPLORER_API_KEY || "",
      "bsc-testnet": process.env.BSCSCAN_API_KEY || "",
      "botchain": process.env.BOT_CHAIN_EXPLORER_API_KEY || "abc",
      "botchain-testnet": process.env.BOT_CHAIN_EXPLORER_API_KEY || "abc",
    },
    customChains: [
      {
        network: "basecamp-testnet",
        chainId: 84532, // Base Sepolia chainId
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia-explorer.base.org",
        },
      },
      {
        network: "basecamp-mainnet",
        chainId: 8453, // BaseCAMP mainnet chainId
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "bsc-testnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
      {
        network: "botchain",
        chainId: 677,
        urls: {
          apiURL: process.env.BOT_CHAIN_EXPLORER_API || "https://scan.botchain.ai/api",
          browserURL: process.env.BOT_CHAIN_EXPLORER_BROWSER || "https://scan.botchain.ai",
        },
      },
      {
        network: "botchain-testnet",
        chainId: 968,
        urls: {
          apiURL: process.env.BOT_CHAIN_TESTNET_EXPLORER_API || "https://scan.bohr.life/api",
          browserURL: process.env.BOT_CHAIN_TESTNET_EXPLORER_BROWSER || "https://scan.bohr.life",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
