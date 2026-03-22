# Итерация 001: Project Setup

## Цель
- [x] Создать базовую структуру Unity проекта
- [x] Настроить MCP сервер для интеграции с LLM
- [x] Реализовать базовые классы: GameManager, GridManager, UnitController
- [x] Создать Editor tools для AI-команд

## Изменения

### Unity Scripts
- `unity/Assets/Scripts/Core/GameManager.cs`: Создан базовый singleton для управления игрой
- `unity/Assets/Scripts/Grid/GridManager.cs`: Добавлена конфигурация сетки (8x8 по умолчанию)
- `unity/Assets/Scripts/Units/UnitController.cs`: Реализована базовая логика юнита (HP, Attack, TakeDamage)

### Data Layer (ScriptableObjects)
- `unity/Assets/Scripts/Data/UnitDefinition.cs`: Класс для данных юнита (HP, Attack, synergies, abilities)
- `unity/Assets/Scripts/Data/AbilityDefinition.cs`: Класс для данных способностей (Active/Passive/Trigger)
- `unity/Assets/Scripts/Data/SynergyDefinition.cs`: Класс для синергий (thresholds, bonuses)

### Unity Editor Tools
- `unity/Assets/Editor/AI/AICommandRouter.cs`: Создан роутер для AI-команд создания сцен и объектов
  - Методы: CreateScene, CreateObject, AddComponent, CreatePrefab, **CreateScriptableObject**
  - CreateScriptableObject умеет создавать ассеты через reflection по имени типа
- `unity/Assets/Editor/AI/AIHttpServer.cs`: Запущен HTTP сервер на localhost:7777 для приёма команд от LLM

### MCP Server
- `mcp-server/package.json`: Инициализирован Node.js проект
- `mcp-server/src/server.js`: Создан Express сервер на порту 3000 с endpoint POST /command

### Документация
- `.ai/ARCHITECTURE.md`: Создан первоначальный набросок архитектуры
- `CLAUDE.md`: Создано руководство для AI-разработчика

### Skills
- `.claude/skills/unity-scenebuilder/SKILL.md`: Создан skill для программного построения Unity сцен через MCP
  - Документация MCP команд (create_scene, create_object, add_component, create_prefab, create_scriptable)
  - Шаблоны для Battle Scene, Unit Prefab, ScriptableObject
  - Python клиент для отправки команд (scripts/mcp-client.py)
- `.claude/skills/unity-scriptable-builder/SKILL.md`: Создан skill для работы с ScriptableObject данными
  - Полная документация по UnitDefinition, AbilityDefinition, SynergyDefinition
  - Lineage2 themed пресеты юнитов (Dark Fighter, Hawkeye, Bishop, Assassin, Destroyer)
  - Lineage2 способности (Power Strike, Double Shot, Heal, Backstab)
  - Синергии (Warrior, Archer, Human, DarkElf)
  - Python клиент с пресетами (scripts/create_unit.py)

## Технические решения

1. **Singleton для GameManager**: Классический паттерн для единственного менеджера игры
2. **MCP Dual-server**: Два сервера (Unity Editor 7777 + Node.js 3000) для разделения ответственности
3. **HTTP вместо WebSockets**: Использован прост REST для initial prototype
4. **Editor folder для AI tools**: Инструменты AI изолированы в Editor, не попадают в билд

## Следующие шаги
- Создать BattleManager с логикой автобатлера
- Построить базовую сцену через MCP tools
- Добавить визуализацию сетки
- Наполнить данными (создать .asset файлы через Unity Editor)

## Статус
✅ Завершена - базовая инфраструктура готова
