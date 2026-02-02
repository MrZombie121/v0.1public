
@echo off
title SkyWatch UA - System Starter
echo ==========================================
echo    SkyWatch UA: Проверка окружения...
echo ==========================================

:: 1. Проверка Node.js
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] ОШИБКА: Node.js не установлен! 
    echo Скачайте его с https://nodejs.org/
    pause
    exit /b
)

:: 2. Проверка node_modules
if not exist node_modules (
    echo [!] Библиотеки не найдены. Начинаю установку (npm install)...
    echo Это может занять пару минут, пожалуйста, подождите...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [!!!] ОШИБКА ПРИ УСТАНОВКЕ [!!!]
        echo Попробуйте выполнить команды вручную:
        echo 1. npm cache clean --force
        echo 2. npm install
        echo.
        pause
        exit /b
    )
    echo [v] Установка завершена успешно.
)

:: 3. Проверка API ключа
if "%API_KEY%"=="" (
    echo.
    echo [?] Для работы ИИ нужен Gemini API KEY.
    echo Вы можете получить его бесплатно на https://aistudio.google.com/app/apikey
    set /p API_KEY="Введите ваш API KEY (или нажмите Enter, чтобы пропустить): "
)

echo.
echo ==========================================
echo    ЗАПУСК ВСЕХ СИСТЕМ...
echo ==========================================
echo.

:: Запуск через concurrently
npm run start:all

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Произошла ошибка при запуске. 
    echo Проверьте, не заняты ли порты 3000 или 5173 другими программами.
)

pause
