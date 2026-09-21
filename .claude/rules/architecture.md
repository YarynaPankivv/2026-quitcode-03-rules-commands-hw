---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` — воркер, перенесений з n8n: кожні 5 хвилин бере нові заявки й розсилає
їх у зовнішні системи. Шари й публічний API ядра зафіксовані в
`materials/architecture-brief.md`; код, що відхиляється від них, ламає інші
клієнтські воркери агенції, які працюють на тому самому ядрі.

## Правило

### Шари й напрям залежностей

```
app/src/
  core/          платформа: types, http, config, parse, log
  integrations/  по одному модулю на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
```

- `integrations/` і `sync/` імпортують з `core/`. У `core/` не додавай імпортів
  із `integrations/` чи `sync/` — ядро не знає про решту проєкту.
- `integrations/` не імпортують `sync/` і не імпортують одна одну. Потрібне
  спільне — це не сусідня інтеграція, а звернення до `core/`.
- `sync/` не імпортує конкретні інтеграції поіменно: працює лише через тип
  `Integration` з `core/types.ts` і реєстр `integrations/index.ts`.

### Нова інтеграція — рівно три кроки

1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`
   з полями `name` (збігається з іменем файлу), `requiredEnv`, `send(lead)`.
2. `app/src/integrations/<kebab-name>.test.ts` — тест поруч із модулем.
3. Один рядок у `app/src/integrations/index.ts`: імпорт і елемент масиву
   `integrations`.

Більше нічого. Не заводь нових тек, не створюй «фабрик», «базових класів» чи
шару-обгортки над інтеграціями — реєстр уже є.

### Публічний API ядра — рівно цей

| Модуль | Експорт |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` → `Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

Іншого в ядрі немає. Не імпортуй з `core/` імена, яких немає в таблиці
(`getJson`, `httpClient`, `logger`, `Config`, `validate` тощо) і не вигадуй
сигнатур: перед використанням звірся з цією таблицею. Якщо потрібної функції в
ядрі немає — не додавай її туди (див. правило `do-not-touch`), а розв'яжи задачу
наявним API у своєму модулі.

## Як перевірити

- `cd app && npm run typecheck` → без помилок: вигаданого експорту з `core/`
  не існує, і компілятор це покаже.
- `cd app && npm test` → 34+ тестів зелені; у нової інтеграції є власний
  `*.test.ts` поруч із модулем.
- `grep -rnE 'from "\.\./(integrations|sync)/' app/src/core/` → порожньо (ядро ні
  на кого не посилається).
- Нова інтеграція видно в `app/src/integrations/index.ts` одним рядком, а поле
  `name` в модулі дослівно збігається з іменем файлу.
