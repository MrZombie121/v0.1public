
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

// Detect environment or default to local
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`;
const BACKEND_URL = `${BASE_URL}/api/ingest`;
const SOURCES_URL = `${BASE_URL}/api/sources`;

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
        console.warn("[SCRAPER] Source sync failed, keeping current list.");
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
        const lastMessageWrap = $('.tgme_widget_message_wrap').last();
        if (!lastMessageWrap.length) return;

        const messageBlock = lastMessageWrap.find('.tgme_widget_message');
        const messageId = messageBlock.attr('data-post');
        const text = lastMessageWrap.find('.tgme_widget_message_text').text();

        if (messageId && text && lastSeenIds[channel] !== messageId) {
            console.log(`[SCRAPER] @${channel} New Intel: ${messageId}`);
            await axios.post(BACKEND_URL, {
                text: text,
                source: `${channel}`
            }).catch(e => console.error(`[SCRAPER] Ingest error:`, e.message));
            lastSeenIds[channel] = messageId;
        }
    } catch (error) {
        console.error(`[SCRAPER] @${channel} Error:`, error.message);
    }
}

async function run() {
    console.log("------------------------------------------");
    console.log("   SkyWatch Scraper Node: OPERATIONAL    ");
    console.log(`   Target: ${BACKEND_URL}`);
    console.log("------------------------------------------");

    await updateSources();
    setInterval(updateSources, 60000);

    setInterval(async () => {
        for (const channel of activeChannels) {
            await scrapeChannel(channel);
            await new Promise(r => setTimeout(r, 2000));
        }
    }, POLL_INTERVAL);
    
    // Initial burst
    for (const channel of activeChannels) { await scrapeChannel(channel); }
}

run();
