
import { TelegramClient, Logger } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import dotenv from "dotenv";
import fs from "fs";
import axios from 'axios';

if (!fs.existsSync(".env")) {
    console.error("\x1b[31m[!] ОШИБКА: Файл .env не найден!\x1b[0m");
    process.exit(1);
}

dotenv.config();
Logger.setLevel("error"); 

const clean = (key) => {
    const raw = process.env[key] || "";
    return raw.toString().split('#')[0].replace(/["']/g, "").trim();
};

const rawId = clean("TG_API_ID");
const apiHash = clean("TG_API_HASH");
const sessionString = clean("TG_STRING_SESSION");
const apiId = parseInt(rawId.replace(/\D/g, ""), 10);

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const BACKEND_URL = `${BASE_URL}/api/ingest`;
const SOURCES_URL = `${BASE_URL}/api/sources`;

let activeChannels = [];

async function updateSources() {
    try {
        const { data } = await axios.get(SOURCES_URL);
        activeChannels = data
            .filter(s => s.enabled && s.type === 'telegram')
            .map(s => s.name.toLowerCase());
        console.log(`[PARSER] Синхронизация источников: ${activeChannels.length} активных каналов.`);
    } catch (e) {
        console.error("[PARSER] Ошибка обновления источников:", e.message);
    }
}

async function startClient() {
    console.log("\x1b[36m%s\x1b[0m", "==========================================");
    console.log("\x1b[36m%s\x1b[0m", "   SkyWatch TG Parser - DYNAMIC MODE     ");
    console.log("\x1b[36m%s\x1b[0m", "==========================================");

    if (isNaN(apiId) || apiId === 0) {
        console.error("\x1b[31m[!] ОШИБКА: TG_API_ID некорректен!\x1b[0m");
        process.exit(1);
    }

    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
        connectionRetries: 5,
        deviceModel: "Tactical Node",
        systemVersion: "Linux",
        appVersion: "1.0.0",
    });
    
    try {
        await client.connect();
        const isAuthorized = await client.checkAuthorization();
        
        if (!isAuthorized) {
            console.log("\x1b[33m%s\x1b[0m", "[!] Требуется авторизация...");
            await client.start({
                phoneNumber: async () => await input.text("Номер: "),
                password: async () => await input.text("2FA: "),
                phoneCode: async () => await input.text("Код: "),
            });
            console.log("\x1b[32m%s\x1b[0m", "СЕССИЯ СОХРАНЕНА В TG_STRING_SESSION");
            console.log(client.session.save());
        }

        await updateSources();
        // Обновляем список источников каждую минуту
        setInterval(updateSources, 60000);

        client.addEventHandler(async (event) => {
            const message = event.message;
            if (message && message.text) {
                try {
                    const chat = await message.getChat();
                    const username = chat.username?.toLowerCase();
                    
                    if (username && activeChannels.includes(username)) {
                        console.log(`[${new Date().toLocaleTimeString()}] @${username}: ${message.text.substring(0, 50)}...`);
                        
                        await axios.post(BACKEND_URL, {
                            text: message.text,
                            source: username
                        }).catch(e => console.error("Ошибка Ingest:", e.message));
                    }
                } catch (e) {}
            }
        });

        console.log("\x1b[32m%s\x1b[0m", "[v] Система прослушивания активна.");

    } catch (e) {
        console.error("\x1b[31m[КРИТИЧЕСКАЯ ОШИБКА]:\x1b[0m", e.message);
    }
}

startClient();