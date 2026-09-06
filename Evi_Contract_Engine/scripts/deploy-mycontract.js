const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const Factory = await hre.ethers.getContractFactory('MyContract');
  const c = await Factory.connect(deployer).deploy(); // no constructor args
  await c.waitForDeployment();

  const address = await c.getAddress();
  const result = {
    network: hre.network.name,
    deployer: deployer.address,
    contract: 'MyContract',
    address
  };
  console.log('DEPLOY_RESULT ' + JSON.stringify(result));
}

main().catch((e) => { console.error(e); process.exit(1); });