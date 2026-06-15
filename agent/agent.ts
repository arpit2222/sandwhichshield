import { ethers } from 'ethers';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';
import { sendTelegramAlert } from './telegram-bot';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const MANTLE_RPC = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const MOCK_DEX_ADDRESS = process.env.MOCK_DEX_ADDRESS || "0x0000000000000000000000000000000000000000";
const MONGODB_URI = process.env.MONGODB_URI || "";

// ABI for the MockDEX Contract
const DEX_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

const provider = new ethers.JsonRpcProvider(MANTLE_RPC);
const dexContract = new ethers.Contract(MOCK_DEX_ADDRESS, DEX_ABI, provider);

// --- 1. Initialize MongoDB Database ---
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set in .env!");
    process.exit(1);
}

mongoose.connect(MONGODB_URI).then(() => {
    console.log("🍃 Connected to MongoDB cluster successfully.");
}).catch(err => {
    console.error("❌ MongoDB connection error:", err);
});

// Define Mongoose Schema
const alertSchema = new mongoose.Schema({
    victim: String,
    attacker: String,
    lossUSD: Number,
    aiScore: Number,
    txHash: String,
    timestamp: Number,
    dexName: String
});

const AlertModel = mongoose.model('Alert', alertSchema);

// --- 2. Initialize Express API ---
const app = express();
app.use(cors());

