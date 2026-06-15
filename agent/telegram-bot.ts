import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

let bot: Telegraf | null = null;

if (BOT_TOKEN) {
    bot = new Telegraf(BOT_TOKEN);
    // Optional: Start the bot polling so it can receive messages if needed
    // bot.launch();
    console.log("🤖 Telegram bot initialized.");
} else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN not provided. Telegram alerts disabled.");
}

export async function sendTelegramAlert(victim: string, lossUSD: number, txHash: string, dexName: string) {
    if (!bot || !CHAT_ID) {
        console.warn("Cannot send Telegram alert: Bot not initialized or CHAT_ID missing.");
        return;
    }

    const shortVictim = `${victim.substring(0, 6)}...${victim.substring(victim.length - 4)}`;
    const explorerLink = `https://explorer.sepolia.mantle.xyz/tx/${txHash}`;

    const message = `🚨 <b>MEV Sandwich Detected!</b>\n\n` +
                    `🏦 <b>DEX:</b> ${dexName}\n` +
                    `🩸 <b>Victim:</b> <code>${shortVictim}</code>\n` +
                    `💸 <b>Loss:</b> $${lossUSD.toFixed(2)}\n\n` +
                    `🔗 <a href="${explorerLink}">View on Mantle Explorer</a>`;

    try {
        await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        console.log(`✅ Telegram alert sent to channel.`);
    } catch (error) {
        console.error("❌ Failed to send Telegram alert:", error);
    }
}
