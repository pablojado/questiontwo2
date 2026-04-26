import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Missing PROXY_ADDRESS in environment");
  }

  const v1 = await ethers.getContractAt("VaultV1", proxyAddress);
  const beforeTel = await v1.totalEthLocked();
  const beforeMultiplier = await v1.rewardMultiplier();

  const VaultV2 = await ethers.getContractFactory("VaultV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, VaultV2);
  await upgraded.waitForDeployment();

  const v2 = await ethers.getContractAt("VaultV2", proxyAddress);
  const tx = await v2.doubleRewardMultiplier();
  await tx.wait();

  const afterTel = await v2.totalEthLocked();
  const afterMultiplier = await v2.rewardMultiplier();

  console.log("Proxy:", proxyAddress);
  console.log("TEL before:", beforeTel.toString());
  console.log("TEL after :", afterTel.toString());
  console.log("Multiplier before:", beforeMultiplier.toString());
  console.log("Multiplier after :", afterMultiplier.toString());

  if (beforeTel !== afterTel) {
    throw new Error("Total ETH Locked changed after upgrade");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
