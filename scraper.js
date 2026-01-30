
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000/api/ingest";
const CHANNELS = ["vanek_nikolaev", "kpszsu", "monitor_ua_1", "oddesitmedia"];
const POLL_INTERVAL = 45000; // 45 секунд (чтобы не забанили IP)

// Хранилище ID последних сообщений, чтобы не дублировать
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
        const messages = $('.tgme_widget_message_wrap').last();
        
        if (!messages.length) return;

        const messageBlock = messages.find('.tgme_widget_message');
        const messageId = messageBlock.attr('data-post');
        const text = messages.find('.tgme_widget_message_text').text();

        if (messageId && text && lastSeenIds[channel] !== messageId) {
            console.log(`\x1b[32m[SCRAPER] @${channel}: Новое сообщение [${messageId}]\x1b[0m`);
            console.log(`Текст: ${text.substring(0, 50)}...`);

            // Отправляем на бэкенд
            await axios.post(BACKEND_URL, {
                text: text,
                source: channel
            });

            lastSeenIds[channel] = messageId;
        }
    } catch (error) {
        console.error(`\x1b[31m[SCRAPER ERROR] @${channel}:\x1b[0m`, error.message);
    }
}

async function run() {
    console.log("\x1b[36m%s\x1b[0m", "==========================================");
    console.log("\x1b[36m%s\x1b[0m", "   SkyWatch Web Scraper (No-API Mode)    ");
    console.log("\x1b[36m%s\x1b[0m", "==========================================");
    console.log(`[*] Мониторинг каналов: ${CHANNELS.join(", ")}`);
    console.log(`[*] Интервал проверки: ${POLL_INTERVAL / 1000} сек.`);

    // Первый запуск - просто запоминаем текущие ID, чтобы не спамить старым
    for (const channel of CHANNELS) {
        await scrapeChannel(channel);
    }
    console.log("[*] Начальная инициализация завершена. Жду обновлений...");

    // Цикл опроса
    setInterval(async () => {
        for (const channel of CHANNELS) {
            await scrapeChannel(channel);
            // Небольшая пауза между каналами
            await new Promise(r => setTimeout(r, 2000));
        }
    }, POLL_INTERVAL);
}

run();
