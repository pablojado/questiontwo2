import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const VaultV1 = await ethers.getContractFactory("VaultV1");
  const rewardMultiplier = ethers.parseUnits("0.12", 18); // 12% APR in 1e18 precision

  const proxy = await upgrades.deployProxy(VaultV1, [rewardMultiplier, deployer.address], {
    kind: "uups",
    initializer: "initialize"
  });

  await proxy.waitForDeployment();

  console.log("Vault proxy deployed at:", await proxy.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
