
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

// В Railway внутри контейнера сервер доступен по localhost или 0.0.0.0
const PORT = process.env.PORT || 3000;
const BACKEND_URL = `http://localhost:${PORT}/api/ingest`;

const CHANNELS = ["vanek_nikolaev", "kpszsu", "monitor_ua_1", "oddesitmedia"];
const POLL_INTERVAL = 60000; // 1 минута

const lastSeenIds = {};

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
    console.log("   SkyWatch Intel Scraper: ONLINE        ");
    console.log("------------------------------------------");

    // Начальный проход
    for (const channel of CHANNELS) {
        await scrapeChannel(channel);
        await new Promise(r => setTimeout(r, 2000));
    }

    setInterval(async () => {
        for (const channel of CHANNELS) {
            await scrapeChannel(channel);
            await new Promise(r => setTimeout(r, 2000));
        }
    }, POLL_INTERVAL);
}

run();
