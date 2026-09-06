// scripts/deploy-academic-suite.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  // Inputs via ENV
  const RP_NAME = process.env.RP_NAME || "ResearchPaper";
  const RP_SYMBOL = process.env.RP_SYMBOL || "RPR";
  const ORIGIN_PROTOCOL = process.env.ORIGIN_PROTOCOL; // REQUIRED
  const TREASURY = process.env.TREASURY || deployer.address;
  const PLATFORM_FEE_BPS = process.env.PLATFORM_FEE_BPS || "500"; // 5%

  if (!ORIGIN_PROTOCOL || ORIGIN_PROTOCOL === "") {
    throw new Error("ORIGIN_PROTOCOL is required (address of IOriginProtocol implementation)");
  }

  console.log(`Deploying Academic Suite to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`OriginProtocol: ${ORIGIN_PROTOCOL}`);
  console.log(`ResearchPaper: ${RP_NAME} (${RP_SYMBOL})`);
  console.log(`Treasury: ${TREASURY}, PlatformFeeBps: ${PLATFORM_FEE_BPS}`);

  // Deploy CitationRegistry
  const CitationRegistry = await hre.ethers.getContractFactory("CitationRegistry");
  const citationRegistry = await CitationRegistry.connect(deployer).deploy();
  await citationRegistry.waitForDeployment();
  const citationRegistryAddress = await citationRegistry.getAddress();
  console.log(`CitationRegistry deployed at: ${citationRegistryAddress}`);

  // Deploy ResearchPaper
  const ResearchPaper = await hre.ethers.getContractFactory("ResearchPaper");
  const researchPaper = await ResearchPaper.connect(deployer).deploy(RP_NAME, RP_SYMBOL, ORIGIN_PROTOCOL);
  await researchPaper.waitForDeployment();
  const researchPaperAddress = await researchPaper.getAddress();
  console.log(`ResearchPaper deployed at: ${researchPaperAddress}`);

  // Wire: set citation registry in ResearchPaper
  const txSet = await researchPaper.connect(deployer).setCitationRegistry(citationRegistryAddress);
  await txSet.wait();
  console.log(`ResearchPaper setCitationRegistry(${citationRegistryAddress}) done`);

  // Deploy RoyaltyDistributor
  const RoyaltyDistributor = await hre.ethers.getContractFactory("RoyaltyDistributor");
  const royaltyDistributor = await RoyaltyDistributor.connect(deployer).deploy(ORIGIN_PROTOCOL);
  await royaltyDistributor.waitForDeployment();
  const royaltyDistributorAddress = await royaltyDistributor.getAddress();
  console.log(`RoyaltyDistributor deployed at: ${royaltyDistributorAddress}`);

  // Configure treasury and fee if different from defaults
  if (TREASURY && TREASURY !== deployer.address) {
    const txT = await royaltyDistributor.connect(deployer).updateTreasuryAddress(TREASURY);
    await txT.wait();
    console.log(`RoyaltyDistributor treasury set to ${TREASURY}`);
  }
  const feeBps = Number(PLATFORM_FEE_BPS);
  if (!Number.isNaN(feeBps)) {
    const txF = await royaltyDistributor.connect(deployer).updatePlatformFee(feeBps);
    await txF.wait();
    console.log(`RoyaltyDistributor platform fee set to ${feeBps} bps`);
  }

  // Persist deployment info
  const fs = require("fs");
  const path = require("path");
  const info = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    params: {
      RP_NAME,
      RP_SYMBOL,
      ORIGIN_PROTOCOL,
      TREASURY,
      PLATFORM_FEE_BPS: String(PLATFORM_FEE_BPS),
    },
    contracts: {
      CitationRegistry: citationRegistryAddress,
      ResearchPaper: researchPaperAddress,
      RoyaltyDistributor: royaltyDistributorAddress,
    },
  };
  const dir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = path.join(dir, `${network}-academic-suite-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
  console.log(`Saved deployment to ${file}`);

  const result = {
    network,
    deployer: deployer.address,
    citationRegistry: citationRegistryAddress,
    researchPaper: researchPaperAddress,
    royaltyDistributor: royaltyDistributorAddress,
    params: {
      name: RP_NAME,
      symbol: RP_SYMBOL,
      originProtocol: ORIGIN_PROTOCOL,
      treasury: TREASURY,
      platformFeeBps: Number(PLATFORM_FEE_BPS),
    },
  };
  console.log(`DEPLOY_SUITE_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
