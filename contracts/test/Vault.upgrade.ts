import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Vault UUPS upgrade flow", function () {
  it("preserves TEL and user principal after upgrade and doubles multiplier", async function () {
    const [owner, user] = await ethers.getSigners();
    const initialMultiplier = ethers.parseUnits("0.10", 18);

    const VaultV1 = await ethers.getContractFactory("VaultV1");
    const proxy = (await upgrades.deployProxy(VaultV1, [initialMultiplier, owner.address], {
      kind: "uups",
      initializer: "initialize"
    })) as any;
    await proxy.waitForDeployment();

    const depositAmount = ethers.parseEther("1");
    await proxy.connect(user).deposit({ value: depositAmount });
    await time.increase(30 * 24 * 60 * 60);

    const rewardBefore = await proxy.accruedRewardOf(user.address);
    expect(rewardBefore).to.be.gt(0n);

    const telBefore = await proxy.totalEthLocked();
    const principalBefore = await proxy.principalOf(user.address);

    const VaultV2 = await ethers.getContractFactory("VaultV2");
    const proxyV2 = (await upgrades.upgradeProxy(await proxy.getAddress(), VaultV2)) as any;
    await proxyV2.waitForDeployment();

    await proxyV2.connect(owner).doubleRewardMultiplier();

    const telAfter = await proxyV2.totalEthLocked();
    const principalAfter = await proxyV2.principalOf(user.address);
    const multiplierAfter = await proxyV2.rewardMultiplier();

    expect(telAfter).to.equal(telBefore);
    expect(principalAfter).to.equal(principalBefore);
    expect(multiplierAfter).to.equal(initialMultiplier * 2n);
  });

  it("blocks implementation initialization", async function () {
    const VaultV1 = await ethers.getContractFactory("VaultV1");
    const implementation = await VaultV1.deploy();
    await implementation.waitForDeployment();

    await expect(
      implementation.initialize(ethers.parseUnits("0.1", 18), ethers.ZeroAddress)
    ).to.be.reverted;
  });
});
