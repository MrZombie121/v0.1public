
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация ИИ
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
const modelName = "gemini-3-flash-preview";

// Хранилище событий с "демо-целью" для проверки
let airEvents = [
    {
        id: 'demo_1',
        type: 'shahed',
        region: 'Odesa',
        spawnModifier: 'sea',
        isUserTest: true,
        timestamp: Date.now(),
        source: 'System_Init',
        rawText: 'Демонстраційна ціль: Шахед з моря'
    }
]; 

app.get('/api/events', (req, res) => {
    const now = Date.now();
    // Чистим старье (> 45 мин)
    airEvents = airEvents.filter(e => now - e.timestamp < 45 * 60 * 1000);
    res.json(airEvents);
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    if (!text || !process.env.API_KEY) {
        console.error("[INGEST ERROR] No text or API_KEY missing");
        return res.status(400).json({ error: "Missing data" });
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: `АНАЛИЗИРУЙ: "${text}"`,
            config: {
                systemInstruction: `Ты ПВО-аналитик. Верни JSON: 
                { "type": "shahed"|"missile"|"kab", "region": "CityName", "isClear": bool, "isUserTest": bool, "spawnModifier": "sea"|"border"|"normal" }.
                Если Одесса/районы -> Odesa. Если "с моря" -> sea.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        region: { type: Type.STRING },
                        isClear: { type: Type.BOOLEAN },
                        isUserTest: { type: Type.BOOLEAN },
                        spawnModifier: { type: Type.STRING }
                    },
                    required: ["type", "region", "isClear", "isUserTest"]
                }
            }
        });

        const parsed = JSON.parse(response.text);
        
        if (parsed.isClear) {
            const reg = (parsed.region || '').toLowerCase();
            airEvents = airEvents.filter(e => (e.region || '').toLowerCase() !== reg);
            return res.json({ success: true, cleared: true });
        }

        const newEvent = {
            id: 'srv_' + Math.random().toString(36).substr(2, 9),
            type: parsed.type || 'shahed',
            region: parsed.region || 'Unknown',
            spawnModifier: parsed.spawnModifier || 'normal',
            isUserTest: parsed.isUserTest || false,
            timestamp: Date.now(),
            source: source || 'unknown',
            rawText: text
        };

        airEvents.push(newEvent);
        res.json({ success: true, event: newEvent });
    } catch (e) {
        console.error("AI Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Раздача фронтенда (важно для Koyeb/Render)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SKYWATCH] Tactical Server Online on port ${PORT}`);
});
