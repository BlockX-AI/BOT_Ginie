# AcademicChain Deployment Guide

This guide provides step-by-step instructions for deploying the AcademicChain smart contracts to the Camp Network Basecamp network.

## Prerequisites

1. Node.js (v14.x or later) and npm installed
2. A wallet with ETH on the Basecamp network
3. Git (to clone the repository)

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AcademicChain
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root and add the following:

```
# Network Configuration
# -----------------
CAMP_TESTNET_RPC_URL=https://rpc.testnet.campprotocol.xyz
BASECAMP_RPC_URL=https://rpc.basecamp.t.raas.gelato.cloud

# Private Keys
# -----------------
# IMPORTANT: Replace with your actual private key
# WARNING: Never commit your real private key to git or share it publicly
BASECAMP_PRIVATE_KEY=your_private_key_here

# Contract Verification
# -----------------
BASECAMP_EXPLORER_API_KEY=your_explorer_api_key_here
```

Replace `your_private_key_here` with your actual private key and `your_explorer_api_key_here` with your Blockscout API key if you want to verify contracts.

## Deployment

### Deploy to Basecamp Network

Run the deployment script with the Basecamp network configuration:

```bash
npx hardhat run scripts/deploy.js --network basecamp
```

The script will:
1. Deploy a mock Origin Protocol (in production, you would use the actual Camp Network Origin Protocol)
2. Deploy the ResearchPaper contract
3. Deploy the CitationRegistry contract
4. Deploy the RoyaltyDistributor contract
5. Link the contracts together
6. Log all contract addresses

### Expected Output

```
Starting deployment to basecamp
Deploying contracts with the account: 0xYourAddress
Account balance: 1000000000000000000

Deploying mock Origin Protocol...
MockOriginProtocol deployed to: 0xMockOriginProtocolAddress

Deploying ResearchPaper contract...
ResearchPaper deployed to: 0xResearchPaperAddress

Deploying CitationRegistry contract...
CitationRegistry deployed to: 0xCitationRegistryAddress

Deploying RoyaltyDistributor contract...
RoyaltyDistributor deployed to: 0xRoyaltyDistributorAddress

Setting up contract relationships...
Set CitationRegistry in ResearchPaper
Added ResearchPaper as citation recorder

----- Deployment Summary -----
Network: basecamp
MockOriginProtocol: 0xMockOriginProtocolAddress
ResearchPaper: 0xResearchPaperAddress
CitationRegistry: 0xCitationRegistryAddress
RoyaltyDistributor: 0xRoyaltyDistributorAddress
-----------------------------
```

## Contract Verification

To verify the contracts on the Blockscout explorer for the Basecamp network:

```bash
npx hardhat verify --network basecamp <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Example for ResearchPaper:

```bash
npx hardhat verify --network basecamp 0xResearchPaperAddress "Academic Research Paper" "ARP" "0xMockOriginProtocolAddress"
```

## Next Steps

After deployment:

1. **Record contract addresses** - Save the deployed contract addresses for frontend integration
2. **Test the contracts** - Interact with them through Hardhat tasks or scripts
3. **Integrate with frontend** - Use the addresses to connect your dApp to the contracts
4. **Register with Camp Network** - For production, register your dApp with Camp Network

## Troubleshooting

- **Insufficient funds**: Ensure your wallet has enough ETH on the Basecamp network
- **Nonce too high**: Try resetting your account in MetaMask
- **Gas estimation failed**: Check contract logic and constructor arguments

## Production Deployment Notes

For a production deployment:

1. Replace the MockOriginProtocol with the actual Camp Network Origin Protocol address
2. Set proper platform fees and treasury addresses in the RoyaltyDistributor
3. Deploy to the mainnet Camp Network once testing is complete
4. Register your dApp with Camp Network for official integration
