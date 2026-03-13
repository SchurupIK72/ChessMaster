# 🚀 Инструкция развертывания на Render

## ✅ Что было сделано

### 1️⃣ Обновлен `drizzle.config.ts`
```typescript
export default defineConfig({
  out: "./drizzle",  // ← Папка для миграций
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

### 2️⃣ Добавлены скрипты в `package.json`
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",  // Генерация SQL миграций
    "db:migrate": "drizzle-kit migrate",    // Выполнение миграций
    "build": "...",
    "start": "..."
  }
}
```

### 3️⃣ Сгенерирована первая миграция
```
drizzle/
  ├── 0000_eager_layla_miller.sql  (3 таблицы: games, moves, users)
  └── meta/
```

---

## 🎯 Что сделать на Render

### Шаг 1: Коммит миграций в GitHub

```bash
git add drizzle/
git add drizzle.config.ts
git add package.json
git commit -m "🗄️ Setup production Drizzle migrations for Render"
git push origin main
```

### Шаг 2: Настройка Render Web Service

В консоли Render для вашего Web Service измените командуStart Command:

```bash
npm run db:migrate && npm start
```

**Вместо текущей:**
```bash
npm start
```

### Шаг 3: Установить переменные окружения (если нет)

В Render Console → Environment:
- `DATABASE_URL` - ваша PostgreSQL connection string
- `NODE_ENV` - `production`

---

## 📊 Как работает процесс

```
1. Render получает push
2. npm run build      (собирает приложение)
3. npm run db:migrate (применяет новые миграции)
4. npm start          (стартует сервер)
```

### Что происходит внутри миграции:

Drizzle создает служебную таблицу:
```sql
__drizzle_migrations
```

Она отслеживает:
- ✅ Какие миграции уже применены
- ✅ Новые применяются только один раз
- ✅ Старые не повторяются

---

## 🔄 Когда вы меняете schema.ts

### Локально:

```bash
# 1. Меняете shared/schema.ts
# 2. Генерируете SQL
npm run db:generate

# Создается новый файл:
# drizzle/0001_*.sql

# 3. Коммитите
git add drizzle/
git commit -m "migration: add new table"
git push
```

### На Render автоматически:

1. Получает новый SQL файл
2. Запускает `npm run db:migrate`
3. Применяет только новую миграцию
4. Сервер стартует

---

## ✨ Преимущества такого подхода

✅ **Безопасно** - версионированные SQL миграции  
✅ **Воспроизводимо** - одинаково везде (dev, staging, production)  
✅ **Отслеживаемо** - все миграции в git  
✅ **Rollback** - можно откатить любую миграцию  
✅ **Масштабируемо** - на Render, AWS, DigitalOcean и т.д.  

---

## 🐛 Проверка логов

На Render проверьте состояние миграций в логах:

```
drizzle-kit: connecting to database...
drizzle-kit: applied migrations [0000_eager_layla_miller.sql]
Server running on port 5000...
```

---

## 📝 Локальное тестирование (опционально)

Чтобы протестировать локально с настоящей БД:

```bash
npm run db:migrate
npm run dev
```

Если что-то пошло не так, просто удалите записи из `__drizzle_migrations` таблицы и попробуйте снова.

---

## 🚨 Важно

**НЕ** используйте `npm run db:push` на production!  
Используйте только версионированные SQL миграции через `npm run db:migrate`.
