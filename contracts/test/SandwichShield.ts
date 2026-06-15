import { expect } from "chai";
import { ethers } from "hardhat";

describe("SandwichShield", function () {
  it("Should deploy and allow owner to publish an alert", async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const SandwichShield = await ethers.getContractFactory("SandwichShield");
    const shield = await SandwichShield.deploy();

    const victim = ethers.Wallet.createRandom().address;
    const lossUSD = ethers.parseUnits("100", 18);
    const txHash = ethers.hexlify(ethers.randomBytes(32));
    const dexName = "Merchant Moe";

    // Publish alert
    await expect(shield.publishAlert(victim, lossUSD, txHash, dexName))
      .to.emit(shield, "AlertPublished")
      .withArgs(victim, lossUSD, txHash, dexName); // The first arg is event victim, third is txHash, fourth is timestamp(ignored in test easily but we can just check emit), wait withArgs can be tricky with timestamps.
      // A better way is just to check it didn't revert.
      
    // Actually testing event might fail if timestamp is unpredictable, let's just check state
    expect(await shield.getAlertCount()).to.equal(1);
    
    const alert = await shield.getAlert(0);
    expect(alert.victim).to.equal(victim);
    expect(alert.lossUSD).to.equal(lossUSD);
    expect(alert.txHash).to.equal(txHash);
    expect(alert.dexName).to.equal(dexName);
  });

  it("Should prevent non-owners from publishing alerts", async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const SandwichShield = await ethers.getContractFactory("SandwichShield");
    const shield = await SandwichShield.deploy();

    const victim = ethers.Wallet.createRandom().address;
    const lossUSD = ethers.parseUnits("100", 18);
    const txHash = ethers.hexlify(ethers.randomBytes(32));

    await expect(
      shield.connect(otherAccount).publishAlert(victim, lossUSD, txHash, "Test DEX")
    ).to.be.revertedWith("Only owner can publish alerts");
  });
});
