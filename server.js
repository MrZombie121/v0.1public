
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// --- ИНИЦИАЛИЗАЦИЯ ИИ ---
const API_KEY = process.env.API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const modelName = "gemini-3-flash-preview";

// --- ХРАНИЛИЩЕ И СТАТИСТИКА ---
let airEvents = [
    {
        id: 'init_target_1',
        type: 'shahed',
        region: 'Odesa',
        spawnModifier: 'sea',
        isUserTest: true,
        timestamp: Date.now(),
        source: 'System',
        rawText: 'Система активна. Очікування цілей...'
    }
];

let scraperStatus = {
    lastRun: null,
    status: 'initializing',
    channelsChecked: 0,
    errors: []
};

async function processTacticalText(text, source) {
    if (!ai) return { event: { id: Date.now(), type: 'shahed', region: 'Odesa', rawText: text }, error: "AI_OFF" };

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: `АНАЛИЗИРУЙ ТАКТИЧЕСКИЙ ТЕКСТ: "${text}"`,
            config: {
                systemInstruction: `Ты ИИ-аналитик ПВО. Твоя задача — извлечь данные.
                Верни JSON: { "type": "shahed"|"missile"|"kab", "region": "City", "isClear": bool, "spawnModifier": "sea"|"border"|"normal" }.
                ОБЯЗАТЕЛЬНО: Если Одесса, районы города, или "у нас" (если источник Одесса) -> region: "Odesa". 
                Если море, залив, побережье -> spawnModifier: "sea".`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        region: { type: Type.STRING },
                        isClear: { type: Type.BOOLEAN },
                        spawnModifier: { type: Type.STRING }
                    },
                    required: ["type", "region", "isClear"]
                }
            }
        });

        const parsed = JSON.parse(response.text);
        
        if (parsed.isClear) {
            const reg = (parsed.region || '').toLowerCase();
            airEvents = airEvents.filter(e => (e.region || '').toLowerCase() !== reg);
            return { cleared: true };
        }

        const newEvent = {
            id: 'srv_' + Math.random().toString(36).substr(2, 9),
            type: parsed.type || 'shahed',
            region: parsed.region || 'Odesa',
            spawnModifier: parsed.spawnModifier || 'normal',
            timestamp: Date.now(),
            source: source || 'unknown',
            rawText: text
        };

        airEvents.push(newEvent);
        return { event: newEvent };
    } catch (e) {
        return null;
    }
}

// --- СКРАПЕР ---
const CHANNELS = ["oddesitmedia", "vanek_nikolaev", "kpszsu", "monitor_ua_1"];
const lastSeenIds = {};

async function runScraperStep() {
    scraperStatus.status = 'running';
    scraperStatus.errors = [];
    let count = 0;

    for (const channel of CHANNELS) {
        try {
            const url = `https://t.me/s/${channel}`;
            const { data } = await axios.get(url, { timeout: 8000 });
            const $ = cheerio.load(data);
            const lastMessageWrap = $('.tgme_widget_message_wrap').last();
            
            if (!lastMessageWrap.length) continue;

            const messageId = lastMessageWrap.find('.tgme_widget_message').attr('data-post');
            const text = lastMessageWrap.find('.tgme_widget_message_text').text();

            if (messageId && text && lastSeenIds[channel] !== messageId) {
                await processTacticalText(text, `@${channel}`);
                lastSeenIds[channel] = messageId;
            }
            count++;
        } catch (err) {
            scraperStatus.errors.push(`${channel}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    
    scraperStatus.lastRun = Date.now();
    scraperStatus.channelsChecked = count;
    scraperStatus.status = count > 0 ? 'idle' : 'rate-limited';
}

// --- API ---
app.get('/api/events', (req, res) => {
    res.json({
        events: airEvents,
        scraper: scraperStatus
    });
});

app.post('/api/force-scrape', async (req, res) => {
    await runScraperStep();
    res.json({ success: true, status: scraperStatus });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    const result = await processTacticalText(text, source);
    if (result) res.json({ success: true, ...result });
    else res.status(500).json({ error: "Processing failed" });
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Online on port ${PORT}`);
    setInterval(runScraperStep, 60000);
    runScraperStep();
});
