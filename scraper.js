
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
// Use localhost explicitly to ensure it hits the internal loopback on cloud providers
const BACKEND_URL = `http://localhost:${PORT}/api/ingest`;
const SOURCES_URL = `http://localhost:${PORT}/api/sources`;

const POLL_INTERVAL = 20000;
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
        console.warn("[SCRAPER] Sources sync failed. Keeping cache.");
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
        
        // Check the most recent 3 messages
        const lastFew = messages.slice(-3);

        lastFew.each(async (i, el) => {
            const msgEl = $(el);
            const messageId = msgEl.find('.tgme_widget_message').attr('data-post');
            const text = msgEl.find('.tgme_widget_message_text').text().trim();

            if (messageId && text && lastSeenIds[channel] !== messageId) {
                console.log(`[SCRAPER] @${channel} Detection: ${text.substring(0, 30)}...`);
                
                try {
                    const res = await axios.post(BACKEND_URL, {
                        text: text,
                        source: `@${channel}`
                    });
                    console.log(`[SCRAPER] Ingest success: ${res.data.success}`);
                } catch (e) {
                    console.error(`[SCRAPER] Ingest error: ${e.response?.status} - ${e.message}`);
                }
                
                lastSeenIds[channel] = messageId;
            }
        });
    } catch (error) {
        console.error(`[SCRAPER] @${channel} Connection error: ${error.message}`);
    }
}

async function run() {
    console.log("------------------------------------------");
    console.log("   SkyWatch Scraper Node: OPERATIONAL    ");
    console.log(`   Ingest Endpoint: ${BACKEND_URL}`);
    console.log("------------------------------------------");

    await updateSources();
    
    // Initial run
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
