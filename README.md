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
- **Fog of War** - первые 5 ходов видна только своя половина доски; история ходов скрыта
- **Meteor Shower** - периодические метеориты сжигают клетки; сгоревшие клетки непроходимы и блокируют линии атаки (удары каждые 5 полных ходов)
- **Fischer Random (Chess960)** - случайная расстановка фигур на первом и восьмом рядах (слоны на разном цвете, король между ладьями)

### Мультиплеер
- Создание игр с уникальными ссылками
- Присоединение к играм по коду
- Обновления через WebSocket (реальное время)
- Система предложений ничьей
- Подтверждение сдачи
- Откат последнего хода (undo)

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

Ниже — фактические роуты из бэкенда (`server/routes.ts`). Параметры и тела запросов приведены кратко.

### Игры
- POST /api/games — создать игру
	- body: { rules?: GameRules[] }
	- Примечание: сервер сам создаёт временного игрока (white) и shareId.
- GET /api/games/:id — получить игру по id
- GET /api/games/share/:shareId — получить игру по коду приглашения
- POST /api/join-game — присоединиться к игре по shareId
	- body: { shareId: string }
	- Примечание: сервер создаёт временного игрока и пытается занять свободный слот (white/black).
- POST /api/games/join/:shareId — присоединиться к игре по shareId (альтернативный маршрут)
	- body: пусто (сервер сам генерирует playerId)

### Поток обновлений (SSE)
- GET /api/games/:id/stream — Server-Sent Events для игры
	- события: move, undo, status, draw; payload содержит тип и полезную нагрузку (например, последний ход).

### Ходы и история
- POST /api/games/:id/moves — сделать ход
	- body (InsertMove): {
		player: 'white' | 'black',
		moveNumber: number,
		from: 'e2',
		to: 'e4',
		piece: string,   // например 'white-pawn'; при промоции: 'white-queen'
		captured?: string,
		special?: string,
		fen: string
	}
	- Примечания:
		- Валидация учитывает спец-правила (double-knight, blink, pawn-rotation, xray-bishop, meteor-shower, castling/Chess960).
		- En passant (вкл. горизонтальный в pawn-rotation), рокировка (вкл. Chess960), промоция поддержаны.
- GET /api/games/:id/moves — получить историю ходов (массив Move)
- POST /api/games/:id/undo — отменить последний ход; пересобирает состояние с нуля
	- response: { success: boolean, gameState, currentTurn }

### Статус, захваченные фигуры
- PATCH /api/games/:id/status — обновить статус игры
	- body: { status: 'waiting'|'active'|'completed'|'draw'|'resigned', winner?: 'white'|'black'|'draw' }
- PATCH /api/games/:id/captured — обновить список захваченных фигур
	- body: { capturedPieces: { white: string[], black: string[] } }

### Ничья
- POST /api/games/:id/offer-draw — предложить ничью
	- body: { player: 'white' | 'black' }
- POST /api/games/:id/accept-draw — принять ничью
- POST /api/games/:id/decline-draw — отклонить ничью

### Аутентификация
- POST /api/auth/register — регистрация
	- body: { username: string, password: string, email: string, phone: string }
	- password: минимум 6 символов, только a-zA-Z0-9 (валидируется Zod)
- POST /api/auth/login — вход
	- body: { username: string, password: string }
- GET /api/auth/session — получить текущую сессию (401 если нет)
- POST /api/auth/logout — выход
- POST /api/auth/guest — гостевой пользователь (без сессии); при необходимости создаётся новый

### Правила (rules)
Поддерживаемые значения: 'standard', 'double-knight', 'pawn-rotation', 'xray-bishop', 'pawn-wall', 'blink', 'fog-of-war', 'meteor-shower', 'fischer-random'.
Некоторые правила влияют на стартовую позицию (pawn-wall, fischer-random), другие — на валидацию ходов.

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