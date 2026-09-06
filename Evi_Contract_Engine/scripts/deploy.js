// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`Starting deployment to ${network}`);

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Account balance: ${balance.toString()}`);

  // First deploy the Mock Origin Protocol (in production, you'd use the actual Origin Protocol)
  console.log("Deploying mock Origin Protocol...");
  const MockOriginProtocol = await hre.ethers.getContractFactory("MockOriginProtocol");
  const mockOriginProtocol = await MockOriginProtocol.connect(deployer).deploy();
  const mockOriginReceipt = await mockOriginProtocol.waitForDeployment();
  console.log(`MockOriginProtocol deployed to: ${await mockOriginProtocol.getAddress()}`);
  
  // Add a small delay between deployments
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Deploy the ResearchPaper contract
  console.log("Deploying ResearchPaper contract...");
  const ResearchPaper = await hre.ethers.getContractFactory("ResearchPaper");
  const mockOriginAddress = await mockOriginProtocol.getAddress();
  const researchPaper = await ResearchPaper.connect(deployer).deploy("Academic Research Paper", "ARP", mockOriginAddress);
  const researchPaperReceipt = await researchPaper.waitForDeployment();
  console.log(`ResearchPaper deployed to: ${await researchPaper.getAddress()}`);
  
  // Add a small delay between deployments
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Deploy the CitationRegistry contract
  console.log("Deploying CitationRegistry contract...");
  const CitationRegistry = await hre.ethers.getContractFactory("CitationRegistry");
  const citationRegistry = await CitationRegistry.connect(deployer).deploy();
  const citationRegistryReceipt = await citationRegistry.waitForDeployment();
  console.log(`CitationRegistry deployed to: ${await citationRegistry.getAddress()}`);
  
  // Add a small delay between deployments
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Deploy the RoyaltyDistributor contract
  console.log("Deploying RoyaltyDistributor contract...");
  const RoyaltyDistributor = await hre.ethers.getContractFactory("RoyaltyDistributor");
  const royaltyDistributor = await RoyaltyDistributor.connect(deployer).deploy(mockOriginAddress);
  const royaltyDistributorReceipt = await royaltyDistributor.waitForDeployment();
  console.log(`RoyaltyDistributor deployed to: ${await royaltyDistributor.getAddress()}`);
  
  // Add a small delay between deployments
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Set up contract relationships
  console.log("Setting up contract relationships...");
  
  const citationRegistryAddress = await citationRegistry.getAddress();
  const researchPaperAddress = await researchPaper.getAddress();
  
  // Set CitationRegistry in ResearchPaper
  const setCitationTx = await researchPaper.setCitationRegistry(citationRegistryAddress);
  await setCitationTx.wait();
  console.log("Set CitationRegistry in ResearchPaper");
  
  // Add ResearchPaper as a citation recorder
  const addRecorderTx = await citationRegistry.addCitationRecorder(researchPaperAddress);
  await addRecorderTx.wait();
  console.log("Added ResearchPaper as citation recorder");

  console.log("\n----- Deployment Summary -----");
  console.log(`Network: ${network}`);
  console.log(`MockOriginProtocol: ${await mockOriginProtocol.getAddress()}`);
  console.log(`ResearchPaper: ${await researchPaper.getAddress()}`);
  console.log(`CitationRegistry: ${await citationRegistry.getAddress()}`);
  console.log(`RoyaltyDistributor: ${await royaltyDistributor.getAddress()}`);
  console.log("-----------------------------\n");

  // Save deployment info to a file for future reference
  const fs = require('fs');
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    contracts: {
      MockOriginProtocol: await mockOriginProtocol.getAddress(),
      ResearchPaper: await researchPaper.getAddress(),
      CitationRegistry: await citationRegistry.getAddress(),
      RoyaltyDistributor: await royaltyDistributor.getAddress()
    }
  };

  // Create deployments directory if it doesn't exist
  const dir = './deployments';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(
    `./deployments/${network}-deployment-${Date.now()}.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment information saved to ./deployments/${network}-deployment-${Date.now()}.json`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
