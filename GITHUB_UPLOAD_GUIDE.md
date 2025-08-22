# 🚀 Полная инструкция по выгрузке Chess Master на GitHub

## Метод 1: Через Replit (Самый простой)

### Шаг 1: Подключение к GitHub
1. В левой панели Replit найдите вкладку **"Version Control"** (иконка ветки Git)
2. Нажмите **"Connect to GitHub"**
3. Войдите в свой аккаунт GitHub
4. Разрешите доступ Replit к вашему GitHub

### Шаг 2: Создание репозитория
1. В том же меню выберите **"Create Repository"**
2. Введите название: `src_test`
3. Выберите **Public** или **Private**
4. Нажмите **"Create Repository"**

### Шаг 3: Первый коммит
1. В поле "Commit message" введите: `Initial commit: Chess Master with special rules`
2. Нажмите **"Commit & Push"**
3. Подождите завершения загрузки

## Метод 2: Через командную строку

### Подготовка
```bash
# В терминале Replit выполните:
git config --global user.name "Ваше имя"
git config --global user.email "ваш@email.com"
```

### Загрузка
```bash
# Инициализация (если нужно)
git init

# Добавление всех файлов
git add .

# Создание коммита
git commit -m "Initial commit: Chess Master with special rules"

# Подключение к GitHub репозиторию
git remote add origin https://github.com/schurupik72/ChessMaster.git

# Отправка на GitHub
git push -u origin main
```

## Метод 3: Ручная загрузка файлов

### Если Git не работает:
1. Создайте репозиторий на GitHub вручную: https://github.com/new
2. Скачайте все файлы проекта как ZIP архив
3. Распакуйте и загрузите файлы через веб-интерфейс GitHub

## Структура проекта, которая будет загружена:

```
src_test/
├── 📁 client/               # Frontend приложение
│   ├── 📁 src/
│   │   ├── 📁 components/   # UI компоненты
│   │   │   ├── chess-board.tsx
│   │   │   ├── game-status.tsx
│   │   │   ├── move-history.tsx
│   │   │   ├── rule-selection-modal.tsx
│   │   │   └── ...
│   │   ├── 📁 hooks/        # React hooks
│   │   ├── 📁 lib/          # Игровая логика
│   │   │   ├── chess-logic.ts
│   │   │   ├── chess-rules.ts
│   │   │   └── queryClient.ts
│   │   ├── 📁 pages/        # Страницы
│   │   │   ├── chess-game.tsx
│   │   │   └── auth.tsx
│   │   ├── App.tsx          # Главный компонент
│   │   ├── main.tsx         # Точка входа
│   │   └── index.css        # Стили
│   └── index.html           # HTML шаблон
├── 📁 server/               # Backend сервер
│   ├── db.ts               # База данных
│   ├── index.ts            # Сервер
│   ├── routes.ts           # API и игровая логика
│   ├── storage.ts          # Управление данными
│   └── vite.ts             # Настройки Vite
├── 📁 shared/               # Общие типы
│   └── schema.ts           # Схемы и типы
├── 📁 scripts/              # Скрипты развертывания
│   └── deploy.sh           # Автоматическая установка
├── 📄 README.md             # Документация проекта
├── 📄 DEPLOY_TO_GITHUB.md   # Инструкции по развертыванию
├── 📄 .gitignore            # Исключения Git
├── 📄 .env.example          # Пример настроек
├── 📄 replit.md             # Техническая документация
├── 📄 package.json          # Зависимости проекта
├── 📄 vite.config.ts        # Конфигурация сборки
├── 📄 tailwind.config.ts    # Настройки стилей
├── 📄 tsconfig.json         # TypeScript настройки
└── 📄 drizzle.config.ts     # База данных ORM
```

## Что делать после загрузки на GitHub

### 1. Клонирование проекта
```bash
git clone https://github.com/schurupik72/ChessMaster.git
cd src_test
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка базы данных
```bash
# Создайте файл .env на основе .env.example
cp .env.example .env

# Отредактируйте .env файл с вашими настройками PostgreSQL
# DATABASE_URL=postgresql://username:password@localhost:5432/chess_db
```

### 4. Применение миграций
```bash
npm run db:push
```

### 5. Запуск приложения
```bash
# Режим разработки
npm run dev

# Приложение будет доступно на: http://localhost:5000
```

## Особенности Chess Master

### ✅ Реализованные функции:
- **6 уникальных игровых режимов** с возможностью комбинирования
- **Мультиплеер в реальном времени** (обновления каждые 500мс)
- **Система предложений ничьей** с подтверждением
- **Подтверждение сдачи** для предотвращения случайных нажатий
- **Горизонтальное взятие на проходе** в режиме PawnRotation
- **50 предзаготовленных гостевых аккаунтов**
- **PostgreSQL база данных** для множественных игр
- **Полностью русский интерфейс**

### 🎯 Игровые режимы:
1. **Standard** - классические шахматы
2. **Double Knight** - конь делает два хода подряд
3. **Pawn Rotation** - пешки ходят во все стороны
4. **X-ray Bishop** - слон проходит через одну фигуру
5. **Pawn Wall** - двойные ряды пешек на старте
6. **Blink** - король телепортируется один раз за игру

### 🔧 Технологии:
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query
- **Backend**: Node.js, Express, PostgreSQL, Drizzle ORM
- **Архитектура**: Monorepo с общими типами и валидацией

## Готово! 🎉

Ваш проект Chess Master теперь доступен на GitHub по адресу:
**https://github.com/schurupik72/ChessMaster**

Любой пользователь сможет:
- Клонировать репозиторий
- Установить зависимости
- Настроить базу данных
- Запустить полнофункциональное шахматное приложение с уникальными правилами!