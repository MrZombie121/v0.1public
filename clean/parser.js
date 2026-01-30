
import { TelegramClient, Logger } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import dotenv from "dotenv";
import fs from "fs";

// 1. Проверяем физическое наличие .env
if (!fs.existsSync(".env")) {
    console.error("\x1b[31m[!] ОШИБКА: Файл .env не найден в корневой папке!\x1b[0m");
    process.exit(1);
}

dotenv.config();

Logger.setLevel("error"); 

// Функция для максимально чистой очистки
const clean = (key) => {
    const raw = process.env[key] || "";
    // Удаляем кавычки, пробелы и комментарии (всё после #)
    return raw.toString().split('#')[0].replace(/["']/g, "").trim();
};

const rawId = clean("TG_API_ID");
const apiHash = clean("TG_API_HASH");
const sessionString = clean("TG_STRING_SESSION");

// API_ID ДОЛЖЕН БЫТЬ ЧИСЛОМ
const apiId = parseInt(rawId.replace(/\D/g, ""), 10);

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000/api/ingest";
const TARGET_CHANNELS = ["vanek_nikolaev", "kpszsu", "monitor_ua_1", "oddesitmedia"];

async function startClient() {
    console.log("\x1b[36m%s\x1b[0m", "==========================================");
    console.log("\x1b[36m%s\x1b[0m", "   SkyWatch TG Parser - STABLE MODE      ");
    console.log("\x1b[36m%s\x1b[0m", "==========================================");

    // Отладочная информация
    console.log(`[*] Данные инициализации:`);
    console.log(`    - ID:   ${apiId} (Тип: ${typeof apiId})`);
    console.log(`    - Hash: ${apiHash.substring(0, 4)}... (Длина: ${apiHash.length})`);
    
    if (isNaN(apiId) || apiId === 0) {
        console.error("\x1b[31m[!] ОШИБКА: TG_API_ID не является числом!\x1b[0m");
        process.exit(1);
    }
    if (apiHash.length < 10) {
        console.error("\x1b[31m[!] ОШИБКА: TG_API_HASH некорректен!\x1b[0m");
        process.exit(1);
    }

    // Используем более "человеческие" параметры устройства
    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
        connectionRetries: 5,
        deviceModel: "Desktop",
        systemVersion: "Windows 10",
        appVersion: "4.8.4",
        useWSS: false,
    });
    
    try {
        console.log(`[*] Подключение к серверам Telegram...`);
        await client.connect();

        const isAuthorized = await client.checkAuthorization();
        
        if (isAuthorized) {
            console.log("\x1b[32m%s\x1b[0m", "[v] Авторизация подтверждена.");
        } else {
            console.log("\x1b[33m%s\x1b[0m", "[!] Требуется новая сессия.");
            
            await client.start({
                phoneNumber: async () => await input.text("Введите ваш номер телефона: "),
                password: async () => await input.text("Пароль 2FA (если есть): "),
                phoneCode: async () => await input.text("Код подтверждения: "),
                onError: (err) => {
                    console.error("\x1b[31m[!] Ошибка входа:\x1b[0m", err.message);
                    if (err.message.includes("API_ID_INVALID")) {
                        console.log("\nСОВЕТ: Если ID верный, попробуйте создать новое приложение (App) на my.telegram.org через 1-2 часа.");
                    }
                },
            });

            const savedSession = client.session.save();
            console.log("\x1b[32m%s\x1b[0m", "\n[УСПЕХ] Вход выполнен.");
            console.log("\nВАША СЕССИЯ (сохраните в TG_STRING_SESSION):");
            console.log("\x1b[44m%s\x1b[0m", savedSession);
        }

        console.log(`\n[*] Слушаю каналы: ${TARGET_CHANNELS.join(", ")}`);

        client.addEventHandler(async (event) => {
            const message = event.message;
            if (message && message.text) {
                try {
                    const chat = await message.getChat();
                    const username = chat.username?.toLowerCase();
                    
                    if (username && TARGET_CHANNELS.includes(username)) {
                        console.log(`[${new Date().toLocaleTimeString()}] @${username}: ${message.text.substring(0, 60)}...`);
                        
                        await fetch(BACKEND_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: message.text, source: username })
                        }).catch(e => console.error("Ошибка отправки на сервер:", e.message));
                    }
                } catch (e) {}
            }
        });

    } catch (e) {
        console.error("\x1b[31m[КРИТИЧЕСКАЯ ОШИБКА]:\x1b[0m", e.message);
    }
}

startClient();
