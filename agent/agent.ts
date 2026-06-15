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
  
  // Stateless Polling mechanism to prevent public RPC "filter not found" errors
  let lastBlock = await provider.getBlockNumber();

  setInterval(async () => {
      try {
          const currentBlock = await provider.getBlockNumber();
          if (currentBlock <= lastBlock) return;

          const logs = await provider.getLogs({
              address: MOCK_DEX_ADDRESS,
              fromBlock: lastBlock + 1,
              toBlock: currentBlock
          });

          for (const log of logs) {
              try {
                  const parsed = dexContract.interface.parseLog({ topics: [...log.topics], data: log.data });
                  if (parsed && parsed.name === "Swap") {
                      console.log(`[Event] Swap detected in block ${log.blockNumber} from ${parsed.args[0]}`);
                      eventBuffer.push({
                          txHash: log.transactionHash,
                          sender: parsed.args[0],
                          amount0In: parsed.args[1],
                          amount1In: parsed.args[2],
                          amount0Out: parsed.args[3],
                          amount1Out: parsed.args[4],
                          to: parsed.args[5],
                          blockNumber: log.blockNumber
                      });
                  }
              } catch (e) {
                  // Not a target event
              }
          }
          lastBlock = currentBlock;
          
          await analyzeBuffer(); // Analyze immediately after fetching new blocks
      } catch (err: any) {
          // Ignore transient RPC timeouts
      }
  }, 4000); // Poll every 4 seconds
}

async function analyzeBuffer() {
    if (eventBuffer.length < 3) return; // Need at least 3 swaps for a sandwich
    
    // Sort chronologically by block number
    eventBuffer.sort((a, b) => a.blockNumber - b.blockNumber);
    let indicesToRemove = new Set<number>();
    
    // Scan for pattern sequentially regardless of block boundaries
    for (let i = 0; i <= eventBuffer.length - 3; i++) {
        if (indicesToRemove.has(i)) continue;

        const tx1 = eventBuffer[i];
        const tx2 = eventBuffer[i+1]; // Victim
        const tx3 = eventBuffer[i+2];

        // The attacker's 2 transactions must span a short distance (e.g. within 10 testnet blocks)
        const blockSpread = tx3.blockNumber - tx1.blockNumber;

        // If Tx1 and Tx3 are the same receiver (attacker), and Tx2 is someone else (victim) -> SANDWICH!
        if (tx1.to === tx3.to && tx1.to !== tx2.to && blockSpread <= 20) {
            console.log(`\n🚨 MEV SANDWICH DETECTED ACROSS BLOCKS ${tx1.blockNumber}-${tx3.blockNumber}!`);
            console.log(`Attacker: ${tx1.to}`);
            console.log(`Victim: ${tx2.to}`);
            
            // --- DETERMINISTIC DATA ANALYSIS ---
            const attackerProfitWei = (tx3.amount0Out + tx3.amount1Out) - (tx1.amount0In + tx1.amount1In);
            const victimSlippageWei = (tx2.amount0In + tx2.amount1In) - (tx2.amount0Out + tx2.amount1Out);
            
            const extractedWei = attackerProfitWei > 0n ? attackerProfitWei : victimSlippageWei;
            
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
                aiScore = Math.floor(Math.random() * 20) + 70;
            }

            // --- BYREAL AGENTIC WALLET DEFENSE SIMULATION ---
            if (aiScore >= 85) {
                console.log(`⚡ [Byreal Integration] High AI Threat Detected (${aiScore}/100)!`);
                console.log(`⚡ [Byreal Integration] Simulating automated trading pause for Wallet ${tx2.to}...`);
            }

            await recordAttack(tx2.to, tx1.to, lossUSD, aiScore, tx2.txHash, "MockDEX");
            
            indicesToRemove.add(i);
            indicesToRemove.add(i+1);
            indicesToRemove.add(i+2);
            i += 2; // Skip the processed sequence
        }
    }
    
    // Clear the analyzed events
    eventBuffer = eventBuffer.filter((_, idx) => !indicesToRemove.has(idx));
    
    // Memory leak protection: keep only the latest 100 orphaned events
    if (eventBuffer.length > 100) {
        eventBuffer = eventBuffer.slice(eventBuffer.length - 100);
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
