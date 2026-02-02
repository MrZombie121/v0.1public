#!/bin/bash
echo "=========================================="
echo "   SkyWatch UA: Запуск всех систем..."
echo "=========================================="

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "[!] Установка зависимостей..."
    npm install --legacy-peer-deps
fi

# Проверка API ключа
if [ -z "$API_KEY" ]; then
    read -p "Введите ваш Gemini API KEY: " API_KEY
    export API_KEY=$API_KEY
fi

npm run start:all