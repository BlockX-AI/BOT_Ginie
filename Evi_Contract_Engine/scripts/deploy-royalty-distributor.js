// scripts/deploy-royalty-distributor.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  const ORIGIN_PROTOCOL = process.env.ORIGIN_PROTOCOL;
  const TREASURY = process.env.TREASURY || deployer.address;
  const PLATFORM_FEE_BPS = process.env.PLATFORM_FEE_BPS || "500"; // default 5%

  if (!ORIGIN_PROTOCOL || ORIGIN_PROTOCOL === "") {
    throw new Error("ORIGIN_PROTOCOL is required (address of IOriginProtocol implementation)");
  }

  console.log(`Deploying RoyaltyDistributor to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Params => originProtocol: ${ORIGIN_PROTOCOL}, treasury: ${TREASURY}, platformFeeBps: ${PLATFORM_FEE_BPS}`);

  const RoyaltyDistributor = await hre.ethers.getContractFactory("RoyaltyDistributor");
  const distributor = await RoyaltyDistributor.connect(deployer).deploy(ORIGIN_PROTOCOL);
  await distributor.waitForDeployment();
  const address = await distributor.getAddress();

  // Configure treasury and platform fee
  if (TREASURY && TREASURY !== deployer.address) {
    const txT = await distributor.connect(deployer).updateTreasuryAddress(TREASURY);
    await txT.wait();
  }
  const bps = Number(PLATFORM_FEE_BPS);
  if (!Number.isNaN(bps)) {
    const txF = await distributor.connect(deployer).updatePlatformFee(bps);
    await txF.wait();
  }

  const result = {
    network,
    deployer: deployer.address,
    contract: "RoyaltyDistributor",
    address,
    params: { originProtocol: ORIGIN_PROTOCOL, treasury: TREASURY, platformFeeBps: Number(PLATFORM_FEE_BPS) },
  };

  console.log(`DEPLOY_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
