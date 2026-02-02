
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import axios from 'axios';
import pg from 'pg';
import { startScraper } from './scraper.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEOJSON_REMOTE_URL = 'https://raw.githubusercontent.com/VadimGue/ukraine-geojson/master/ukraine.json';

// PostgreSQL Configuration
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("\x1b[31m[CRITICAL] DATABASE_URL is missing in environment variables!\x1b[0m");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

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

const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("[SERVER] Connected to PostgreSQL successfully");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT,
        region TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        direction INTEGER,
        timestamp BIGINT,
        source TEXT,
        raw_text TEXT,
        is_verified BOOLEAN,
        speed INTEGER
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        text TEXT,
        source TEXT,
        timestamp BIGINT
      );
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        type TEXT,
        enabled BOOLEAN
      );
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value JSONB
      );
    `);

    await client.query(`
      INSERT INTO system_settings (key, value) 
      VALUES ('maintenance', '{"mode": false, "until": 0}') 
      ON CONFLICT (key) DO NOTHING;
    `);

    const defaultSources = [
      ['s1', 'vanek_nikolaev', 'telegram', true],
      ['s2', 'kpszsu', 'telegram', true],
      ['s3', 'war_monitor', 'telegram', true],
      ['s4', 'oddesitmedia', 'telegram', true]
    ];
    for (const src of defaultSources) {
      await client.query(`
        INSERT INTO sources (id, name, type, enabled) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (name) DO NOTHING;
      `, src);
    }
    console.log("[SERVER] Schema verified/initialized");
  } catch (err) {
    console.error("\x1b[31m[DB ERROR]\x1b[0m:", err.message);
    throw err;
  } finally {
    if (client) client.release();
  }
};

const app = express();
app.use(cors());
app.use(express.json());

const getMaintenanceState = async () => {
  try {
    const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance'");
    return rows[0]?.value || { mode: false, until: 0 };
  } catch (e) {
    return { mode: false, until: 0 };
  }
};

app.get('/api/status', async (req, res) => {
    try {
        const maint = await getMaintenanceState();
        const { rows: users } = await pool.query("SELECT count(*) FROM users");
        res.json({ 
            maintenanceMode: maint.mode,
            maintenanceUntil: maint.until,
            systemInitialized: parseInt(users[0].count) > 0 
        });
    } catch (e) {
        res.status(500).json({ error: "DB connection failed" });
    }
});

app.get('/api/map-data', async (req, res) => {
    try {
        const response = await axios.get(GEOJSON_REMOTE_URL, { timeout: 10000 });
        res.json(response.data);
    } catch (err) {
        res.status(502).json({ error: "Failed to fetch map data" });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const role = req.headers['x-user-role'];
        const maint = await getMaintenanceState();
        
        if (maint.mode && role !== 'owner') {
            return res.status(503).json({ 
                error: "MAINTENANCE_ACTIVE", 
                maintenance: true,
                until: maint.until 
            });
        }

        const oneHourAgo = Date.now() - 3600000;
        const { rows: events } = await pool.query("SELECT * FROM events WHERE timestamp > $1", [oneHourAgo]);
        const { rows: logs } = await pool.query("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50");
        const { rows: users } = await pool.query("SELECT count(*) FROM users");

        res.json({ 
            events: events.map(e => ({ ...e, isVerified: e.is_verified, rawText: e.raw_text })), 
            logs, 
            systemInitialized: parseInt(users[0].count) > 0,
            maintenanceMode: maint.mode,
            maintenanceUntil: maint.until
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sources', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM sources");
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/maintenance', async (req, res) => {
    const { enabled, until, userRole } = req.body;
    if (userRole !== 'owner') return res.status(403).json({ success: false });
    
    const newValue = { mode: !!enabled, until: until ? parseInt(until) : 0 };
    await pool.query("UPDATE system_settings SET value = $1 WHERE key = 'maintenance'", [newValue]);
    res.json({ success: true, ...newValue });
});

app.post('/api/ingest', async (req, res) => {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ success: false });

    if (text.toLowerCase().includes('тест')) {
        const regions = Object.keys(REGION_COORDS);
        const region = regions[Math.floor(Math.random() * regions.length)];
        const coords = REGION_COORDS[region];
        const eventId = 'ev_test_' + Date.now();
        const timestamp = Date.now();
        
        const event = [
            eventId, 'shahed', region, 
            coords.lat + (Math.random() - 0.5) * 0.2, 
            coords.lng + (Math.random() - 0.5) * 0.2, 
            Math.floor(Math.random() * 360), timestamp, source || 'HUD_SYSTEM', text, false, 180
        ];

        await pool.query(`
            INSERT INTO events (id, type, region, lat, lng, direction, timestamp, source, raw_text, is_verified, speed) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, event);

        await pool.query("INSERT INTO logs (id, text, source, timestamp) VALUES ($1, $2, $3, $4)", 
            ['log_'+Date.now(), `TEST: ${region.toUpperCase()}`, source || 'SYSTEM', timestamp]);

        return res.json({ success: true });
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
        
        const finalLat = isNaN(lat) ? (REGION_COORDS[region]?.lat || 50.45) : lat;
        const finalLng = isNaN(lng) ? (REGION_COORDS[region]?.lng || 30.52) : lng;
        const timestamp = Date.now();
        const id = 'ev_' + timestamp;
        const speed = type === 'missile' ? 850 : 185;

        await pool.query(`
            INSERT INTO events (id, type, region, lat, lng, direction, timestamp, source, raw_text, is_verified, speed) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, type, region, finalLat, finalLng, dir, timestamp, source, text, true, speed]);

        await pool.query("INSERT INTO logs (id, text, source, timestamp) VALUES ($1, $2, $3, $4)", 
            ['log_'+Date.now(), `DETECT: ${type.toUpperCase()} @ ${region.toUpperCase()}`, source, timestamp]);

        return { success: true };
    } catch (e) { return null; }
}

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
      const { rows: userCount } = await pool.query("SELECT count(*) FROM users");
      const role = parseInt(userCount[0].count) === 0 ? 'owner' : 'user';
      const id = 'u_'+Date.now();
      await pool.query("INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)", [id, email, password, role]);
      res.json({ success: true, user: { email, role }, token: 'tk_'+Date.now() });
    } catch (e) {
      res.status(400).json({ success: false, message: "Email already registered or DB error" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const { rows: users } = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
      if (users.length === 0) return res.status(401).json({ success: false });
      res.json({ success: true, user: { email: users[0].email, role: users[0].role }, token: 'tk_'+Date.now() });
    } catch (e) {
      res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/event/:id', async (req, res) => {
    try {
      await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false });
    }
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).end();
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[SERVER] Listening on ${PORT}`);
    try {
        await initDB();
        console.log("[SERVER] Database ready");
        startScraper(PORT);
    } catch (e) {
        console.error("[CRITICAL] Server failed to start due to DB initialization error.");
        process.exit(1);
    }
});
