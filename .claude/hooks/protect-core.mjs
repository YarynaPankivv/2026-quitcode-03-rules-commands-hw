#!/usr/bin/env node
// PreToolUse-хук: блокує запис у захищені шляхи з .claude/rules/do-not-touch.md.
// Правило просить — хук не дає: спрацьовує й тоді, коли агент правила не читав.
// Node, а не bash, щоб працювало і на Windows.

import { relative, resolve } from "node:path";

const PROTECTED_DIRS = ["app/src/core/", "app/scripts/", "materials/", ".github/"];
const PROTECTED_FILES = [".coderabbit.yaml"];

const raw = await new Promise((resolve) => {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => resolve(text));
});

// Не вдалося розібрати вхід — блокуємо: мовчазний пропуск зняв би захист
// непомітно, а гучна відмова видно одразу.
let input;
try {
  input = JSON.parse(raw);
} catch {
  block(
    "не вдалося розібрати вхідний JSON від PreToolUse, тому дію неможливо перевірити.\n" +
      "Скрипт: .claude/hooks/protect-core.mjs",
  );
}

/**
 * Шлях відносно кореня проєкту. Через path.relative, а не зіставлення рядків:
 * інакше повз захист проходять `./app/...`, `app/../app/...` і схожі записи.
 * Шлях поза коренем лишається з `../` і під захищені префікси не підпадає.
 */
function toProjectPath(filePath) {
  const root = input?.cwd ?? process.cwd();
  return relative(root, resolve(root, filePath)).replace(/\\/g, "/");
}

function block(reason) {
  process.stderr.write(`Заблоковано хуком: ${reason}\n`);
  process.exit(2);
}

function protectedZone(filePath) {
  const path = toProjectPath(filePath);
  return (
    PROTECTED_DIRS.find((dir) => path.startsWith(dir)) ??
    PROTECTED_FILES.find((file) => path === file)
  );
}

// Сегмент команди, який лише читає або відновлює з git, — решта вважається
// записом. Перелік дозволеного, а не забороненого: `printf x > file`,
// `sed -i`, `rm`, `tee`, `dd` і десяток інших способів записати файл
// перелічити наперед неможливо, а пропустити хоч один — зняти захист.
const READ_ONLY_SEGMENT =
  /^\s*(git\s+(status|diff|log|show|blame|ls-files|checkout\s+--|restore)|cat|head|tail|less|grep|rg|ls|wc|find|diff|node\s+--version)\b/;

function protectedZoneInCommand(command) {
  for (const segment of command.replace(/\\/g, "/").split(/&&|\|\||[;|\n]/)) {
    const zone =
      PROTECTED_DIRS.find((dir) => segment.includes(dir)) ??
      PROTECTED_FILES.find((file) => segment.includes(file));
    if (zone !== undefined && !READ_ONLY_SEGMENT.test(segment)) return zone;
  }
  return undefined;
}

if (input?.tool_name === "Bash") {
  const command = String(input?.tool_input?.command ?? "");

  if (command.includes("--write-lock")) {
    block(
      "перегенерація app/scripts/core.lock.json заборонена.\n" +
        "Червоний core-untouched означає, що змінене ядро — поверни його\n" +
        "(`git checkout -- app/src/core`), а не переписуй лок.",
    );
  }

  const zone = protectedZoneInCommand(command);
  if (zone !== undefined) {
    block(
      `команда звертається до захищеної зони «${zone}» не лише для читання.\n` +
        "Див. .claude/rules/do-not-touch.md — ці шляхи не редагуються, зокрема й через оболонку.\n" +
        "Читання (`cat`, `grep`, `git diff`) і відновлення (`git checkout -- <шлях>`) дозволені.",
    );
  }

  process.exit(0);
}

const filePath = input?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") process.exit(0);

const zone = protectedZone(filePath);
if (zone === undefined) process.exit(0);

block(
  `${toProjectPath(filePath)} лежить у захищеній зоні «${zone}».\n` +
    "Див. .claude/rules/do-not-touch.md — у звичайних задачах ці шляхи не редагуються.\n" +
    "Якщо задача без цієї зміни не виконується, зупинись і опиши: який експорт треба " +
    "змінити, навіщо, що вже перевірено з наявного публічного API ядра і що можна " +
    "зробити без нього.",
);
