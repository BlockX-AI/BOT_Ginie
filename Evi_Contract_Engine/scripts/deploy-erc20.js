// scripts/deploy-erc20.js
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;

  // Inputs via ENV (preferred) or positional args: [name, symbol, initialSupplyTokens, owner(optional)]
  const args = process.argv.slice(2);
  const name = process.env.NAME || args[0] || "Business Token";
  const symbol = process.env.SYMBOL || args[1] || "BUS";
  const initialSupplyTokens = process.env.INITIAL_SUPPLY || args[2] || "1000000"; // tokens
  const ownerArg = process.env.OWNER || args[3];

  const [deployer] = await hre.ethers.getSigners();
  const owner = ownerArg && ownerArg !== "" ? ownerArg : deployer.address;

  console.log(`Deploying BusinessToken to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Token: ${name} (${symbol}), initialSupply: ${initialSupplyTokens}`);

  const initialSupplyWei = hre.ethers.parseUnits(initialSupplyTokens, 18);

  const BusinessToken = await hre.ethers.getContractFactory("BusinessToken");
  // Retry deploy with fee bumping to avoid replacement-underpriced during bursts
  let token;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const feeData = await hre.ethers.provider.getFeeData();
      let overrides = {};
      const parseGwei = (v) => hre.ethers.parseUnits(String(v), 'gwei');
      const bump = (value, pct) => (value * BigInt(100 + pct)) / 100n;
      // Prefer EIP-1559 if available
      if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
        const baseMaxFee = feeData.maxFeePerGas || parseGwei(30);
        const basePriority = feeData.maxPriorityFeePerGas || parseGwei(2);
        const bumpedMaxFee = bump(baseMaxFee, 10 + attempt * 15); // 10%, 25%, 40%
        const bumpedPriority = bump(basePriority, 20 + attempt * 20); // 20%, 40%, 60%
        overrides = { maxFeePerGas: bumpedMaxFee, maxPriorityFeePerGas: bumpedPriority };
      } else {
        const base = feeData.gasPrice || parseGwei(30);
        const bumped = bump(base, 15 + attempt * 20); // 15%, 35%, 55%
        overrides = { gasPrice: bumped };
      }
      token = await BusinessToken.connect(deployer).deploy(name, symbol, initialSupplyWei, owner, overrides);
      await token.waitForDeployment();
      break;
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/replacement transaction underpriced/i.test(msg) || /nonce (has|too low)/i.test(msg)) {
        console.warn(`Deploy attempt ${attempt + 1} failed due to tx pricing/nonce. Retrying with higher fees...`);
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        if (attempt === 2) throw e;
      } else {
        throw e;
      }
    }
  }

  const address = await token.getAddress();
  console.log(`BusinessToken deployed at: ${address}`);

  // Persist deployment info
  const fs = require("fs");
  const path = require("path");
  const info = {
    network,
    timestamp: new Date().toISOString(),
    contracts: { BusinessToken: address },
    params: { name, symbol, initialSupplyTokens, owner }
  };
  const dir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = path.join(dir, `${network}-business-token-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
  console.log(`Saved deployment to ${file}`);

  // Output machine-readable result
  const result = { network, address, name, symbol, initialSupplyTokens, owner };
  console.log(`DEPLOY_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
