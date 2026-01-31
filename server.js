
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
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
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

// --- AUTH MIDDLEWARE ---
function checkPrivileged(req, res, next) {
    const token = req.headers['auth-token'];
    if (!token) return res.status(403).json({ error: "Unauthorized" });
    try {
        const [email, password] = Buffer.from(token, 'base64').toString().split(':');
        const db = getDB();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (user && (user.role === 'admin' || user.role === 'owner')) next();
        else res.status(403).json({ error: "Access Denied" });
    } catch (e) { res.status(403).json({ error: "Invalid token" }); }
}

function checkOwner(req, res, next) {
    const token = req.headers['auth-token'];
    if (!token) return res.status(403).json({ error: "Unauthorized" });
    try {
        const [email, password] = Buffer.from(token, 'base64').toString().split(':');
        const db = getDB();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (user && user.role === 'owner') next();
        else res.status(403).json({ error: "Owner access required" });
    } catch (e) { res.status(403).json({ error: "Invalid token" }); }
}

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Missing credentials" });

    const db = getDB();
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: "Operator already exists" });
    }

    const isFirstUser = db.users.length === 0;
    const newUser = {
        id: 'user_' + Date.now(),
        email,
        password,
        role: isFirstUser ? 'owner' : 'user'
    };

    db.users.push(newUser);
    saveDB(db);

    const token = Buffer.from(`${email}:${password}`).toString('base64');
    res.json({ success: true, user: { email, role: newUser.role }, token });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);

    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = Buffer.from(`${email}:${password}`).toString('base64');
    res.json({ success: true, user: { email, role: user.role }, token });
});

// --- ADMIN/OWNER ENDPOINTS ---
app.get('/api/admin/users', checkPrivileged, (req, res) => {
    const db = getDB();
    const safeUsers = db.users.map(({ id, email, role }) => ({ id, email, role }));
    res.json(safeUsers);
});

app.post('/api/admin/system-reset', checkOwner, (req, res) => {
    const initial = { events: [], logs: [], users: [], sources: DEFAULT_SOURCES };
    if (saveDB(initial)) {
        res.json({ success: true, message: "System wiped" });
    } else {
        res.status(500).json({ error: "Reset failed" });
    }
});

app.patch('/api/admin/users/:id/role', checkOwner, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.id === id);
    if (user) {
        user.role = role;
        saveDB(db);
        res.json({ success: true });
    } else res.status(404).json({ error: "User not found" });
});

app.post('/api/admin/sources', checkPrivileged, (req, res) => {
    const { name, type } = req.body;
    const db = getDB();
    const newSource = { id: 's_' + Date.now(), name, type, enabled: true };
    db.sources.push(newSource);
    saveDB(db);
    res.json({ success: true });
});

app.delete('/api/admin/sources/:id', checkPrivileged, (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.sources = db.sources.filter(s => s.id !== id);
    saveDB(db);
    res.json({ success: true });
});

app.delete('/api/admin/event/:id', checkPrivileged, (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.events = db.events.filter(e => e.id !== id);
    saveDB(db);
    res.json({ success: true });
});

// Batch delete all test events
app.delete('/api/admin/events/tests', checkPrivileged, (req, res) => {
    const db = getDB();
    db.events = db.events.filter(e => e.isVerified !== false);
    saveDB(db);
    res.json({ success: true, message: "All test signals purged" });
});

// --- PUBLIC DATA ENDPOINTS ---
app.get('/api/sources', (req, res) => {
    const db = getDB();
    res.json(db.sources || []);
});

app.get('/api/events', (req, res) => {
    const db = getDB();
    const now = Date.now();
    const validEvents = (db.events || []).filter(e => now - e.timestamp < 3600000);
    res.json({ 
        events: validEvents, 
        logs: (db.logs || []).slice(0, 50), 
        systemInitialized: (db.users || []).length > 0 
    });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ error: "Empty text" });

    const result = await processTacticalText(text, source);
    if (result) {
        res.json({ success: true, ...result });
    } else {
        res.status(422).json({ success: false, message: "Failed to parse" });
    }
});

async function processTacticalText(text, source) {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-latest",
            contents: `Analyze: "${text}". Identify air threats. 
            Format: TYPE:[shahed|missile|kab] REGION:[id] LAT:[lat] LNG:[lng] DIR:[0-360]`,
            config: { tools: [{ googleMaps: {} }] }
        });
        
        const raw = response.text || "";
        const latMatch = raw.match(/LAT:\s*([-]?\d+(\.\d+)?)/i);
        const lngMatch = raw.match(/LNG:\s*([-]?\d+(\.\d+)?)/i);
        const regionMatch = raw.match(/REGION:\s*([a-z_]+)/i);
        const typeMatch = raw.match(/TYPE:\s*(shahed|missile|kab)/i);
        const dirMatch = raw.match(/DIR:\s*(\d+)/i);

        let lat = latMatch ? parseFloat(latMatch[1]) : null;
        let lng = lngMatch ? parseFloat(lngMatch[1]) : null;
        let region = regionMatch ? regionMatch[1].toLowerCase() : 'grid';

        if ((!lat || !lng) && REGION_COORDS[region]) {
            lat = REGION_COORDS[region].lat;
            lng = REGION_COORDS[region].lng;
        }

        if (lat && lng) {
            const db = getDB();
            const newEvent = { 
                id: 'ev_' + Date.now(),
                type: (typeMatch ? typeMatch[1].toLowerCase() : 'shahed'),
                region, lat, lng, 
                direction: (dirMatch ? parseInt(dirMatch[1]) : 180),
                timestamp: Date.now(), 
                source, rawText: text, isVerified: !text.toLowerCase().includes('тест'), 
                speed: (raw.includes('missile') ? 850 : 185)
            };
            db.events.push(newEvent);
            db.logs.unshift({ id: 'log_'+Date.now(), text: `CONTACT: ${newEvent.type.toUpperCase()} @ ${region.toUpperCase()}`, source, timestamp: Date.now() });
            saveDB(db);
            return { event: newEvent };
        }
    } catch (e) { console.error(e); }
    return null;
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use(express.static(__dirname));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).send("404");
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Tactical Node Active on ${PORT}`));
