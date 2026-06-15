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
const dexContractAttacker = new ethers.Contract(MOCK_DEX_ADDRESS, DEX_ABI, attackerWallet);

async function runStressTest() {
    console.log(`\n🌪️ Starting STRESS TEST on MockDEX (${MOCK_DEX_ADDRESS})...`);
    console.log(`Firing 5 back-to-back sandwich attacks! Check the UI!`);

    let currentNonce = await attackerWallet.getNonce();

    for (let i = 1; i <= 5; i++) {
        const victimWallet = ethers.Wallet.createRandom().connect(provider);
        console.log(`\n[Attack ${i}/5] Generating random victim: ${victimWallet.address}`);
        
        // Randomize the amount to simulate different scale attacks
        const baseAmount = Math.random() * 2 + 0.5; // 0.5 to 2.5
        const amtStr = baseAmount.toFixed(4);
        const amtStrIn = (baseAmount * 0.9).toFixed(4);
        const amtStrOut = (baseAmount * 1.1).toFixed(4);
        const vicIn = (baseAmount * 0.5).toFixed(4);
        const vicOut = (baseAmount * 0.4).toFixed(4);

        try {
            await dexContractAttacker.executeSwap(ethers.parseEther(amtStr), 0, 0, ethers.parseEther(amtStrIn), attackerWallet.address, { nonce: currentNonce++ });
            await dexContractAttacker.executeSwap(ethers.parseEther(vicIn), 0, 0, ethers.parseEther(vicOut), victimWallet.address, { nonce: currentNonce++ });
            await dexContractAttacker.executeSwap(0, ethers.parseEther(amtStrIn), ethers.parseEther(amtStrOut), 0, attackerWallet.address, { nonce: currentNonce++ });
            console.log(`✅ Attack ${i} Broadcasted!`);
        } catch (e: any) {
            console.error(`❌ Attack ${i} Failed:`, e.message);
        }
    }

    console.log(`\n🎉 STRESS TEST COMPLETE! All attacks broadcasted to the Mempool.`);
}

runStressTest();
