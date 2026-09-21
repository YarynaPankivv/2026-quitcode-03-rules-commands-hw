# AGENTS.md

`lead-sync` — воркер на TypeScript (Node 22+), перенесений з n8n-воркфлоу для
клієнта Studio Nova. Кожні 5 хвилин бере нові заявки з форми сайту й розсилає їх
у зовнішні системи: Slack-канал менеджерів, Google-таблицю, далі CRM і месенджери.
Нуль runtime-залежностей, тести на Vitest. Джерело істини про архітектуру —
`materials/architecture-brief.md`.

## Команди

Усі — з теки `app/`:

| Команда | Для чого |
|---|---|
| `npm install` | встановлення (лише devDependencies) |
| `npm test` | Vitest, разовий прогін |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій проєкту |

Поточний стан: **34 тести зелені**, `check:rules` → **`TOTAL: 0 violation(s)`**.
Будь-яке ненульове число — регресія від твоїх змін, а не спадщина.

## Карта проєкту

```
app/src/
  core/          платформа: types, http, config, parse, log — ЗАХИЩЕНО, не редагувати
  integrations/  по модулю на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
```

`integrations/` і `sync/` імпортують з `core/`; `core/` не знає про решту проєкту.
Нова інтеграція — це файл `integrations/<kebab-name>.ts`, тест поруч і один рядок
у `integrations/index.ts`.

## Ключові правила

- Захищені шляхи: `app/src/core/**`, `app/scripts/**`, `materials/**`,
  `.coderabbit.yaml`, `.github/**` — не редагувати. Задача впирається в ядро →
  зупинитись і описати потрібну зміну. Деталі: `.claude/rules/do-not-touch.md`.
- Помилки — значення: `Result<T>` з `core/types.ts`, а не винятки назовні модуля.
- Виклики назовні — лише через ядро: `postJson()`, `readEnv()`,
  `parseJson(text, guard)`, `log`. Прямих `fetch`, `process.env`, `JSON.parse`,
  `console.*` поза `core/` немає.
- Без `any`, без нових залежностей, без секретів у журналі й у коді.
- Мінімізація даних: канали сповіщень отримують ім'я, джерело й бюджет; повні дані
  йдуть лише в системи обліку.

Повні формулювання з перевірками — у `.claude/rules/`:
[`architecture.md`](.claude/rules/architecture.md) (шари, публічний API ядра),
[`conventions.md`](.claude/rules/conventions.md) (код і тести),
[`do-not-touch.md`](.claude/rules/do-not-touch.md) (захищені шляхи).
Тут — короткий перелік, не копія.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Тести зелені; `check:rules` не зріс проти базової лінії, а рядок `core-untouched`
дорівнює `0`. `git status --short` не містить шляхів із захищеного переліку.
