
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
        // Ensure sources exist
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

// --- SOURCES API ---
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

// --- AUTH API ---
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

// --- TACTICAL API ---
app.get('/api/events', (req, res) => {
    const db = getDB();
    const now = Date.now();
    // Increase validity to 1 hour
    const validEvents = db.events.filter(e => now - e.timestamp < 3600000);
    res.json({ events: validEvents, logs: db.logs.slice(0, 50), systemInitialized: db.users.length > 0 });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    const result = await processTacticalText(text, source);
    res.json({ success: !!result, ...result });
});

app.delete('/api/admin/event/:id', checkAdmin, (req, res) => {
    const db = getDB();
    db.events = db.events.filter(e => e.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) {
        console.error("Missing API_KEY in environment");
        return null;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const prompt = `TACTICAL INTEL REPORT: "${text}" (Source: ${source})
        Task: Identify air threats in Ukraine. 
        Note: If message mentions "тест" or "test", pick a major city like Odesa (46.48, 30.72) and create a shahed event.
        Output EXACT format:
        TYPE: [shahed|missile|kab]
        REGION: [id] (odesa, kyiv, kharkiv, lviv, etc.)
        LAT: [decimal_lat]
        LNG: [decimal_lng]
        DIR: [0-360]
        CLEAR: [true|false]`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { 
              tools: [{ googleMaps: {} }],
              systemInstruction: "You are a tactical military sensor. Your primary goal is to extract coordinates and threat types from text. Always provide coordinates for identified locations."
            }
        });
        
        const raw = response.text || "";
        console.log(`[AI RESPONSE]: ${raw.substring(0, 100)}...`);

        const latMatch = raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i);
        const lngMatch = raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i);
        
        const lat = latMatch ? parseFloat(latMatch[1]) : null;
        const lng = lngMatch ? parseFloat(lngMatch[1]) : null;
        const region = raw.match(/REGION:\s*([a-z_]+)/i)?.[1];
        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1] || 'shahed';
        const isClear = raw.toLowerCase().includes('clear: true');
        
        const db = getDB();
        if (isClear && region) {
            db.events = db.events.filter(e => e.region !== region);
            db.logs.unshift({ id: 'log_'+Date.now(), text: `CLEARED: ${region.toUpperCase()}`, source, timestamp: Date.now() });
            saveDB(db);
            return { cleared: true };
        }
        
        if (lat && lng) {
            const newEvent = { 
                id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
                type, 
                region: region || 'unknown', 
                lat, 
                lng, 
                direction: parseInt(raw.match(/DIR:\s*(\d+)/i)?.[1] || '180'), 
                timestamp: Date.now(), 
                source, 
                rawText: text, 
                isVerified: true, 
                speed: type === 'missile' ? 850 : 185 
            };
            db.events.push(newEvent);
            db.logs.unshift({ id: 'log_'+Date.now(), text: `DETECTED: ${type.toUpperCase()} @ ${region ? region.toUpperCase() : 'GRID'}`, source, timestamp: Date.now() });
            saveDB(db);
            return { event: newEvent };
        }
    } catch (e) { 
        console.error("AI Processing Failure:", e.message); 
    }
    return null;
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Route Not Found" });
    const target = fs.existsSync(path.join(distPath, 'index.html')) ? path.join(distPath, 'index.html') : path.join(__dirname, 'index.html');
    res.sendFile(target);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[SERVER] SkyWatch Tactical Node online on port ${PORT}`));
