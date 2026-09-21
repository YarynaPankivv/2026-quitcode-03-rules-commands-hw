# CLAUDE.md

@AGENTS.md

## Специфічне для Claude Code

- Правила проєкту лежать у `.claude/rules/`. `do-not-touch.md` — без frontmatter,
  тому завантажується в кожній сесії; `architecture.md` і `conventions.md` мають
  `paths: app/src/**/*.ts` і підтягуються, коли в роботі є файли застосунку.
- Команди — у `.claude/commands/`, ціль передається через `$ARGUMENTS`.
- Перед комітом виконуй перевірки з `AGENTS.md` і не пропускай `check:rules`:
  саме його числа порівнюються до і після змін.
