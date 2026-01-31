
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
const DB_PATH = path.join(__dirname, 'db.json');

// Координаты областных центров для подстраховки
const REGION_COORDS = {
    odesa: { lat: 46.48, lng: 30.72 },
    kyiv: { lat: 50.45, lng: 30.52 },
    kharkiv: { lat: 49.99, lng: 36.23 },
    lviv: { lat: 49.83, lng: 24.02 },
    dnipro: { lat: 48.46, lng: 35.04 },
    zaporizhzhia: { lat: 47.83, lng: 35.13 },
    mykolaiv: { lat: 46.97, lng: 31.99 },
    kherson: { lat: 46.63, lng: 32.61 },
    chernihiv: { lat: 51.49, lng: 31.28 },
    sumy: { lat: 50.90, lng: 34.79 },
    poltava: { lat: 49.58, lng: 34.55 },
    vinnytsia: { lat: 49.23, lng: 28.46 },
    cherkasy: { lat: 49.44, lng: 32.05 },
    khmelnytskyi: { lat: 49.42, lng: 26.98 },
    zhytomyr: { lat: 50.25, lng: 28.65 },
    rivne: { lat: 50.61, lng: 26.25 },
    lutsk: { lat: 50.74, lng: 25.32 },
    ternopil: { lat: 49.55, lng: 25.59 },
    if: { lat: 48.92, lng: 24.71 },
    uzhhorod: { lat: 48.62, lng: 22.28 },
    chernivtsi: { lat: 48.29, lng: 25.93 },
    kirovohrad: { lat: 48.50, lng: 32.26 },
    donetsk: { lat: 48.00, lng: 37.80 },
    luhansk: { lat: 48.57, lng: 39.31 },
    crimea: { lat: 45.00, lng: 34.00 }
};

const DEFAULT_SOURCES = [
    { id: "s1", name: "vanek_nikolaev", type: "telegram", enabled: true },
    { id: "s2", name: "kpszsu", type: "telegram", enabled: true },
    { id: "s3", name: "war_monitor", type: "telegram", enabled: true },
    { id: "s4", name: "odecit", type: "telegram", enabled: true },
    { id: "s5", name: "oddesitmedia", type: "telegram", enabled: true }
];

const getDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { events: [], logs: [], users: [], sources: DEFAULT_SOURCES };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        if (!data.sources || data.sources.length === 0) {
            data.sources = DEFAULT_SOURCES;
            saveDB(data);
        }
        return data;
    } catch (e) {
        return { events: [], logs: [], users: [], sources: DEFAULT_SOURCES };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        return false;
    }
};

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/sources', (req, res) => {
    const db = getDB();
    res.json(db.sources || []);
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    console.log(`[INGEST] From ${source}: ${text.substring(0, 50)}...`);
    
    if (text.toLowerCase().includes('тест') || text.toLowerCase().includes('test')) {
        const db = getDB();
        const testEvent = {
            id: 'ev_test_' + Date.now(),
            type: 'shahed',
            region: 'odesa',
            lat: 46.48,
            lng: 30.72,
            direction: 180,
            timestamp: Date.now(),
            source: source || 'MANUAL',
            rawText: text,
            isVerified: false,
            speed: 180
        };
        db.events.push(testEvent);
        db.logs.unshift({ id: 'log_' + Date.now(), text: `TEST SIGNAL: ODESA`, source, timestamp: Date.now() });
        saveDB(db);
        return res.json({ success: true, event: testEvent });
    }

    const result = await processTacticalText(text, source);
    res.json({ success: !!result, ...result });
});

app.get('/api/events', (req, res) => {
    const db = getDB();
    const now = Date.now();
    const validEvents = (db.events || []).filter(e => now - e.timestamp < 3600000);
    res.json({ events: validEvents, logs: (db.logs || []).slice(0, 50), systemInitialized: db.users.length > 0 });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) {
        console.error("[CRITICAL] API_KEY not set");
        return null;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `TACTICAL INTEL: "${text}".
            Identify threat type, region, and coordinates.
            Output exactly:
            TYPE: [shahed|missile|kab]
            REGION: [id] (odesa, kyiv, kharkiv, lviv, etc.)
            LAT: [decimal_lat]
            LNG: [decimal_lng]
            DIR: [0-360]
            CLEAR: [true|false]`,
            config: { 
                tools: [{ googleMaps: {} }],
                systemInstruction: "You are a military radar analyst. Extract geolocation and threat type. Use precise coordinates if available." 
            }
        });
        
        const raw = response.text || "";
        console.log(`[AI RESPONSE]: ${raw}`);

        const latMatch = raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i);
        const lngMatch = raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i);
        const regionMatch = raw.match(/REGION:\s*([a-z_]+)/i);
        
        let region = regionMatch ? regionMatch[1].toLowerCase() : 'grid';
        let lat = latMatch ? parseFloat(latMatch[1]) : null;
        let lng = lngMatch ? parseFloat(lngMatch[1]) : null;
        
        // Fallback to region center if AI didn't provide coords but gave region
        if ((!lat || !lng) && REGION_COORDS[region]) {
            lat = REGION_COORDS[region].lat;
            lng = REGION_COORDS[region].lng;
            console.log(`[FALLBACK] Using coordinates for ${region}`);
        }

        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1] || 'shahed';
        
        if (lat && lng) {
            const db = getDB();
            const newEvent = { 
                id: 'ev_' + Date.now(), 
                type, region, lat, lng, 
                direction: parseInt(raw.match(/DIR:\s*(\d+)/i)?.[1] || '180'), 
                timestamp: Date.now(), source, rawText: text, isVerified: true, speed: type === 'missile' ? 850 : 185 
            };
            db.events.push(newEvent);
            db.logs.unshift({ id: 'log_'+Date.now(), text: `CONTACT: ${type.toUpperCase()} @ ${region.toUpperCase()}`, source, timestamp: Date.now() });
            saveDB(db);
            return { event: newEvent };
        }
    } catch (e) { console.error("AI FAIL:", e.message); }
    return null;
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).send("404");
    const target = fs.existsSync(path.join(distPath, 'index.html')) ? path.join(distPath, 'index.html') : path.join(__dirname, 'index.html');
    res.sendFile(target);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[SKYWATCH] Tactical Node online on ${PORT}`));
