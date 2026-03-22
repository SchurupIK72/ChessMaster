---
name: spec-creation
description: >
  Шаг ① workflow: Создание ТЗ + ветка + коммит.
  Triggers: "создай ТЗ", "new feature", "новая фича", "bugfix".
  Использует IEEE 29148:2018 для валидации требований (≥85%).
  После валидации создаёт ветку feature/* или bugfix/* и коммитит spec.
type: workflow
step: 1
---

# Spec Creation Skill

**Шаг ① workflow** — создание ТЗ с валидацией по IEEE 29148:2018, ветки и коммита.

## Workflow Contract

```yaml
entry:
  branch: main | master
  trigger:
    - "создай ТЗ"
    - "new feature"
    - "новая фича"
    - "bugfix"
    - "исправь баг"

exit:
  artifacts:
    - .ai/specs/{branch-type}-{slug}.md
  branch: feature/* | bugfix/*
  commit: "docs: add spec for {feature-name}"

recommended_next_skill: spec-implementer  # Рекомендуемый следующий skill для Codex
```

## When to Use This Skill

- User requests creating a technical specification (ТЗ, техническое задание)
- User says "создай ТЗ", "напиши спецификацию", "создай spec"
- User reports a bug → создать bugfix spec с красным тестом
- Starting workflow step ① (per project workflow guide)

## Output Location

Specifications are created in `.ai/specs/` directory with naming pattern:
- `feature-{slug}.md` for new features
- `bugfix-{slug}.md` for bug fixes

A git branch will be created with pattern:
- `feature/{slug}` for new features
- `bugfix/{slug}` for bug fixes

The spec file will be committed to the new branch.

## Core Principles

### Iterative Requirement Refinement

This skill uses **multi-round validation** with IEEE 29148:2018 quality criteria:

**Critical:** A specification is NOT complete until validation achieves ≥85% score.

### Progressive Disclosure

- Keep spec template concise in SKILL.md
- Reference detailed templates in `references/` directory
- Load templates only when needed

## IEEE 29148:2018 Quality Assessment Framework

The requirements quality score is calculated from 5 sections, each containing specific criteria with maximum weight of 5 per criterion.

### Section 1: Core Quality Attributes (40 points total)

| Criterion       | Weight | Check                                                                 |
| --------------- | ------ | --------------------------------------------------------------------- |
| **Necessary**   | 5      | Does the requirement define an essential capability/characteristic?   |
| **Unambiguous** | 5      | Is there only one possible interpretation?                            |
| **Complete**    | 5      | Are all necessary capabilities/characteristics/constraints described? |
| **Consistent**  | 5      | Is it free of conflicts with other requirements?                      |
| **Singular**    | 5      | Does it address only one concern (not compound)?                      |
| **Feasible**    | 5      | Is it achievable with given constraints (time, budget, technology)?   |
| **Traceable**   | 5      | Can it be linked to stakeholder needs and business objectives?        |
| **Verifiable**  | 5      | Can fulfillment be measured through testing/inspection?               |

### Section 2: Context & Rationale (20 points total)

| Criterion               | Weight | Check                                                   |
| ----------------------- | ------ | ------------------------------------------------------- |
| **Implementation-free** | 5      | Does it avoid dictating HOW to implement (WHAT vs HOW)? |
| **Affordable**          | 5      | Is it within budget/resource constraints?               |
| **Bounded**             | 5      | Are scope boundaries clearly defined?                   |
| **Rationale stated**    | 5      | Is the reason for this requirement explained?           |

### Section 3: Completeness of Description (20 points total)

| Criterion                  | Weight | Check                                                                             |
| -------------------------- | ------ | --------------------------------------------------------------------------------- |
| **Inputs defined**         | 5      | Are all inputs clearly specified (data, parameters, user actions)?                |
| **Outputs defined**        | 5      | Are expected outputs clearly described (return values, UI changes, side effects)? |
| **Constraints identified** | 5      | Are technical/business/environmental constraints noted?                           |
| **Edge cases covered**     | 5      | Are error scenarios and boundary conditions addressed?                            |

### Section 4: Traceability & Stakeholders (10 points total)

| Criterion               | Weight | Check                                                         |
| ----------------------- | ------ | ------------------------------------------------------------- |
| **Stakeholder mapping** | 5      | Can the requirement be linked to specific stakeholders/users? |
| **Business value**      | 5      | Does it align with stated business objectives or user needs?  |

### Section 5: Acceptance & Prioritization (10 points total)

| Criterion                | Weight | Check                                                    |
| ------------------------ | ------ | -------------------------------------------------------- |
| **Prioritization clear** | 5      | Is priority level specified (must-have vs nice-to-have)? |
| **Success criteria**     | 5      | Are measurable acceptance criteria defined?              |

**Maximum Score: 100 points**
**Threshold: 85 points minimum to proceed**

## Iterative Validation Process

### Round Structure

For each validation round:

1. **Display Current Requirements Version** - Show the accumulated requirements in markdown format
2. **Calculate IEEE 29148 Score** - Evaluate each criterion and calculate total
3. **Decision Point**:
   - If score ≥ 85: Proceed to next phase
   - If score < 85: ask the user a concise clarification question
4. **Enrich & Re-evaluate** - Update requirements with answers and re-score

### Round 1: Core Requirements Validation

**Initial Requirements Gathering:**

```
## Initial Requirements

### Feature Overview
- **Feature name**: {from user}
- **Type**: {new feature/bug fix/enhancement}
- **Vision**: {one sentence}

### Core Requirements
- {Must-have requirements from user}

### Stakeholders
- {Target users, roles}

### Constraints
- {Technical/business constraints}
```

**Evaluate using Section 1 (Core Quality Attributes) + Section 2 (Context & Rationale)**

**Common Gaps to Address via direct user questions:**
- Unambiguous: "Which specific notification channels?" (email, in-app, SMS?)
- Complete: "What data needs to be stored for each notification?"
- Feasible: "Are there rate limits or API constraints?"
- Implementation-free: "What business outcome, not which library?"

### Round 2: Technical Completeness Validation

**Extended Requirements:**

```
## Technical Requirements

### Functional Requirements
- {Specific functional behaviors}

### Non-Functional Requirements
- {Performance, security, usability}

### API & Database Changes
- {Endpoints, schemas, migrations}

### Frontend Changes
- {Pages, components, templates}
```

**Evaluate using Section 3 (Completeness of Description)**

**Common Gaps to Address:**
- Inputs defined: "What parameters does the API accept?"
- Outputs defined: "What response format/status codes?"
- Constraints identified: "Are there authentication requirements?"
- Edge cases covered: "What happens if the external service is down?"

### Round 3: Traceability & Acceptance Validation

**Final Requirements:**

```
## Implementation Plan

### Stages
- {Logical breakdown with dependencies}

### Acceptance Criteria per Stage
- {Measurable, testable criteria}

### File Changes
- {Concrete paths: src/...}

### Documentation Updates
- {ARCHITECTURE.md, API docs, etc.}
```

**Evaluate using Section 4 (Traceability) + Section 5 (Acceptance)**

**Common Gaps to Address:**
- Stakeholder mapping: "Which user role triggers this workflow?"
- Business value: "What problem does this solve for the user?"
- Success criteria: "How do we verify this works?" (not "it works")
- Prioritization: "Is this must-have for MVP or can it wait?"

## Output Format

After all validation rounds pass, generate the specification file **AND create branch with commit**:

### Step 1: Confirm Branch Creation with User

Ask the user directly for confirmation:

```
ТЗ готово (оценка IEEE 29148: ≥85%). Создать ветку и закоммитить ТЗ?
- Да, создать ветку и закоммитить
- Только создать файл спецификации (без ветки и коммита)
```

### Step 2: Determine Branch Type

If user confirms "Да", determine branch type:
- **Feature**: for new functionality, enhancement (`feature/{slug}`)
- **Bugfix**: for fixing bugs (`bugfix/{slug}` or `bugfix/{issue-id}-{slug}`)
- **Refactor**: for code restructuring without behavior change (`feature/refactor-{area}`)
- **Hotfix**: for urgent production fixes (`hotfix/{description}`)

Infer from spec type or ask the user directly if unclear:
```
Какой тип ветки создать?
- feature (новая функциональность)
- bugfix (исправление бага)
- refactor (рефакторинг)
- hotfix (срочный фикс для production)
```

### Step 3: Check Current Branch

```bash
git branch --show-current
git status
```

**Protection Policy:** If on `main` or `master`, warn user:
```
⚠️ Вы находитесь на ветке main/master. Прямые изменения не рекомендуются.
Создать feature branch?
```

Ensure no uncommitted changes remain before creating new branch.

### Step 4: Create Branch

```bash
git checkout -b {branch-type}/{slug}
```

Examples:
- `feature/thermocalc-response-differentiation`
- `bugfix/login-validation-error`
- `bugfix/142-auth-token-expiry`
- `feature/refactor-user-service`
- `hotfix/payment-gateway-timeout`

Branch naming conventions:
- Use lowercase letters
- Separate words with hyphens
- Keep descriptions short but descriptive
- For bugfixes, include issue ID if available
- For hotfixes, use prefix `hotfix/` for urgent production fixes

### Step 5: Verify Branch Creation

```bash
git status
```

Ensure:
- New branch is created
- It's based on the correct starting point (typically main)
- No uncommitted changes remain on main branch

### Step 6: Write Spec File and Commit

```bash
# Write spec to .ai/specs/{filename}.md
git add .ai/specs/{filename}.md
git commit -m "docs: add spec for {feature-name}

"
```

### Step 7: Update Status Table

After successful branch creation and commit, update the spec file's workflow status table.

| Шаг | Действие            | Навык                                  | Статус     |
| --- | ------------------- | -------------------------------------- | ---------- |
| а   | Создание ТЗ + Ветка | —                                      | ✅ Завершён |
| б   | Реализация          | `spec-implementer`                     | ❌ Не начат |
| в   | Написание тестов    | `test-writer`                          | ❌ Не начат |
| г   | GUI тестирование    | `gui-testing`                          | ❌ Не начат |
| д   | Мерж                | `merge-helper`                         | ❌ Не начат |

### Generated Spec Format

```markdown
# {Feature Name} - Feature Specification

> **Дата создания:** {YYYY-MM-DD}
> **Ветка:** `{branch-type}/{slug}`
> **Статус:** 🟡 В работе
> **Коммит:** {commit-hash}

---

## Workflow выполнения

Данное ТЗ должно выполняться согласно генеральному workflow из [Project Workflow Guide](../../CLAUDE.md).

### Определение типа workflow

Перед началом работы уточнить у пользователя:

1. **Это новая фича?** → Использовать "Новая фича workflow"
2. **Это исправление бага?** → Использовать "Исправление бага workflow"

При неоднозначности запроса задать пользователю короткий прямой вопрос:
```
Какой тип задачи выполняется?
- Новая фича (создание нового функционала)
- Исправление бага (фикс существующего поведения)
```

### Порядок выполнения для новой фичи

| Шаг | Действие            | Навык                                  | Статус     |
| --- | ------------------- | -------------------------------------- | ---------- |
| а   | Создание ТЗ + Ветка | —                                      | ✅ Завершён |
| б   | Реализация          | `spec-implementer`                     | ❌ Не начат |
| в   | Написание тестов    | `test-writer`                          | ❌ Не начат |
| г   | GUI тестирование    | `gui-testing`                          | ❌ Не начат |
| д   | Мерж                | `merge-helper`                         | ❌ Не начат |

### Текущий статус и следующий шаг

**Текущий шаг:** а (Создание ТЗ + Ветка) — ✅ Завершён
- Ветка: `{branch-type}/{slug}`
- Коммит: `{commit-hash}`

**Следующий шаг:** б (Реализация)
- Выполнить через skill `spec-implementer`: следующим сообщением, например, "реализуй ТЗ"

> **Важно:** При наличии неоднозначности на любом шаге workflow запросить уточнение у пользователя обычным коротким вопросом.

---

## Видение

{Vision statement}

**Ключевые требования:**
- {Bullet list of must-haves}

---

## План реализации

### Этап 1: {Stage Name} (~{lines} строк)
**Статус:** ⬜ Не начат

**Цель:** {Purpose}

**Задачи:**
- [ ] {Task 1}
- [ ] {Task 2}

**Файлы:**
- `path/to/file.py` (create/modify)

**Критерий приёмки:**
- {Testable criterion}

**Тестирование:**
- {Test scenarios for Playwright automation}
- UI interactions: {specific user flows to test}
- API verification: {endpoints to validate}
- Edge cases: {boundary conditions, error scenarios}

---

## История изменений

| Дата   | Этап | Коммит | Описание   |
| ------ | ---- | ------ | ---------- |
| {date} | -    | -      | ТЗ создано |
```

## Validation Examples

### Example 1: Ambiguous Requirement

**Initial:** "System should be fast"

**IEEE 29148 Evaluation:**
- Unambiguous: 0/5 (what is "fast"?)
- Verifiable: 0/5 (how to measure?)
- **Score: 2/100**

**Direct user question:**
```
What performance target do you need?
- Response time < 200ms
- Throughput > 100 req/sec
- Page load < 3s
```

**Refined:** "API endpoint must respond within 200ms for 95th percentile"

**IEEE 29148 Evaluation:**
- Unambiguous: 5/5 (clear metric)
- Verifiable: 5/5 (can measure)
- **Score: 90/100**

### Example 2: Incomplete Requirement

**Initial:** "Users receive notifications"

**IEEE 29148 Evaluation:**
- Complete: 1/5 (missing what, when, how)
- Inputs defined: 0/5
- **Score: 15/100**

**After clarification rounds:**
"Logged-in users receive in-app notifications when wallet balance changes, with notification storing: user_id, message, timestamp, is_read flag"

**IEEE 29148 Evaluation:**
- Complete: 5/5
- Inputs defined: 5/5
- Outputs defined: 5/5
- Verifiable: 5/5
- **Score: 88/100**

## Required Templates by Round

### Round 1 Questions (Core Requirements)
1. What specific problem does this solve for the user?
2. Who are the target users/stakeholders? (roles, permissions)
3. What are the essential capabilities (must-haves)?
4. What defines "done" for this feature?
5. Are there technical/business constraints?

### Round 2 Questions (Technical Details)
1. Which modules/services are affected?
2. What database changes are needed (tables, migrations)?
3. What API endpoints (new or modified)?
4. What frontend pages/components change?
5. What external dependencies or integrations?

### Round 3 Questions (Implementation)
1. Can this be broken into 3-9 logical stages?
2. What are the dependencies between stages?
3. What are measurable acceptance criteria for each stage?
4. Which files will be modified (concrete paths)?
5. What test scenarios need to be verified (UI interactions, API responses, edge cases)?

## Reference Templates

- [spec_template.md](references/spec_template.md) - Full spec template with placeholders
- [stage_templates.md](references/stage_templates.md) - Common stage patterns (DB, API, Frontend)
- [question_templates.md](references/question_templates.md) - Question templates by feature type

## Common Pitfalls

1. **Accepting vague requirements**: "Make it faster" → "What latency target?"
2. **Compound requirements**: "User logs in and sees dashboard" → Split into two
3. **Implementation details in requirements**: "Use Redis" → "Cache with <100ms latency"
4. **Skipping rounds**: Must complete ALL 3 validation rounds with ≥85%
5. **Generic acceptance criteria**: "It works" → "API returns 200 with valid JSON schema"

## Example Workflow

```
User: "Создай ТЗ для новой фичи уведомлений"

Codex: [Displays Initial Requirements]
## Initial Requirements
- Feature: Notifications
- Type: New feature
- Vision: Users receive notifications for events
- Must-have: Notifications for events

Codex: [Evaluates - Score: 18/100]
❌ Unambiguous: 0/5 (what events? what channels?)
❌ Complete: 1/5 (missing what, when, how)
❌ Verifiable: 0/5 (no acceptance criteria)

Codex: [Asks direct clarification questions]
1. What types of events trigger notifications? → "Wallet changes, meeting reminders"
2. Which notification channels? → "Email + in-app"
3. Who receives notifications? → "Logged-in users, based on their preferences"

Codex: [Re-displays Requirements v2]
## Requirements v2
- Event types: wallet_balance_change, meeting_reminder
- Channels: email, in-app
- Recipients: users based on preferences

Codex: [Re-evaluates - Score: 42/100]
✅ Stakeholder mapping: 5/5
✅ Necessary: 5/5
❌ Inputs defined: 2/5 (what data in notification?)
❌ Outputs defined: 2/5 (what does user see?)
❌ Edge cases: 0/5

Codex: [Asks clarification questions - Round 2]
1. What data for each notification type?
2. What if email service is down?
3. How are notifications stored/displayed?

[... continues until score ≥85 ...]

Codex: [Final Score: 87/100] ✅

Codex: [Asks for branch-creation confirmation]
ТЗ готово (оценка IEEE 29148: 87%). Создать ветку и закоммитить ТЗ?
User: "Да, создать ветку и закоммитить"

Codex: [Checks current branch]
git branch --show-current → main
⚠️ Вы находитесь на ветке main. Прямые изменения не рекомендуются.

Codex: [Creates new branch]
git checkout -b feature/notifications
Switched to new branch 'feature/notifications'

Codex: [Verifies branch]
git status
On branch feature/notifications
nothing to commit, clean working tree

Codex: [Writes spec file and commits]
# Writes .ai/specs/feature-notifications.md
git add .ai/specs/feature-notifications.md
git commit -m "docs: add spec for notifications

"
[feature/notifications abc1234] docs: add spec for notifications
 1 file changed, 85 insertions(+)

Codex: [Updates workflow status in spec file]
Step а marked as ✅ Завершён

Branch Created Successfully

Type: Feature
Name: feature/notifications
Based on: main (commit 9e9387b)
Spec File: .ai/specs/feature-notifications.md
Commit: abc1234

✅ Шаг "а" завершён: ТЗ создано, ветка создана, файл закоммичен

Следующий шаг: б (Реализация)
Выполнить: /spec-implementer
```

## Final Validation Checklist

Before completing spec creation and branch creation, verify:

### Spec Validation
1. ✅ All 3 validation rounds passed with ≥85% score
2. ✅ File follows project spec format
3. ✅ Each stage has concrete file paths and acceptance criteria
4. ✅ Russian language used for vision/tasks/criteria
5. ✅ Technical terms in English (API, database, etc.)
6. ✅ Requirements are implementation-free (WHAT, not HOW)

### Branch and Commit
7. ✅ User confirmed branch creation via direct question
8. ✅ Branch type determined (feature/bugfix/refactor/hotfix)
9. ✅ Current branch checked (warn if on main/master)
10. ✅ New branch created with correct pattern
11. ✅ Spec file written to `.ai/specs/`
12. ✅ Spec file committed with proper message
13. ✅ Workflow status table updated in spec file (step "а" = ✅)

### Final Output
After successful completion, display:
```
✅ Шаг "а" завершён: ТЗ создано, ветка создана, файл закоммичен

Файл: .ai/specs/{filename}.md
Ветка: {branch-type}/{slug}
Коммит: {commit-hash}

Следующий шаг: б (Реализация)
Выполнить: следующим сообщением попросить `spec-implementer` продолжить работу
```

**Merge Strategy Information:**
- Commits will be squashed or rebased when merging to main
- This ensures clean history on main branch
- Commit in small chunks (≤250 lines) during implementation
- Update CHANGELOG.md before each implementation commit

### Branch Creation Success Output

```
Branch Created Successfully

Type: {Feature|Bugfix|Refactor|Hotfix}
Name: {branch-type}/{slug}
Based on: main (commit {hash})
Spec File: .ai/specs/{filename}.md
Commit: {commit-hash}

Next steps:
1. Implementation: следующим сообщением вызвать `spec-implementer`
2. Commit in small chunks (<=250 lines)
3. Write tests: следующим сообщением вызвать `test-writer`
4. Testing: следующим сообщением вызвать `gui-testing`
5. Merge: следующим сообщением вызвать `merge-helper`, когда все этапы завершены
```
