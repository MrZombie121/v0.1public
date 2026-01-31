
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
        console.error("DB Read Error:", e);
        return { events: [], logs: [], users: [], sources: DEFAULT_SOURCES };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("DB Write Error:", e);
        return false;
    }
};

const app = express();
app.use(cors());
app.use(express.json());

// --- AUTH MIDDLEWARE ---
function checkAdmin(req, res, next) {
    const token = req.headers['auth-token'];
    if (!token) return res.status(403).json({ error: "No token" });
    try {
        const [email, password] = Buffer.from(token, 'base64').toString().split(':');
        const db = getDB();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (user && user.role === 'admin') next();
        else res.status(403).json({ error: "Admin access required" });
    } catch (e) { res.status(403).json({ error: "Invalid token" }); }
}

app.get('/api/sources', (req, res) => {
    const db = getDB();
    res.json(db.sources || []);
});

app.post('/api/admin/sources', checkAdmin, (req, res) => {
    const { name, type } = req.body;
    const db = getDB();
    const newSource = { id: 's_' + Date.now(), name, type: type || 'telegram', enabled: true };
    db.sources = db.sources || [];
    db.sources.push(newSource);
    saveDB(db);
    res.json(newSource);
});

app.delete('/api/admin/sources/:id', checkAdmin, (req, res) => {
    const db = getDB();
    db.sources = (db.sources || []).filter(s => s.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ success: false, message: "User exists" });
    const role = db.users.length === 0 ? 'admin' : 'user';
    const newUser = { id: 'u_' + Math.random().toString(36).substr(2, 9), email, password, role };
    db.users.push(newUser);
    saveDB(db);
    res.json({ success: true, user: { email: newUser.email, role: newUser.role }, token: Buffer.from(`${email}:${password}`).toString('base64') });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (user) res.json({ success: true, user: { email: user.email, role: user.role }, token: Buffer.from(`${email}:${password}`).toString('base64') });
    else res.status(401).json({ success: false, message: "Invalid credentials" });
});

app.get('/api/events', (req, res) => {
    const db = getDB();
    const now = Date.now();
    const validEvents = (db.events || []).filter(e => now - e.timestamp < 3600000);
    res.json({ events: validEvents, logs: (db.logs || []).slice(0, 50), systemInitialized: (db.users || []).length > 0 });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    console.log(`[INGEST] Source: ${source}, Text: ${text}`);
    
    // HARD-CODED TEST OVERRIDE: If text has "тест" or "test", always create an event in Odesa
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
            source: source || 'Manual_Test',
            rawText: text,
            isVerified: false,
            speed: 180
        };
        db.events.push(testEvent);
        db.logs.unshift({ id: 'log_' + Date.now(), text: `TEST SPARKED: Odesa Node`, source, timestamp: Date.now() });
        saveDB(db);
        return res.json({ success: true, event: testEvent });
    }

    const result = await processTacticalText(text, source);
    res.json({ success: !!result, ...result });
});

app.delete('/api/admin/event/:id', checkAdmin, (req, res) => {
    const db = getDB();
    db.events = (db.events || []).filter(e => e.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) {
        console.error("[CRITICAL] Missing API_KEY in environment");
        return null;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `REPORT: "${text}".
            Identify threats in Ukraine. 
            Output format:
            TYPE: [shahed|missile|kab]
            REGION: [odesa|kyiv|kharkiv|lviv|dnipro|etc]
            LAT: [latitude]
            LNG: [longitude]
            DIR: [0-360]
            CLEAR: [true|false]`,
            config: { 
                tools: [{ googleMaps: {} }],
                systemInstruction: "Military intel parser. Map regions to coordinates. If uncertain, use regional center." 
            }
        });
        
        const raw = response.text || "";
        console.log(`[AI RAW]: ${raw}`);

        const latMatch = raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i);
        const lngMatch = raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i);
        const lat = latMatch ? parseFloat(latMatch[1]) : null;
        const lng = lngMatch ? parseFloat(lngMatch[1]) : null;
        const region = raw.match(/REGION:\s*([a-z_]+)/i)?.[1];
        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1] || 'shahed';
        const isClear = raw.toLowerCase().includes('clear: true');
        
        const db = getDB();
        if (isClear && region) {
            db.events = db.events.filter(e => !e.region.includes(region));
            db.logs.unshift({ id: 'log_'+Date.now(), text: `CLEARANCE: ${region.toUpperCase()}`, source, timestamp: Date.now() });
            saveDB(db);
            return { cleared: true };
        }
        
        if (lat && lng) {
            const newEvent = { 
                id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
                type, region: region || 'unknown', lat, lng, 
                direction: parseInt(raw.match(/DIR:\s*(\d+)/i)?.[1] || '180'), 
                timestamp: Date.now(), source, rawText: text, isVerified: true, speed: type === 'missile' ? 850 : 185 
            };
            db.events.push(newEvent);
            db.logs.unshift({ id: 'log_'+Date.now(), text: `CONTACT: ${type.toUpperCase()} @ ${region ? region.toUpperCase() : 'GRID'}`, source, timestamp: Date.now() });
            saveDB(db);
            return { event: newEvent };
        }
    } catch (e) { 
        console.error("AI FAIL:", e.message); 
    }
    return null;
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: "404" });
    const target = fs.existsSync(path.join(distPath, 'index.html')) ? path.join(distPath, 'index.html') : path.join(__dirname, 'index.html');
    res.sendFile(target);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[NODE] SkyWatch Tactical active on ${PORT}`));
