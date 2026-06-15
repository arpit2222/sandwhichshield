import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SandwichShield V2 & MockDEX to Mantle Testnet...");

  // 1. Deploy SandwichShield
  const SandwichShield = await ethers.getContractFactory("SandwichShield");
  const shield = await SandwichShield.deploy();
  await shield.waitForDeployment();
  const shieldAddress = await shield.getAddress();
  console.log(`SandwichShield V2 deployed to: ${shieldAddress}`);

  // 2. Deploy MockDEX
  const MockDEX = await ethers.getContractFactory("MockDEX");
  const dex = await MockDEX.deploy();
  await dex.waitForDeployment();
  const dexAddress = await dex.getAddress();
  console.log(`MockDEX deployed to: ${dexAddress}`);

  console.log("\n--- Verification Commands ---");
  console.log(`npx hardhat verify --network mantleTestnet ${shieldAddress}`);
  console.log(`npx hardhat verify --network mantleTestnet ${dexAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
