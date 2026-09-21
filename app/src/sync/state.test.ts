import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "./state.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadState", () => {
  it("повертає початковий стан, якщо файлу ще немає", () => {
    expect(loadState(join(dir, "missing.json"))).toEqual({
      ok: true,
      value: { lastSyncedAt: "1970-01-01T00:00:00.000Z" },
    });
  });

  it("читає збережений стан", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));

    expect(loadState(path)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T10:30:00.000Z" } });
  });

  it("не підставляє початковий стан для пошкодженого файлу", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, '{"lastSyncedAt":'); // так виглядає файл після падіння по ENOSPC

    const result = loadState(path);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("invalid JSON");
  });

  it("не приймає стан несподіваної форми", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, JSON.stringify({ lastSyncedAt: 1757500000000 }));

    const result = loadState(path);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("unexpected shape");
  });

  // Рядок проходив би перевірку типу, але лексикографічне порівняння з createdAt
  // дало б тихо неправильний набір лідів.
  it.each(["not-a-date", "2026-09-10T08:00:00Z", "2026-09-10 08:00:00.000Z", ""])(
    "не приймає lastSyncedAt %j",
    (lastSyncedAt) => {
      const path = join(dir, "sync-state.json");
      writeFileSync(path, JSON.stringify({ lastSyncedAt }));

      const result = loadState(path);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("unexpected shape");
    },
  );
});

describe("saveState", () => {
  it("зберігає стан і не лишає тимчасового файлу", () => {
    const path = join(dir, "sync-state.json");

    const result = saveState(path, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(loadState(path)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-10T08:00:00.000Z" } });
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it("повертає помилку замість винятку, якщо записати не вдалося", () => {
    const path = join(dir, "немає-такої-теки", "sync-state.json");

    const result = saveState(path, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("sync state");
  });
});
