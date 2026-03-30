# Security & Rules Hardening - Bugfix Specification
> **Дата создания:** 2026-03-30
> **Ветка:** `bugfix/security-rules-hardening`
> **Тип:** bugfix
> **Статус:** В работе
> **Источник:** `fixed spec.md`

---

## Workflow выполнения

### Порядок выполнения для bugfix-задачи

| Шаг | Действие | Навык | Статус |
| --- | --- | --- | --- |
| а | Создание ТЗ + Ветка | `spec-creation` | Завершён |
| б | Реализация | `spec-implementer` | В работе |
| в | Написание тестов | `test-writer` | Не начат |
| г | GUI и smoke testing | `gui-testing` | Не начат |
| д | Финализация и merge | `merge-helper` | Не начат |

### Текущий статус
- Этап 3 завершён: legacy `status` endpoint закрыт, `resign` переведён на explicit server-owned flow, клиент больше не завершает матч вручную.
- Следующий шаг: реализовать этап 4 через `spec-implementer`.

---

## Видение

ChessMaster должен перестать доверять клиенту в вопросах шахматной логики, авторизации игровых действий и производных полей состояния партии. Сервер должен стать единственным источником истины для легальности хода, принадлежности пользователя к партии, статуса матча, истории ходов и завершения сессии, а клиент должен выполнять только UX-функцию.

**Ключевые требования:**
- Нелегальный ход через прямой API-запрос не применяется.
- Игровые действия разрешены только участникам соответствующей партии и только в пределах их роли.
- История ходов и производные поля формируются только на сервере.
- Logout завершает реальную серверную сессию и не позволяет клиенту самовольно восстановить authenticated state.
- Ошибки сервера не приводят к падению процесса.

---

## Контекст и бизнес-ценность

### Проблема
- Сервер частично доверяет клиентским данным для move payload и derived game state.
- Некоторые mutating endpoints позволяют участнику партии менять опасное состояние напрямую.
- Auth/session flow всё ещё частично опирается на client-side storage как на источник текущего пользователя.
- Registration flow непоследовательно обрабатывает duplicate constraints.
- Global error handler обрабатывает ответ небезопасно и может уронить runtime.

### Кому это важно
- Игрокам: чтобы партия была честной, воспроизводимой и защищённой от прямых API-эксплойтов.
- Владельцу проекта: чтобы multiplayer не ломался от простых abuse-сценариев.
- Разработке: чтобы rules engine, rebuild и auth-flow были детерминированными и тестируемыми.

### Бизнес-результат
- Снижается риск сломанных партий и рассинхронов после `undo`, refresh и special-rule сценариев.
- API становится безопаснее для production-использования.
- Проект получает базу для дальнейшего развития online-режима без накопления client-trust debt.

---

## Scope

### Входит в задачу
- Разделение public request schemas и DB insert schemas.
- Session-based ownership для всех mutating game actions.
- Server-side move validation и server-owned move normalization.
- Удаление или жёсткое ограничение опасных `status` / `captured` routes.
- Logout, который корректно завершает серверную и клиентскую сессию.
- Корректная обработка duplicate `phone`.
- Безопасный global error handling.
- Automated tests на ownership, illegal moves, rebuild parity, logout и registration errors.

### Не входит в задачу
- Редизайн UI авторизации или игрового экрана.
- Добавление новых custom rules.
- Полная миграция legacy game records на новую ownership-модель.
- Изменение core gameplay за пределами hardening и parity.

---

## Ограничения

- Нельзя ломать существующие сценарии: создание игры, join по коду, стандартный ход, promotion, draw-flow, `void`.
- Нужно сохранить поддержку правил:
  - `standard`
  - `double-knight`
  - `pawn-rotation`
  - `xray-bishop`
  - `pawn-wall`
  - `blink`
  - `fog-of-war`
  - `meteor-shower`
  - `fischer-random`
  - `void`
- Итоговое решение должно проходить `npm run check` и automated tests.

---

## Функциональные требования

### FR-1. Public API schemas отделены от DB insert schemas
- Внешние payloads не используют `insert*Schema` таблиц как публичный контракт.
- Для mutating endpoints существуют отдельные request schemas.
- Move endpoint принимает только входные параметры действия, а не derived server fields.

### FR-2. Сервер полностью валидирует легальность хода
- Сервер проверяет геометрию фигуры, блокировки, взятия, en passant, castling, promotion и king safety.
- Нелегальный ход через API всегда возвращает `400`.
- Special rules проверяются на сервере и не могут быть обойдены прямым POST.

