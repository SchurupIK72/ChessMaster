# Инструкция по выгрузке проекта на GitHub

## Подготовка

1. Убедитесь, что у вас есть аккаунт на GitHub
2. Создайте новый репозиторий на GitHub: https://github.com/schurupik/src_test
3. Скопируйте URL репозитория

## Способ 1: Через командную строку (рекомендуется)

### Шаг 1: Инициализация Git (если еще не сделано)
```bash
git init
```

### Шаг 2: Добавление всех файлов
```bash
git add .
```

### Шаг 3: Создание первого коммита
```bash
git commit -m "Initial commit: Chess Master with special rules"
```

### Шаг 4: Подключение удаленного репозитория
```bash
git remote add origin https://github.com/schurupik/src_test.git
```

### Шаг 5: Отправка на GitHub
```bash
git push -u origin main
```

## Способ 2: Через интерфейс Replit

1. В Replit нажмите на вкладку "Version Control" (слева)
2. Нажмите "Connect to GitHub"
3. Авторизуйтесь в GitHub
4. Выберите репозиторий src_test
5. Нажмите "Connect"
6. Добавьте все файлы и создайте коммит
7. Нажмите "Push to GitHub"

## Что будет выгружено

### Структура проекта:
```
src_test/
├── client/                 # Frontend React приложение
│   ├── src/
│   │   ├── components/     # UI компоненты (шахматная доска, модалки)
│   │   ├── hooks/          # React hooks
│   │   ├── lib/            # Логика игры (ходы, правила)
│   │   ├── pages/          # Страницы (игра, авторизация)
│   │   ├── App.tsx         # Главный компонент
│   │   └── main.tsx        # Точка входа
│   └── index.html          # HTML шаблон
├── server/                 # Backend Express сервер
│   ├── db.ts              # Подключение к PostgreSQL
│   ├── index.ts           # Точка входа сервера
│   ├── routes.ts          # API маршруты и игровая логика
│   ├── storage.ts         # Слой данных (Drizzle ORM)
│   └── vite.ts            # Настройки Vite
├── shared/                 # Общие типы и схемы
│   └── schema.ts          # Zod схемы и TypeScript типы
├── package.json           # Зависимости и скрипты
├── package-lock.json      # Зафиксированные версии
├── vite.config.ts         # Конфигурация Vite
├── tailwind.config.ts     # Конфигурация Tailwind CSS
├── tsconfig.json          # Конфигурация TypeScript
├── drizzle.config.ts      # Конфигурация ORM
├── replit.md              # Документация проекта
└── README.md              # Инструкции по установке
```

### Исключенные файлы:
- `node_modules/` - зависимости (будут установлены через npm install)
- `dist/` - скомпилированные файлы
- `.git/` - история Git (если есть)
- `attached_assets/` - временные файлы
- `cookies.txt` - временные данные

## После выгрузки

### Клонирование и запуск:
```bash
# Клонировать репозиторий
git clone https://github.com/schurupik/src_test.git
cd src_test

# Установить зависимости
npm install

# Настроить переменные окружения
echo "DATABASE_URL=postgresql://user:password@localhost:5432/chess_db" > .env

# Применить миграции базы данных
npm run db:push

# Запустить приложение
npm run dev
```

## Особенности проекта

### Реализованные функции:
- ✅ Мультиплеерные шахматы с реальным временем
- ✅ 6 уникальных игровых режимов
- ✅ Система предложений ничьей с подтверждением
- ✅ Подтверждение сдачи
- ✅ Горизонтальное взятие на проходе в режиме PawnRotation
- ✅ Гостевая система с 50 предзаготовленными аккаунтами
- ✅ PostgreSQL база данных для множественных игр
- ✅ Русскоязычный интерфейс

### Игровые режимы:
1. **Standard** - классические шахматы
2. **Double Knight** - конь делает два хода подряд
3. **Pawn Rotation** - пешки ходят во все стороны с двойными ходами
4. **X-ray Bishop** - слон проходит через одну фигуру
5. **Pawn Wall** - двойные ряды пешек
6. **Blink** - король телепортируется один раз за игру

Все режимы можно комбинировать для уникальных игровых сессий!