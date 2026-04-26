import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Missing PROXY_ADDRESS in environment");
  }

  const VaultV2 = await ethers.getContractFactory("VaultV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, VaultV2);
  await upgraded.waitForDeployment();

  console.log("Vault upgraded at proxy:", await upgraded.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
