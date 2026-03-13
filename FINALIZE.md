# 🎬 Finalize: Команды для коммита

## Выполните эти команды по порядку:

```bash
# 1. Добавьте миграции в git
git add drizzle/

# 2. Добавьте обновленные файлы конфигурации
git add drizzle.config.ts package.json

# 3. Добавьте инструкцию
git add RENDER_DEPLOYMENT.md

# 4. Создайте коммит
git commit -m "🗄️ Setup production Drizzle migrations for Render deployment

- Updated drizzle.config.ts: out -> ./drizzle directory
- Added db:generate and db:migrate npm scripts
- Generated initial migration 0000_eager_layla_miller.sql (3 tables)
- Added RENDER_DEPLOYMENT.md with deployment instructions
- Set up for production-safe database migrations on Render"

# 5. Загрузите на GitHub
git push origin main
```

## После этого на Render:

1. Перейдите в настройки Web Service → Settings
2. Найдите "Build & Deploy" → "Start Command"
3. Измените на:
   ```
   npm run db:migrate && npm start
   ```
4. Сохраните и перезагрузите сервис

---

## ✅ Проверка на Render

После развертывания в логах должны появиться строки:
```
> db:migrate
drizzle-kit: connected to database
drizzle-kit: applying migrations...
drizzle-kit: migration 0000_eager_layla_miller.sql applied successfully ✓
Server running on port...
```

---

## 🎯 Готово!

Теперь ваша БД будет обновляться безопасно через версионированные SQL миграции 🚀
