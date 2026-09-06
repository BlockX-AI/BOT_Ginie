// scripts/deploy-research-paper.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  const NAME = process.env.RP_NAME || process.env.NAME || "ResearchPaper";
  const SYMBOL = process.env.RP_SYMBOL || process.env.SYMBOL || "RPR";
  const ORIGIN_PROTOCOL = process.env.ORIGIN_PROTOCOL;

  if (!ORIGIN_PROTOCOL || ORIGIN_PROTOCOL === "") {
    throw new Error("ORIGIN_PROTOCOL is required (address of IOriginProtocol implementation)");
  }

  console.log(`Deploying ResearchPaper to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Params => name: ${NAME}, symbol: ${SYMBOL}, originProtocol: ${ORIGIN_PROTOCOL}`);

  const ResearchPaper = await hre.ethers.getContractFactory("ResearchPaper");
  const researchPaper = await ResearchPaper.connect(deployer).deploy(NAME, SYMBOL, ORIGIN_PROTOCOL);
  await researchPaper.waitForDeployment();
  const address = await researchPaper.getAddress();

  const result = {
    network,
    deployer: deployer.address,
    contract: "ResearchPaper",
    address,
    params: { name: NAME, symbol: SYMBOL, originProtocol: ORIGIN_PROTOCOL },
  };

  console.log(`DEPLOY_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
