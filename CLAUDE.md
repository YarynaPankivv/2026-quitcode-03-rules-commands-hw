# CLAUDE.md

@AGENTS.md

## Специфічне для Claude Code

- Правила проєкту лежать у `.claude/rules/`. `do-not-touch.md` — без frontmatter,
  тому завантажується в кожній сесії; `architecture.md` (`app/src/**/*.ts`) і
  `conventions.md` (`app/src/**/*.ts` плюс `app/package.json`) підтягуються, коли
  в роботі є відповідні файли.
- Команди — у `.claude/commands/`, ціль передається через `$ARGUMENTS`.
- Хук `PreToolUse` у `.claude/settings.json` блокує запис у захищені шляхи
  незалежно від правил — див. `.claude/hooks/protect-core.mjs`.
- Перед комітом виконуй перевірки з `AGENTS.md` і не пропускай `check:rules`:
  саме його числа порівнюються до і після змін.
