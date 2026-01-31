
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const BACKEND_URL = `${BASE_URL}/api/ingest`;
const SOURCES_URL = `${BASE_URL}/api/sources`;

const POLL_INTERVAL = 60000; 
const lastSeenIds = {};
let activeChannels = [];

async function updateSources() {
    try {
        const { data } = await axios.get(SOURCES_URL);
        activeChannels = data
            .filter(s => s.enabled && s.type === 'telegram')
            .map(s => s.name);
        console.log(`[SCRAPER] Updated sources: ${activeChannels.join(', ')}`);
    } catch (e) {
        console.error("[SCRAPER] Failed to fetch sources list:", e.message);
    }
}

async function scrapeChannel(channel) {
    try {
        const url = `https://t.me/s/${channel}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const lastMessageWrap = $('.tgme_widget_message_wrap').last();
        if (!lastMessageWrap.length) return;

        const messageBlock = lastMessageWrap.find('.tgme_widget_message');
        const messageId = messageBlock.attr('data-post');
        const text = lastMessageWrap.find('.tgme_widget_message_text').text();

        if (messageId && text && lastSeenIds[channel] !== messageId) {
            console.log(`[SCRAPER] @${channel}: New intel detected (${messageId})`);
            await axios.post(BACKEND_URL, {
                text: text,
                source: `TG_Web_@${channel}`
            }).catch(e => console.error("Failed to forward to backend:", e.message));
            lastSeenIds[channel] = messageId;
        }
    } catch (error) {
        console.error(`[SCRAPER ERROR] @${channel}:`, error.message);
    }
}

async function run() {
    console.log("------------------------------------------");
    console.log("   SkyWatch Dynamic Scraper: ONLINE      ");
    console.log("------------------------------------------");

    await updateSources();

    setInterval(async () => {
        await updateSources();
        for (const channel of activeChannels) {
            await scrapeChannel(channel);
            await new Promise(r => setTimeout(r, 3000));
        }
    }, POLL_INTERVAL);
    
    // Initial run
    for (const channel of activeChannels) {
        await scrapeChannel(channel);
        await new Promise(r => setTimeout(r, 2000));
    }
}

run();
