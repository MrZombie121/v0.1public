
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

const app = express();
app.use(cors());
app.use(express.json());

const getDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { events: [], logs: [], users: [], sources: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
        console.error("DB Read Error:", e);
        return { events: [], logs: [], users: [], sources: [] };
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
    const validEvents = db.events.filter(e => now - e.timestamp < 3600000);
    res.json({ events: validEvents, logs: db.logs.slice(0, 50), systemInitialized: db.users.length > 0 });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    const result = await processTacticalText(text, source);
    res.json({ success: !!result, ...result });
});

app.get('/api/admin/users', checkAdmin, (req, res) => {
    const db = getDB();
    res.json(db.users.map(u => ({ id: u.id, email: u.email, role: u.role })));
});

app.patch('/api/admin/users/:id/role', checkAdmin, (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.params.id);
    if (user) { user.role = req.body.role; saveDB(db); res.json({ success: true }); }
    else res.status(404).json({ error: "Not found" });
});

app.delete('/api/admin/users/:id', checkAdmin, (req, res) => {
    const db = getDB();
    db.users = db.users.filter(u => u.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

app.delete('/api/admin/event/:id', checkAdmin, (req, res) => {
    const db = getDB();
    db.events = db.events.filter(e => e.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze for SkyWatch: "${text}". 
            Format: TYPE: [shahed|missile|kab] REGION: [id] LAT: [float] LNG: [float] DIR: [0-360] CLEAR: [true|false]`,
            config: { tools: [{ googleMaps: {} }] }
        });
        const raw = response.text;
        const lat = parseFloat(raw.match(/LAT:\s*([-]?\d+\.\d+)/i)?.[1]);
        const lng = parseFloat(raw.match(/LNG:\s*([-]?\d+\.\d+)/i)?.[1]);
        const region = raw.match(/REGION:\s*([a-z_]+)/i)?.[1];
        const type = raw.match(/TYPE:\s*(shahed|missile|kab)/i)?.[1] || 'shahed';
        const isClear = raw.toLowerCase().includes('clear: true');
        const db = getDB();
        if (isClear && region) {
            db.events = db.events.filter(e => e.region !== region);
            db.logs.unshift({ id: Date.now().toString(), text: `CLEARED: ${region}`, source, timestamp: Date.now() });
            saveDB(db);
            return { cleared: true };
        }
        if (lat && lng) {
            const newEvent = { id: 'ev_' + Math.random().toString(36).substr(2, 9), type, region: region || 'sea', lat, lng, direction: 180, timestamp: Date.now(), source, rawText: text, isVerified: true, speed: type === 'missile' ? 850 : 185 };
            db.events.push(newEvent);
            db.logs.unshift({ id: Date.now().toString(), text: `DETECTION: ${type}`, source, timestamp: Date.now() });
            saveDB(db);
            return { event: newEvent };
        }
    } catch (e) { console.error("AI Error:", e); }
    return null;
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
    const target = fs.existsSync(path.join(distPath, 'index.html')) ? path.join(distPath, 'index.html') : path.join(__dirname, 'index.html');
    res.sendFile(target);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[SERVER] Tactical Node active on ${PORT}`));
