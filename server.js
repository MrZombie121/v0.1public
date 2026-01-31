
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
    { id: "s4", name: "oddesitmedia", type: "telegram", enabled: true }
];

const getDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { events: [], logs: [], users: [], sources: DEFAULT_SOURCES };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
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

// API Endpoints
app.get('/api/events', (req, res) => {
    const db = getDB();
    const now = Date.now();
    // Фильтруем старые события (старше 1 часа)
    const valid = (db.events || []).filter(e => now - e.timestamp < 3600000);
    res.json({ 
        events: valid, 
        logs: (db.logs || []).slice(0, 50), 
        systemInitialized: (db.users || []).length > 0 
    });
});

app.get('/api/sources', (req, res) => res.json(getDB().sources || []));

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    console.log(`[INGEST] Request from ${source}: ${text}`);
    const result = await processTacticalText(text, source);
    if (result) res.json({ success: true, ...result });
    else res.status(422).json({ success: false, message: "Could not parse threat" });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) {
        console.error("API_KEY MISSING");
        return null;
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: `Identify threats in Ukrainian tactical text: "${text}". 
            Output format MUST be: TYPE:[shahed|missile|kab] REGION:[id] LAT:[lat] LNG:[lng] DIR:[0-360]
            Valid regions: odesa, kyiv, kharkiv, lviv, dnipro, zaporizhzhia, mykolaiv, kherson, chernihiv, sumy, poltava, vinnytsia, cherkasy, khmelnytskyi, zhytomyr, rivne, lutsk, ternopil, if, uzhhorod, chernivtsi, kirovohrad, donetsk, luhansk, crimea.`,
        });

        const raw = response.text || "";
        console.log("[AI RESPONSE]", raw);

        let lat = parseFloat(raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i)?.[1]);
        let lng = parseFloat(raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i)?.[1]);
        const region = raw.match(/REGION:\s*([a-z_]+)/i)?.[1].toLowerCase() || 'kyiv';
        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1].toLowerCase() || 'shahed';
        const dir = parseInt(raw.match(/DIR:\s*(\d+)/i)?.[1]) || 180;

        // Fallback to region center if AI fails to give precise coordinates
        if (!lat || !lng) {
            const coords = REGION_COORDS[region] || REGION_COORDS.kyiv;
            lat = coords.lat;
            lng = coords.lng;
        }

        const db = getDB();
        const event = {
            id: 'ev_' + Date.now() + Math.random().toString(36).substr(2, 5),
            type,
            region, 
            lat, 
            lng,
            startLat: lat,
            startLng: lng,
            direction: dir,
            timestamp: Date.now(), 
            source, 
            rawText: text,
            isVerified: !text.toLowerCase().includes('тест'),
            speed: type === 'missile' ? 850 : 185
        };

        db.events.push(event);
        db.logs.unshift({ 
            id: 'log_'+Date.now(), 
            text: `DETECTION: ${type.toUpperCase()} -> ${region.toUpperCase()}`, 
            source, 
            timestamp: Date.now() 
        });
        saveDB(db);
        return { event };
    } catch (e) { 
        console.error("AI Ingest Error:", e); 
    }
    return null;
}

// Auth & Admin placeholders
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const isFirst = db.users.length === 0;
    const newUser = { id: 'u_'+Date.now(), email, password, role: isFirst ? 'owner' : 'user' };
    db.users.push(newUser);
    saveDB(db);
    const token = Buffer.from(`${email}:${password}`).toString('base64');
    res.json({ success: true, user: { email, role: newUser.role }, token });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ success: false });
    const token = Buffer.from(`${email}:${password}`).toString('base64');
    res.json({ success: true, user: { email, role: user.role }, token });
});

app.delete('/api/admin/event/:id', (req, res) => {
    const db = getDB();
    db.events = db.events.filter(e => e.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

// Hosting support
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: "404" });
    const distIndex = path.join(distPath, 'index.html');
    if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Tactical Hub active on ${PORT}`));
