#!/bin/bash

# Скрипт для развертывания проекта Chess Master

echo "🚀 Начинаем развертывание Chess Master..."

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js версии 18 или выше."
    exit 1
fi

# Проверка наличия npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не найден. Установите npm."
    exit 1
fi

echo "✅ Node.js и npm найдены"

# Установка зависимостей
echo "📦 Устанавливаем зависимости..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi

echo "✅ Зависимости установлены"

# Проверка переменных окружения
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL не установлен. Создайте файл .env с настройками базы данных."
    echo "Пример:"
    echo "DATABASE_URL=postgresql://user:password@localhost:5432/chess_db"
fi

# Применение миграций базы данных
echo "🗄️  Применяем миграции базы данных..."
npm run db:push

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при применении миграций. Проверьте настройки базы данных."
    exit 1
fi

echo "✅ Миграции применены"

# Сборка проекта
echo "🔨 Собираем проект..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Проект собран для продакшена"
    echo "🚀 Можно запускать: npm start"
else
    echo "⚠️  Ошибка сборки, но dev-режим должен работать"
    echo "🚀 Запустите в dev-режиме: npm run dev"
fi

echo ""
echo "🎉 Развертывание завершено!"
echo ""
echo "Доступные команды:"
echo "  npm run dev    - запуск в режиме разработки"
echo "  npm run build  - сборка для продакшена"
echo "  npm start      - запуск продакшн версии"
echo "  npm run db:push - применение миграций БД"
echo ""
echo "🌐 Приложение будет доступно на: http://localhost:5000"