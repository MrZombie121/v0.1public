
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const POLL_INTERVAL = 15000;
const lastSeenIds = {};
let activeChannels = [];

export async function startScraper(port) {
    const BACKEND_URL = `http://localhost:${port}/api/ingest`;
    const SOURCES_URL = `http://localhost:${port}/api/sources`;

    async function updateSources() {
        try {
            const { data } = await axios.get(SOURCES_URL, { timeout: 5000 });
            if (Array.isArray(data)) {
                activeChannels = data
                    .filter(s => s.enabled && s.type === 'telegram')
                    .map(s => s.name);
            }
        } catch (e) {
            console.warn("[SCRAPER] Sources sync failed. Using existing channels.");
        }
    }

    async function scrapeChannel(channel) {
        try {
            const url = `https://t.me/s/${channel}`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 10000
            });

            const $ = cheerio.load(data);
            const messages = $('.tgme_widget_message_wrap');
            
            // Focus on most recent message
            const lastMsg = messages.last();
            if (!lastMsg.length) return;

            const messageId = lastMsg.find('.tgme_widget_message').attr('data-post');
            const text = lastMsg.find('.tgme_widget_message_text').text().trim();

            if (messageId && text && lastSeenIds[channel] !== messageId) {
                console.log(`[SCRAPER] New intel from @${channel}: ${text.substring(0, 40)}...`);
                
                try {
                    const res = await axios.post(BACKEND_URL, {
                        text: text,
                        source: `@${channel}`
                    });
                    if (res.data.success) {
                        console.log(`[SCRAPER] Successfully ingested @${channel} message.`);
                    }
                } catch (e) {
                    console.error(`[SCRAPER] Ingest error for @${channel}: ${e.message}`);
                }
                
                lastSeenIds[channel] = messageId;
            }
        } catch (error) {
            console.error(`[SCRAPER] Connection error for @${channel}: ${error.message}`);
        }
    }

    // Main loop
    const run = async () => {
        await updateSources();
        if (activeChannels.length === 0) {
            console.warn("[SCRAPER] No active channels found in database.");
        }
        
        for (const channel of activeChannels) {
            await scrapeChannel(channel);
            // Small delay to prevent rate limiting
            await new Promise(r => setTimeout(r, 1000));
        }
    };

    // Initial run
    run();
    // Schedule periodic runs
    setInterval(run, POLL_INTERVAL);
}
