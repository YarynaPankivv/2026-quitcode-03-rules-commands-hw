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

Базова лінія на чистому репо: **18 тестів зелені**, `check:rules` →
`TOTAL: 8 violation(s)` (спадковий код у `sheets-append.ts` і `sync/state.ts`).

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
- Вихідний HTTP — лише `postJson()` з `core/http.ts`; прямого `fetch` немає.
- Змінні середовища — лише `readEnv()` з `core/config.ts`; `process.env` поза ядром
  не читаємо, секрети не логуємо.
- Зовнішній JSON — лише `parseJson(text, guard)` з `core/parse.ts`; журнал — лише
  `log` з `core/log.ts`; без `any`; без нових залежностей.
- У сповіщення (Slack, месенджери) не передаємо email і телефон ліда — лише ім'я,
  джерело й бюджет.

Повні формулювання з перевірками — у `.claude/rules/`:
[`architecture.md`](.claude/rules/architecture.md) (шари, публічний API ядра),
[`conventions.md`](.claude/rules/conventions.md) (конвенції коду й тестів),
[`do-not-touch.md`](.claude/rules/do-not-touch.md) (захищені шляхи).
Тут — короткий перелік, не їх копія.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Тести зелені; `check:rules` не зріс проти базової лінії, а рядок `core-untouched`
дорівнює `0`. `git status --short` не містить шляхів із захищеного переліку.
