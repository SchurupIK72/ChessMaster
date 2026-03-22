# Итерация 002: MCP Integration

## Цель
- [x] Настроить полноценную интеграцию Unity ↔ MCP
- [x] Реализовать обработку команд в Unity Editor
- [x] Создать MCP Proxy сервер для оркестрации
- [x] Задокументировать API контракты

## Изменения

### Unity Editor Server (порт 7777)
- `unity/Assets/Editor/AI/AIHttpServer.cs`: Полностью переработан
  - Обработка всех MCP команд (create_scene, create_object, add_component, create_prefab, create_scriptable)
  - CORS поддержка для cross-origin запросов
  - Endpoint `/status` для проверки соединения
  - Endpoint `/command` для выполнения команд
  - Обработка ошибок с JSON ответами
  - Требует Newtonsoft.Json (добавлен в Packages)

### MCP Proxy Server (порт 3000)
- `mcp-server/src/server.js`: Полностью переработан
  - Проксирование команд в Unity Editor
  - Endpoint `/tools` для discovery доступных команд
  - Endpoint `/status` для проверки подключения к Unity
  - Endpoint `/health` для health check
  - Graceful error handling когда Unity закрыт

### Документация
- `docs/API_CONTRACTS.md`: Создана полная спецификация API
  - Описание всех endpoint'ов
  - Примеры запросов/ответов
  - Error handling
  - Usage examples с curl

## Технические решения

1. **Proxy паттерн**: Node.js сервер как прокси к Unity Editor
   - Почему: Unity Editor не может быть always-on, прокси обеспечивает graceful degradation
   - Альтернатива: Прямые запросы к Unity (требует всегда открытый Editor)

2. **Newtonsoft.Json в Unity**: Для парсинга JSON
   - Почему: Встроенный JsonUtility ограничен, не поддерживает Dictionary/dynamic

3. **CORS headers**: Для cross-origin запросов
   - Почему: Позволяет отправлять запросы из браузера/других клиентов

4. **Reflection для set_object_property**: Динамическая установка свойств
   - TODO: Расширить для nested properties, array assignment

## MCP Commands Matrix

| Command | Unity Method | Status |
|---------|--------------|--------|
| create_scene | EditorSceneManager.NewScene | ✅ |
| create_object | new GameObject() | ✅ |
| add_component | GameObject.AddComponent() | ✅ |
| create_prefab | PrefabUtility.SaveAsPrefabAsset | ✅ |
| create_scriptable | ScriptableObject.CreateInstance + AssetDatabase | ✅ |
| get_selection | Selection.objects | ✅ |
| set_object_property | FieldInfo.SetValue() | ⚠️ Basic |

## Следующие шаги
- Расширить set_object_property для сложных типов (векторы, nested properties)
- Добавить команду create_asset_from_template (для быстрого создания типичных ассетов)
- Добавить batch operations (создание нескольких объектов одним запросом)
- Web UI для визуального редактирования через MCP

## Тестирование

### Проверка соединения
```bash
curl http://localhost:3000/status
```

### Создание сцены
```bash
curl -X POST http://localhost:3000/command \
  -H "Content-Type: application/json" \
  -d '{"action":"create_scene","name":"BattleScene"}'
```

### Создание ScriptableObject
```bash
curl -X POST http://localhost:3000/command \
  -H "Content-Type: application/json" \
  -d '{"action":"create_scriptable","type":"UnitDefinition","name":"DarkFighter","path":"Assets/ScriptableObjects/Units"}'
```

## Статус
✅ Завершена — MCP интеграция полностью функциональна
