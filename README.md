# Chess Master - Special Rules Edition

Веб-приложение шахмат с уникальными правилами и мультиплеерными функциями.

## Особенности

### Игровые режимы
- **Стандартные шахматы** - классические правила
- **Double Knight** - конь должен сделать два хода подряд
- **Pawn Rotation** - пешки могут ходить горизонтально и вертикально
- **X-ray Bishop** - слон может проходить через одну фигуру
- **Pawn Wall** - двойной ряд пешек на старте
- **Blink** - король может телепортироваться один раз за игру

### Мультиплеер
- Создание игр с уникальными ссылками
- Присоединение к играм по коду
- Реальное время обновления (500мс)
- Система предложений ничьей
- Подтверждение сдачи

### Интерфейс
- Русский язык
- Классическая зеленая доска
- Отображение захваченных фигур
- История ходов
- Статус игры в реальном времени

## Технологии

### Frontend
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query (React Query)
- Wouter (роутинг)
- Framer Motion (анимации)

### Backend
- Node.js + Express
- PostgreSQL + Drizzle ORM
- WebSocket для реального времени
- Express Sessions

### Архитектура
- Monorepo с общими типами
- Валидация через Zod
- Серверная логика игры
- Клиентская валидация ходов

## Установка

```bash
# Клонировать репозиторий
git clone https://github.com/schurupik72/ChessMaster.git
cd ChessMaster

# Установить зависимости
npm install

# Настроить базу данных
# Установить PostgreSQL и создать базу данных
# Установить переменную окружения DATABASE_URL

# Применить миграции
npm run db:push

# Запустить приложение
npm run dev
```

## Переменные окружения

```env
DATABASE_URL=postgresql://user:password@localhost:5432/chess_db
```

## Структура проекта

```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # UI компоненты
│   │   ├── hooks/       # React hooks
│   │   ├── lib/         # Логика игры
│   │   └── pages/       # Страницы
├── server/          # Express backend
│   ├── db.ts           # Подключение к БД
│   ├── routes.ts       # API маршруты
│   └── storage.ts      # Слой данных
├── shared/          # Общие типы и схемы
│   └── schema.ts       # Zod схемы и типы
└── package.json     # Зависимости
```

## API Endpoints

### Игры
- `POST /api/games` - создать игру
- `GET /api/games/:id` - получить игру
- `POST /api/games/join/:shareId` - присоединиться к игре
- `POST /api/games/:id/moves` - сделать ход
- `PATCH /api/games/:id/status` - обновить статус

### Предложения ничьей
- `POST /api/games/:id/offer-draw` - предложить ничью
- `POST /api/games/:id/accept-draw` - принять ничью
- `POST /api/games/:id/decline-draw` - отклонить ничью

### Пользователи
- `POST /api/users` - создать пользователя
- `GET /api/users/:id` - получить пользователя

## Разработка

### Добавление новых правил

1. Обновить тип `GameRules` в `shared/schema.ts`
2. Добавить логику в `server/routes.ts` (функция `applyAllSpecialRules`)
3. Обновить клиентскую логику в `client/src/lib/chess-logic.ts`
4. Добавить описание в `client/src/components/rule-selection-modal.tsx`

### Тестирование

```bash
# Запустить тесты
npm test

# Запустить с отладкой
npm run dev:debug
```

## Лицензия

MIT License