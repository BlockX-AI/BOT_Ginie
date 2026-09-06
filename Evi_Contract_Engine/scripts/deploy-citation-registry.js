// scripts/deploy-citation-registry.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying CitationRegistry to ${network}`);
  console.log(`Deployer: ${deployer.address}`);

  const CitationRegistry = await hre.ethers.getContractFactory("CitationRegistry");
  const registry = await CitationRegistry.connect(deployer).deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  const result = {
    network,
    deployer: deployer.address,
    contract: "CitationRegistry",
    address,
    params: {},
  };

  console.log(`DEPLOY_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
