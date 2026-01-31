
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const OBLAST_IDS = [
    "odesa", "kyiv", "kharkiv", "lviv", "dnipro", "zaporizhzhia", "mykolaiv", "kherson", 
    "chernihiv", "sumy", "poltava", "vinnytsia", "cherkasy", "khmelnytskyi", "zhytomyr", 
    "rivne", "lutsk", "ternopil", "if", "uzhhorod", "chernivtsi", "kirovohrad", 
    "donetsk", "luhansk", "crimea", "sea"
];

let airEvents = [];

function parseGroundedResponse(text) {
    const result = {
        type: 'shahed',
        region: 'sea',
        isClear: false,
        direction: 180,
        lat: null,
        lng: null
    };

    try {
        if (!text) return result;
        const lowerText = text.toLowerCase();
        if (lowerText.includes('clear') || lowerText.includes('отбой') || lowerText.includes('чисто')) {
            result.isClear = true;
        }

        const latMatch = text.match(/LAT:\s*([-]?\d+\.\d+)/i);
        const lngMatch = text.match(/LNG:\s*([-]?\d+\.\d+)/i);
        const typeMatch = text.match(/TYPE:\s*(shahed|missile|kab)/i);
        const regionMatch = text.match(/REGION:\s*([a-z_]+)/i);
        const dirMatch = text.match(/DIR:\s*(\d+)/i);

        if (latMatch) result.lat = parseFloat(latMatch[1]);
        if (lngMatch) result.lng = parseFloat(lngMatch[1]);
        if (typeMatch) result.type = typeMatch[1].toLowerCase();
        if (regionMatch) result.region = regionMatch[1].toLowerCase();
        if (dirMatch) result.direction = parseInt(dirMatch[1], 10);

        return result;
    } catch (e) {
        return result;
    }
}

async function processTacticalText(text, source) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `STRICT TACTICAL ANALYST MODE.
            Input: "${text}"
            
            TASK: 
            1. Use Google Maps to find the EXACT LAT/LNG for the specific city, village, or landmark mentioned.
            2. Map the location to its administrative OBLAST ID.
            3. Estimate flight direction (DIR 0-360).
            
            Return ONLY this data format:
            TYPE: [shahed|missile|kab]
            REGION: [one of: ${OBLAST_IDS.join(", ")}]
            LAT: [precise latitude from Google Maps]
            LNG: [precise longitude from Google Maps]
            DIR: [0-360]
            CLEAR: [true|false]`,
            config: {
                tools: [{ googleMaps: {} }]
            }
        });

        const parsed = parseGroundedResponse(response.text);
        
        if (parsed.isClear) {
            airEvents = airEvents.filter(e => e.region !== parsed.region);
            return { cleared: true };
        }

        if (parsed.lat && parsed.lng) {
            const newEvent = {
                id: 'srv_' + Math.random().toString(36).substr(2, 9),
                type: parsed.type,
                region: parsed.region,
                lat: parsed.lat,
                lng: parsed.lng,
                direction: parsed.direction,
                timestamp: Date.now(),
                source: source || 'Intel',
                rawText: text,
                isVerified: true
            };
            airEvents.push(newEvent);
            return { event: newEvent };
        }
        return null;
    } catch (e) {
        console.error("AI Maps Grounding Error:", e);
        return null;
    }
}

// --- API ROUTES ---
app.get('/api/events', (req, res) => {
    res.json({ events: airEvents, scraper: { lastRun: Date.now(), status: 'active' } });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    const result = await processTacticalText(text, source);
    res.json({ success: !!result, ...result });
});

app.post('/api/force-scrape', (req, res) => {
    // Scraper trigger placeholder
    res.json({ success: true });
});

// --- STATIC ASSETS & SPA ROUTING ---
// Serve files from root and 'dist' (if exists)
const publicPath = path.join(__dirname);
const distPath = path.join(__dirname, 'dist');

app.use(express.static(publicPath));
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Global catch-all for SPA: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).send('API endpoint not found');
    
    const indexPath = fs.existsSync(path.join(distPath, 'index.html')) 
        ? path.join(distPath, 'index.html') 
        : path.join(publicPath, 'index.html');
        
    res.sendFile(indexPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] SkyWatch Tactical Node running on port ${PORT}`);
    console.log(`[SERVER] Serving static assets from ${publicPath}`);
});