### FR-3. Сервер является источником истины для истории партии
- Поля `player`, `piece`, `captured`, `special`, `moveNumber`, `fen` формируются на сервере.
- History сохраняется в нормализованном виде.
- `rebuildGameStateFromMoves` восстанавливает состояние без зависимости от клиентских допущений.

### FR-4. Все игровые действия авторизованы по сессии
- Сервер использует `session.userId` для определения текущего пользователя.
- Create game и join game используют текущую сессию, а не случайный `playerId`.
- Не-участник партии не может ходить, делать `undo`, предлагать/принимать draw или менять состояние партии.

### FR-5. Опасные state endpoints ограничены
- Произвольная смена `status` клиентом запрещена.
- Прямое обновление `capturedPieces` клиентом запрещено или заменено внутренним server flow.
- Смена состояния партии допускается только через проверенные сценарии: resign, draw-flow, auto-complete по checkmate/stalemate/timeout.

### FR-6. Logout завершает серверную и клиентскую сессию
- Frontend вызывает `POST /api/auth/logout`.
- После logout очищаются localStorage, runtime state и React Query cache.
- После reload пользователь не восстанавливается в authenticated state без серверной сессии.

### FR-7. Registration корректно обрабатывает duplicate phone
- До вставки пользователя проверяются `username`, `email`, `phone`.
- Duplicate constraint по телефону возвращает понятную business error с кодом `400`.

### FR-8. Global error handling безопасен
- Error handler не бросает ошибку повторно после отправки ответа.
- Ошибка логируется, но runtime продолжает работать.

---

## Нефункциональные требования

### NFR-1. Надёжность
- После `undo`, refresh и повторной загрузки состояние партии не расходится с историей.

### NFR-2. Безопасность
- Запросы извне не позволяют ход за чужой цвет или подмену server-owned полей.

### NFR-3. Тестопригодность
- Основная business-логика должна быть вынесена в тестируемые модули.
- В проекте должен работать `test` script с regression scenarios.

### NFR-4. Совместимость
- UI может оставаться близким к текущему, но не должен использовать `localStorage` как источник прав на действие.

---

## План реализации

### Этап 1: API Contracts & Session Ownership (~150-250 строк)
**Статус:** Завершён

**Цель:** отделить внешний API contract от DB models и закрыть ownership на уровне session-based auth.

**Задачи:**
- [x] Создать public request schemas для auth, create game, join, move, draw и resign/status-like действий.
- [x] Перевести `guest`, `create game`, `join game` и mutating game actions на обязательное использование `session.userId`.
- [x] Добавить или дооформить server-side helper для определения роли пользователя в партии: `white`, `black`, `spectator`.
- [x] Ограничить публичные маршруты, которые позволяют клиенту менять производное состояние напрямую.

**Файлы:**
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
- при необходимости новый файл `server/game-auth.ts`

**Критерии приёмки:**
- Запрос без валидной сессии к mutating game endpoints получает `401` или `403`.
- `POST /api/games` и `POST /api/games/join/:shareId` не используют клиентский `playerId`.
- Public request schemas не совпадают с DB insert schemas.

---

### Этап 2: Server-side Move Validation & Move Normalization (~180-280 строк)
**Статус:** Завершён

**Цель:** убрать доверие к клиентским move fields и сделать сервер авторитетным для сохранения хода.

**Задачи:**
- [x] Усилить server-side проверку стандартного move flow: geometry, blocking, captures, en passant, castling, promotion, king safety.
- [x] Перестать принимать от клиента `player`, `piece`, `captured`, `moveNumber`, `fen` как authoritative values.
- [x] Нормализовать move record на сервере перед сохранением.
- [x] Зафиксировать auto-complete сценарии завершения партии внутри server move flow.

**Файлы:**
- `server/routes.ts`
- при необходимости новый файл `server/move-validation.ts`
- `shared/schema.ts`

**Критерии приёмки:**
- Прямой POST с нелегальным стандартным ходом возвращает `400`.
- Сервер не допускает bypass клиентской логики через ручной request body.
- Сохранённый move record формируется только из серверных вычислений.

---

### Этап 3: Complex Mode Parity & Unsafe Endpoint Cleanup (~180-280 строк)
**Статус:** Завершён

**Цель:** выровнять parity между live path и rebuild для сложных режимов и закрыть опасные state mutations.

**Задачи:**
- [x] Проверить и выровнять `void`, `double-knight`, `fischer-random` между live route и `rebuildGameStateFromMoves`.
- [x] Убедиться, что `undo` в сложных режимах восстанавливает то же состояние, что и live match.
- [x] Удалить или жёстко ограничить `status` и `captured` endpoints.
- [x] Перевести resign и terminal transitions на explicit server-owned flows.

