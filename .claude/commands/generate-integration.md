---
description: Нова інтеграція за архітектурою проєкту: модуль, тест поруч, рядок у реєстрі
argument-hint: <назва сервісу, напр. telegram-notify або HubSpot>
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/integrations/slack-notify.ts` і `slack-notify.test.ts` —
   це еталон інтеграції, що відповідає конвенціям. Повтори її форму, а не форму
   спадкового `sheets-append.ts`.
2. Визнач `<kebab-name>` з назви сервісу (напр. «HubSpot» → `hubspot-contact`)
   і перевір, що файлу з таким іменем ще немає.
3. Створи `app/src/integrations/<kebab-name>.ts` за контрактом `Integration` з
   `app/src/core/types.ts`: поле `name` дослівно дорівнює імені файлу,
   `requiredEnv` — лише **імена** змінних, `send(lead)` повертає `Result<void>`.
   Секрети бери через `readEnv()`, запит роби через `postJson()`, журнал — через
   `log`. Деталі — `.claude/rules/conventions.md`.
4. Якщо сервіс — канал сповіщень (месенджер, чат), у тіло запиту не потрапляють
   `lead.email` і `lead.phone`. Якщо це система обліку (CRM, таблиця) — повні
   дані допустимі. Обери свідомо й скажи в підсумку, що саме обрав і чому.
5. Створи `app/src/integrations/<kebab-name>.test.ts` поруч. Мінімум три випадки:
   успішна відправка зі звіркою URL і тіла запиту, відсутня змінна середовища,
   помилка від зовнішньої системи. Мережі в тестах немає:
   `vi.stubGlobal("fetch", ...)`, змінні — `vi.stubEnv`.
6. Додай **один рядок** імпорту й один елемент у масив `integrations` у
   `app/src/integrations/index.ts`. Більше в реєстрі нічого не міняй.
7. Прогони перевірки:
   ```bash
   cd app && npm test && npm run typecheck && npm run check:rules
   ```

## Acceptance criteria

- [ ] Створено рівно два файли: `<kebab-name>.ts` і `<kebab-name>.test.ts` у `app/src/integrations/`
- [ ] Поле `name` збігається з іменем файлу; модуль реалізує `Integration` без `any`
- [ ] У `index.ts` додано рівно один імпорт і один елемент масиву
- [ ] `npm test` зелений і кількість тестів зросла щонайменше на 3
- [ ] `npm run typecheck` без помилок
- [ ] `check:rules` — `TOTAL` не зріс проти значення до запуску, `core-untouched` = `0`
- [ ] `app/package.json` не змінено — нових залежностей немає

## Stop

`app/src/core/**` не чіпай: потрібної функції немає в ядрі → дій за
`.claude/rules/do-not-touch.md`. `npm install <пакет>` не запускай. Наприкінці
покажи підсумок: створені файли, рядок у реєстрі, числа `npm test` і `check:rules`
до і після, і яке рішення ухвалив щодо email/телефону.