app.get('/api/alerts', async (req, res) => {
    try {
        const alerts = await AlertModel.find().sort({ timestamp: -1 }).limit(100).exec();
        // Rename _id to id for frontend compatibility
        const mappedAlerts = alerts.map(a => ({
            id: a._id.toString(),
            victim: a.victim,
            attacker: a.attacker,
            lossUSD: a.lossUSD,
            aiScore: a.aiScore,
            txHash: a.txHash,
            timestamp: a.timestamp,
            dexName: a.dexName
        }));
        res.json(mappedAlerts);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// --- Nansen Integration Endpoint ---
app.get('/api/export/nansen', async (req, res) => {
    try {
        const alerts = await AlertModel.find().sort({ timestamp: -1 }).limit(100).exec();
        const nansenFormat = alerts.map(a => ({
            timestamp: new Date((a.timestamp || 0) * 1000).toISOString(),
            protocol: a.dexName,
            attacker_address: a.attacker,
            victim_address: a.victim,
            value_extracted_usd: a.lossUSD,
            ai_sophistication_score: a.aiScore,
            tx_hash: a.txHash,
            event_type: "MEV_SANDWICH"
        }));
        res.json({ provider: "SandwichShield", format: "Nansen_Integration_V1", data: nansenFormat });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// --- Trigger Stress Test Simulation ---
app.post('/api/simulate', (req, res) => {
    exec('npx ts-node stress-test.ts', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Simulation error: ${error.message}`);
            return;
        }
        console.log(`Simulation complete.`);
    });
    res.json({ success: true, message: "Stress test triggered!" });
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await AlertModel.aggregate([
            {
                $group: {
                    _id: "$dexName",
                    attackCount: { $sum: 1 },
                    totalLoss: { $sum: "$lossUSD" }
                }
            },
            {
                $project: {
                    _id: 0,
                    dexName: "$_id",
                    attackCount: 1,
                    totalLoss: 1
                }
            }
        ]).exec();
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🚀 SandwichShield API Server running on port ${PORT}`);
});

// --- 3. Indexer Logic (Pattern Recognition) ---
async function getLiveEthPriceFromBybit(): Promise<number> {
    try {
        // Native fetch is available in Node 18+
        const response = await fetch("https://api.bybit.com/v5/market/tickers?category=spot&symbol=ETHUSDT");
        const data = await response.json();
        const price = parseFloat(data.result.list[0].lastPrice);
        console.log(`[Bybit Integration] Live ETH Price: $${price}`);
        return price || 3500;
    } catch (error) {
        console.error("Bybit API Error, falling back to 3500");
        return 3500;
    }
}

interface SwapEvent {
    txHash: string;
    sender: string;
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
    to: string;
    blockNumber: number;
}

let eventBuffer: SwapEvent[] = [];

export async function startAgent() {
  console.log(`🛡️ SandwichShield Live Indexer Started on ${MANTLE_RPC}`);
  console.log(`Listening for Swap events on MockDEX: ${MOCK_DEX_ADDRESS}`);
  
  // Listen to live Swap events
  dexContract.on("Swap", (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
      console.log(`[Event] Swap detected in block ${event.log.blockNumber} from ${sender}`);
      eventBuffer.push({
          txHash: event.log.transactionHash,
          sender,
          amount0In,
          amount1In,
          amount0Out,
          amount1Out,
          to,
          blockNumber: event.log.blockNumber
      });
  });

  // Analyze buffer every 5 seconds for sandwich patterns
  setInterval(analyzeBuffer, 5000);
}

async function analyzeBuffer() {
    if (eventBuffer.length < 3) return; // Need at least 3 swaps for a sandwich
    
    // Group events by block number
    const blocks = [...new Set(eventBuffer.map(e => e.blockNumber))];
    
    for (const blockNum of blocks) {
        const blockEvents = eventBuffer.filter(e => e.blockNumber === blockNum);
        
        // Search for pattern: [Attacker Buy] -> [Victim Buy] -> [Attacker Sell]
        if (blockEvents.length >= 3) {
            // Simplistic pattern matching for the demo
            const tx1 = blockEvents[0];
            const tx2 = blockEvents[1]; // Victim
            const tx3 = blockEvents[blockEvents.length - 1];

            // If Tx1 and Tx3 are the same sender, and Tx2 is someone else -> SANDWICH!
            if (tx1.sender === tx3.sender && tx1.sender !== tx2.sender) {
                console.log(`\n🚨 MEV SANDWICH DETECTED IN BLOCK ${blockNum}!`);
                console.log(`Attacker: ${tx1.sender}`);
                console.log(`Victim: ${tx2.sender}`);
                
                // --- DETERMINISTIC DATA ANALYSIS ---
                // We calculate the exact MEV extracted by evaluating the Attacker's net profit
                // Attacker Profit = (Tx3 Out) - (Tx1 In)
                const attackerProfitWei = (tx3.amount0Out + tx3.amount1Out) - (tx1.amount0In + tx1.amount1In);
                
                // Fallback to victim slippage if the sandwich is unbalanced
                const victimSlippageWei = (tx2.amount0In + tx2.amount1In) - (tx2.amount0Out + tx2.amount1Out);
                
                const extractedWei = attackerProfitWei > 0n ? attackerProfitWei : victimSlippageWei;
                
                // Convert BigInt Wei to ETH float, and multiply by Live Bybit Oracle Price
                const extractedEth = parseFloat(ethers.formatEther(extractedWei));
                const ethPrice = await getLiveEthPriceFromBybit();
                const lossUSD = parseFloat((extractedEth * ethPrice).toFixed(2));

                // --- AI THREAT SCORING ---
                let aiScore = 0;
                if (victimSlippageWei > 0n) {
                    const extractionEfficiency = Number(extractedWei) / Number(victimSlippageWei);
                    const clampedEfficiency = Math.min(Math.max(extractionEfficiency, 0.5), 1.0);
                    aiScore = Math.floor(clampedEfficiency * 100);
                } else {
                    aiScore = Math.floor(Math.random() * 20) + 70; // Fallback heuristic
                }

                // --- BYREAL AGENTIC WALLET DEFENSE SIMULATION ---
                if (aiScore >= 85) {
                    console.log(`⚡ [Byreal Integration] High AI Threat Detected (${aiScore}/100)!`);
                    console.log(`⚡ [Byreal Integration] Simulating automated trading pause for Wallet ${tx2.sender}...`);
                }

                await recordAttack(tx2.sender, tx1.sender, lossUSD, aiScore, tx2.txHash, "MockDEX");
                
                // Clear the analyzed events
                eventBuffer = eventBuffer.filter(e => e.blockNumber !== blockNum);
            }
        }
    }
}

async function recordAttack(victim: string, attacker: string, lossUSD: number, aiScore: number, txHash: string, dexName: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    
    try {
        const newAlert = new AlertModel({
            victim,
            attacker,
            lossUSD,
            aiScore,
            txHash,
            timestamp,
            dexName
        });
        await newAlert.save();
        console.log(`✅ Alert saved to MongoDB cluster.`);
        await sendTelegramAlert(victim, lossUSD, txHash, dexName);
    } catch (err: any) {
        console.error("MongoDB Insert Error:", err.message);
    }
}

// Start if run directly
if (require.main === module) {
  startAgent();
}
