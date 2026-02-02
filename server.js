
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import axios from 'axios';
import { startScraper } from './scraper.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');
const GEOJSON_REMOTE_URL = 'https://raw.githubusercontent.com/VadimGue/ukraine-geojson/master/ukraine.json';

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
            const initial = { events: [], logs: [], users: [], sources: DEFAULT_SOURCES, maintenanceMode: false, maintenanceUntil: 0 };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        if (data.maintenanceMode === undefined) data.maintenanceMode = false;
        if (data.maintenanceUntil === undefined) data.maintenanceUntil = 0;
        return data;
    } catch (e) {
        return { events: [], logs: [], users: [], sources: DEFAULT_SOURCES, maintenanceMode: false, maintenanceUntil: 0 };
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

app.get('/api/status', (req, res) => {
    const db = getDB();
    res.json({ 
        maintenanceMode: db.maintenanceMode,
        maintenanceUntil: db.maintenanceUntil,
        systemInitialized: (db.users || []).length > 0 
    });
});

app.get('/api/map-data', async (req, res) => {
    try {
        const response = await axios.get(GEOJSON_REMOTE_URL, { timeout: 10000 });
        res.json(response.data);
    } catch (err) {
        console.error("Failed to proxy GeoJSON:", err.message);
        res.status(502).json({ error: "Failed to fetch map data" });
    }
});

app.get('/api/events', (req, res) => {
    const db = getDB();
    const role = req.headers['x-user-role'];
    
    if (db.maintenanceMode && role !== 'owner') {
        return res.status(503).json({ 
            error: "MAINTENANCE_ACTIVE", 
            maintenance: true,
            until: db.maintenanceUntil 
        });
    }

    const now = Date.now();
    const valid = (db.events || []).filter(e => now - e.timestamp < 3600000);
    res.json({ 
        events: valid, 
        logs: (db.logs || []).slice(0, 50), 
        systemInitialized: (db.users || []).length > 0,
        maintenanceMode: db.maintenanceMode,
        maintenanceUntil: db.maintenanceUntil
    });
});

app.get('/api/sources', (req, res) => res.json(getDB().sources || []));

app.post('/api/admin/maintenance', (req, res) => {
    const { enabled, until, userRole } = req.body;
    if (userRole !== 'owner') return res.status(403).json({ success: false });
    
    const db = getDB();
    db.maintenanceMode = !!enabled;
    db.maintenanceUntil = until ? parseInt(until) : 0;
    saveDB(db);
    res.json({ success: true, maintenanceMode: db.maintenanceMode, maintenanceUntil: db.maintenanceUntil });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ success: false });

    if (text.toLowerCase().includes('тест')) {
        const db = getDB();
        const regions = Object.keys(REGION_COORDS);
        const randomRegion = regions[Math.floor(Math.random() * regions.length)];
        const coords = REGION_COORDS[randomRegion];
        const testEvent = {
            id: 'ev_test_' + Date.now(),
            type: 'shahed',
            region: randomRegion,
            lat: coords.lat + (Math.random() - 0.5) * 0.2,
            lng: coords.lng + (Math.random() - 0.5) * 0.2,
            direction: Math.floor(Math.random() * 360),
            timestamp: Date.now(),
            source: source || 'HUD_SYSTEM',
            rawText: text,
            isVerified: false,
            speed: 180
        };
        db.events.push(testEvent);
        db.logs.unshift({ id: 'log_'+Date.now(), text: `TEST: ${randomRegion.toUpperCase()}`, source: source || 'SYSTEM', timestamp: Date.now() });
        saveDB(db);
        return res.json({ success: true, event: testEvent });
    }

    const result = await processTacticalText(text, source);
    if (result) res.json({ success: true, ...result });
    else res.status(422).json({ success: false, message: "AI processing failed" });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Identify air threat: "${text}". Format: TYPE:[shahed|missile|kab] REGION:[id] LAT:[decimal] LNG:[decimal] DIR:[degrees]`,
        });
        const raw = response.text || "";
        const lat = parseFloat(raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i)?.[1]);
        const lng = parseFloat(raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i)?.[1]);
        const region = raw.match(/REGION:\s*([a-z_]+)/i)?.[1]?.toLowerCase() || 'kyiv';
        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1]?.toLowerCase() || 'shahed';
        const dir = parseInt(raw.match(/DIR:\s*(\d+)/i)?.[1]) || 180;
        const db = getDB();
        const finalLat = isNaN(lat) ? (REGION_COORDS[region]?.lat || 50.45) : lat;
        const finalLng = isNaN(lng) ? (REGION_COORDS[region]?.lng || 30.52) : lng;
        const event = {
            id: 'ev_' + Date.now(),
            type, region, lat: finalLat, lng: finalLng, direction: dir, timestamp: Date.now(), source, rawText: text,
            isVerified: true, speed: type === 'missile' ? 850 : 185
        };
        db.events.push(event);
        db.logs.unshift({ id: 'log_'+Date.now(), text: `DETECT: ${type.toUpperCase()} @ ${region.toUpperCase()}`, source, timestamp: Date.now() });
        saveDB(db);
        return { event };
    } catch (e) { return null; }
}

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const newUser = { id: 'u_'+Date.now(), email, password, role: db.users.length === 0 ? 'owner' : 'user' };
    db.users.push(newUser);
    saveDB(db);
    res.json({ success: true, user: { email, role: newUser.role }, token: 'tk_'+Date.now() });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ success: false });
    res.json({ success: true, user: { email, role: user.role }, token: 'tk_'+Date.now() });
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).end();
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Listening on ${PORT}`);
    startScraper(PORT);
});
