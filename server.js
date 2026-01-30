
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

// Initializing Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelName = "gemini-3-flash-preview";

let airEvents = []; 

// API Endpoints
app.get('/api/events', (req, res) => {
    const now = Date.now();
    airEvents = airEvents.filter(e => now - e.timestamp < 30 * 60 * 1000);
    res.json(airEvents);
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: `Анализируй тактическое сообщение: "${text}"`,
            config: {
                systemInstruction: `Ты — тактический анализатор SkyWatch. 
                Определи регион, тип цели (shahed, missile, kab) и является ли это отбоем (isClear).
                Если это Одесса и районы (Аркадия, Таирова и т.д.), ставь region: "Odesa".
                Верни строго JSON.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['shahed', 'missile', 'kab'] },
                        region: { type: Type.STRING },
                        isClear: { type: Type.BOOLEAN },
                        isUserTest: { type: Type.BOOLEAN },
                        spawnModifier: { type: Type.STRING, enum: ['sea', 'border', 'normal'] }
                    },
                    required: ["type", "region", "isClear", "isUserTest"]
                }
            }
        });

        const parsed = JSON.parse(response.text);
        
        if (parsed.isClear) {
            const regToClear = (parsed.region || '').toLowerCase();
            airEvents = airEvents.filter(e => (e.region || '').toLowerCase() !== regToClear);
            return res.json({ success: true, clear: true });
        }

        const newEvent = {
            id: 'srv_' + Math.random().toString(36).substr(2, 9),
            ...parsed,
            timestamp: Date.now(),
            source: source || 'unknown',
            rawText: text
        };

        airEvents.push(newEvent);
        res.json({ success: true, event: newEvent });
    } catch (e) {
        console.error("Ingest Error:", e.message);
        res.status(500).json({ error: "AI Processing failed" });
    }
});

// На хостинге фронтенд будет лежать в папке /dist (после npm run build)
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send("Backend is running. Frontend not found. Run 'npm run build' first.");
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SKYWATCH] Server live on port ${PORT}`);
});