**Файлы:**
- `server/routes.ts`
- при необходимости новый файл `server/game-rebuild.ts`
- `client/src/pages/chess-game.tsx`

**Критерии приёмки:**
- После `undo` в `void` и `double-knight` состояние совпадает с ожидаемым.
- Клиент не может произвольно перевести партию в чужой `status`.
- Live path и rebuild дают одинаковый результат на одинаковой истории ходов.

---

### Этап 4: Logout, Registration Errors & Runtime Safety (~120-220 строк)
**Статус:** Не начат

**Цель:** закрыть auth/session gaps и сделать runtime устойчивым к route exceptions.

**Задачи:**
- [ ] Перевести logout на server-authoritative завершение сессии без ложного client-side восстановления.
- [ ] Очистить client-side auth state после logout без повторного auto-login из localStorage.
- [ ] Добавить duplicate `phone` check и корректный mapping DB unique violations в `400`.
- [ ] Убрать повторный `throw` из global error handler.

**Файлы:**
- `client/src/App.tsx`
- `client/src/pages/auth.tsx`
- `client/src/pages/chess-game.tsx`
- `server/routes.ts`
- `server/index.ts`
- `server/storage.ts`

**Критерии приёмки:**
- Logout завершает серверную сессию и не восстанавливается после reload.
- Duplicate phone возвращает читаемый `400`.
- Route exception не завершает Node process.

---

### Этап 5: Regression Tests & Coverage Expansion (~160-260 строк)
**Статус:** Не начат

**Цель:** закрепить hardening regression-тестами и smoke coverage.

**Задачи:**
- [ ] Написать API tests на ownership/auth checks игровых действий.
- [ ] Добавить tests на illegal move, wrong player, non-participant, logout и duplicate phone.
- [ ] Добавить tests на `void`, `double-knight`, `undo` и rebuild parity.
- [ ] Зафиксировать smoke scenarios для `standard`, `double-knight`, `fischer-random`, `void`.

**Файлы:**
- `package.json`
- `tests/`
- при необходимости helpers/fixtures для test setup

**Критерии приёмки:**
- `npm run check` проходит.
- `npm test` проходит.
- Есть regression tests минимум на ownership, illegal move, logout, duplicate phone и complex-rule parity.

---

## Acceptance Checklist

- Не-участник партии получает `401` или `403` на mutating game endpoints.
- Пользователь не может сделать ход за чужой цвет даже при ручной подмене request body.
- Нелегальный ход через API возвращает `400`.
- Сервер не доверяет клиентским derived move fields.
- `undo` не ломает ход партии и не рассинхронизирует rebuild.
- Logout завершает серверную и клиентскую сессию.
- Duplicate `username`, `email`, `phone` возвращают ожидаемые business errors.
- Route exception не роняет процесс.

---

## Test Scenarios

- Гость без сессии пытается сделать ход.
- Пользователь A пытается сделать ход, `undo` или draw action в чужой партии.
- Ладья пытается пройти через фигуру.
- Игрок пытается оставить короля под шахом.
- Проверка `double-knight` на live route и после `undo`.
- Logout с последующим reload страницы.
- Регистрация с duplicate `phone`.
- Smoke по `standard`, `double-knight`, `fischer-random`, `void`.

---

## Риски

- Логика правил сейчас частично размазана между client и server; при фиксе есть риск временных расхождений.
- `void` и `double-knight` имеют наибольшую вероятность регрессий, потому что влияют на turn model и rebuild.
- Переход на session-based ownership может затронуть старые партии и guest flow.

---

## Решения вне scope

- Полный продуктовый redesign auth/game UX.
- Добавление новых custom rules.
- Полная миграция legacy game records на новую ownership-модель.

---

## История изменений

| Дата | Этап | Коммит | Описание |
| --- | --- | --- | --- |
| 2026-03-30 | а | - | Подготовлено bugfix ТЗ для server-side security, move validation и session hardening на основе `fixed spec.md` |
| 2026-03-30 | 1 | - | Добавлены public request schemas, auth UI переведён на них, mutating routes используют session-based ownership, прямой `captured` mutation закрыт |
| 2026-03-30 | 2 | - | Move payload сокращён до входных параметров, сервер сам вычисляет `player`/`piece`/`captured`/`moveNumber`/`fen`, а terminal statuses фиксируются внутри move flow |
| 2026-03-30 | 3 | - | Добавлен explicit `resign` flow, legacy `status` route закрыт, а клиент больше не отправляет terminal state вручную |




