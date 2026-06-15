import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MANTLE_RPC = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const MOCK_DEX_ADDRESS = process.env.MOCK_DEX_ADDRESS || "0x0000000000000000000000000000000000000000";

const DEX_ABI = [
  "function executeSwap(uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address to) external"
];

const provider = new ethers.JsonRpcProvider(MANTLE_RPC);
const attackerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
const victimWallet = ethers.Wallet.createRandom().connect(provider);

const dexContractAttacker = new ethers.Contract(MOCK_DEX_ADDRESS, DEX_ABI, attackerWallet);

async function runSimulation() {
    console.log(`\n🥪 Starting Sandwich Attack Simulation on MockDEX (${MOCK_DEX_ADDRESS})...`);

    if (MOCK_DEX_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.error("❌ MOCK_DEX_ADDRESS not set in .env!");
        return;
    }

    try {
        console.log(`\n[Tx 1] Attacker Front-run: Pushing price up...`);
        const tx1 = await dexContractAttacker.executeSwap(ethers.parseEther("1"), 0, 0, ethers.parseEther("0.9"), attackerWallet.address);
        
        console.log(`[Tx 2] Victim Swap: Executing with terrible slippage...`);
        // We simulate the victim swap using the attacker wallet just to get the tx through easily on testnet
        // In a real demo, we'd fund the victim wallet and use it, but this is simpler and still triggers the indexer logic.
        const tx2 = await dexContractAttacker.executeSwap(ethers.parseEther("0.5"), 0, 0, ethers.parseEther("0.4"), victimWallet.address);
        
        console.log(`[Tx 3] Attacker Back-run: Extracting profit...`);
        const tx3 = await dexContractAttacker.executeSwap(0, ethers.parseEther("0.9"), ethers.parseEther("1.1"), 0, attackerWallet.address);

        console.log(`\n⏳ Waiting for transactions to mine...`);
        await tx1.wait();
        await tx2.wait();
        await tx3.wait();

        console.log(`✅ Simulation complete. Check your Agent terminal!`);

    } catch (err: any) {
        console.error("Simulation failed:", err.message);
    }
}

runSimulation();
