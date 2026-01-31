
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
// Use 127.0.0.1 for more reliable local ingestion on cloud hosts
const BACKEND_URL = `http://127.0.0.1:${PORT}/api/ingest`;
const SOURCES_URL = `http://127.0.0.1:${PORT}/api/sources`;

const POLL_INTERVAL = 25000;
const lastSeenIds = {};
let activeChannels = [];

async function updateSources() {
    try {
        const { data } = await axios.get(SOURCES_URL, { timeout: 5000 });
        if (Array.isArray(data)) {
            activeChannels = data
                .filter(s => s.enabled && s.type === 'telegram')
                .map(s => s.name);
        }
    } catch (e) {
        console.warn("[SCRAPER] Sync failed. Retrying...");
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
        
        // Look at the last 5 messages to skip ads or service messages
        const lastFew = messages.slice(-5);
        let foundNew = false;

        lastFew.each(async (i, el) => {
            const msgEl = $(el);
            const messageId = msgEl.find('.tgme_widget_message').attr('data-post');
            const text = msgEl.find('.tgme_widget_message_text').text().trim();

            if (messageId && text && lastSeenIds[channel] !== messageId) {
                console.log(`[SCRAPER] @${channel} NEW: ${text.substring(0, 30)}...`);
                
                await axios.post(BACKEND_URL, {
                    text: text,
                    source: `TG_@${channel}`
                }).catch(e => console.error(`[SCRAPER] Ingest Fail: ${e.message}`));
                
                lastSeenIds[channel] = messageId;
                foundNew = true;
            }
        });
    } catch (error) {
        console.error(`[SCRAPER] @${channel} Error: ${error.message}`);
    }
}

async function run() {
    console.log("------------------------------------------");
    console.log("   SkyWatch Scraper Node: OPERATIONAL    ");
    console.log("------------------------------------------");

    await updateSources();
    
    // Initial loop
    for (const channel of activeChannels) {
        await scrapeChannel(channel);
        await new Promise(r => setTimeout(r, 1000));
    }

    setInterval(async () => {
        await updateSources();
        for (const channel of activeChannels) {
            await scrapeChannel(channel);
            await new Promise(r => setTimeout(r, 2000));
        }
    }, POLL_INTERVAL);
}

run();
