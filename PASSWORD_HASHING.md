# 🔐 Хеширование паролей - Реализация

## ✅ Что было сделано

### 1️⃣ Установлена библиотека bcryptjs
```bash
npm install bcryptjs
```

### 2️⃣ Обновлены auth-маршруты

#### Регистрация (`POST /api/auth/register`)
```typescript
// Hash password before saving
const hashedPassword = await bcrypt.hash(validatedData.password, 10);

// Create user with hashed password
const user = await storage.createUser({
  username: validatedData.username,
  password: hashedPassword,  // ← Сейчас хешированный пароль
  email: validatedData.email,
  phone: validatedData.phone,
});
```

#### Логин (`POST /api/auth/login`)
```typescript
// Compare password with stored hash
const isPasswordValid = await bcrypt.compare(password, user.password);
if (!isPasswordValid) {
  return res.status(401).json({ message: 'Неверный никнейм или пароль' });
}
```

### 3️⃣ Обновлены временные пользователи

Добавлена вспомогательная функция:
```typescript
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
```

Обновлены места создания временных пользователей:
- ✅ Создание новой игры (`POST /api/games`)
- ✅ Присоединение к игре (`POST /api/join-game`)
- ✅ Гостевой пользователь (`POST /api/auth/guest`)

---

## 🔒 Как это работает

### Регистрация
```
1. Пользователь вводит пароль "password123"
2. bcrypt хеширует пароль → "$2a$10$..."
3. Хеш сохраняется в БД (оригинальный пароль нигде не сохраняется)
```

### Логин
```
1. Пользователь вводит пароль "password123"
2. bcrypt.compare() проверяет: входит ли пароль в хеш?
3. Если совпадает → авторизация успешна
   Если нет → ошибка "Неверный никнейм или пароль"
```

---

## 🛡️ Безопасность

| Параметр | Значение | Описание |
|----------|----------|---------|
| **Salt rounds** | 10 | Количество итераций хеширования (выше = медленнее, но безопаснее) |
| **Алгоритм** | bcrypt | Криптографически стойкий, специально для паролей |
| **Хранение** | Только хеш в БД | Оригинальный пароль не хранится |

---

## 📝 Изменённые файлы

### `server/routes.ts`
```diff
+ import bcrypt from "bcryptjs";

+ async function hashPassword(password: string): Promise<string> {
+   return bcrypt.hash(password, 10);
+ }

  // Регистрация: добавлено хеширование
  const hashedPassword = await bcrypt.hash(validatedData.password, 10);

  // Логин: добавлено сравнение хешей
  const isPasswordValid = await bcrypt.compare(password, user.password);

  // Временные пользователи: все теперь хешируют пароли
  const tempPasswordHash = await hashPassword('temp_password');
```

### `package.json`
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3"
  }
}
```

---

## ✨ Преимущества

✅ **Безопасно** - пароли не видны даже администраторам БД  
✅ **Откатываемо** - можно всегда пересчитать хеши если нужно  
✅ **Стандартно** - bcrypt это индустриальный стандарт  
✅ **Масштабируемо** - работает с PostgreSQL, MySQL и т.д.  

---

## 🧪 Тестирование

Локально протестировать можно:

```bash
# 1. Запустить сервер
npm run dev

# 2. Зарегистрировать пользователя
POST /api/auth/register
{
  "username": "testuser",
  "password": "test123456",
  "email": "test@example.com",
  "phone": "+1234567890"
}

# 3. Попытаться залогиниться с неправильным паролем
POST /api/auth/login
{
  "username": "testuser",
  "password": "wrongpassword"
}
# → Ошибка: "Неверный никнейм или пароль"

# 4. Залогиниться с правильным паролем
POST /api/auth/login
{
  "username": "testuser",
  "password": "test123456"
}
# → Успех!
```

---

## 📊 База данных

В таблице `users` поле `password` теперь содержит bcrypt хеш:

**Было:**
```
id | username  | password
1  | john      | mypassword
```

**Стало:**
```
id | username  | password
1  | john      | $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36puMmm6
```

---

## 🚨 Важно

- **БД миграция**: Уже существующие пароли в открытом виде остаются как есть
  - Решение: попросить пользователей сбросить пароли ("Забыли пароль?")
  - Или написать миграционный скрипт для существующих пользователей

- **Для Render**: Просто `git push` → автоматически всё обновится

---

## 🔄 Следующие шаги (рекомендации)

1. **Recovery email** - добавить восстановление пароля по email
2. **Rate limiting** - ограничить попытки логина (защита от перебора)
3. **HTTPS** - убедиться что в production используется HTTPS
4. **Session timeout** - добавить время жизни сеанса
5. **Password requirements** - усилить требования к паролям (большие буквы, специальные символы)
