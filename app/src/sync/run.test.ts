import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Integration, Lead } from "../core/types.js";
import { runSync } from "./run.js";
import { loadState } from "./state.js";

const makeLead = (id: string, createdAt: string): Lead => ({
  id,
  name: `Lead ${id}`,
  email: `${id}@studio-nova.example.test`,
  source: "website",
  createdAt,
});

const leads = [
  makeLead("ld_0001", "2026-09-09T10:00:00.000Z"),
  makeLead("ld_0002", "2026-09-09T11:00:00.000Z"),
  makeLead("ld_0003", "2026-09-10T08:00:00.000Z"),
];

function recordingIntegration(sent: string[]): Integration {
  return {
    name: "recording",
    requiredEnv: [],
    send: async (lead) => {
      sent.push(lead.id);
      return { ok: true, value: undefined };
    },
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runSync", () => {
  it("при першому запуску розсилає всі ліди і зберігає найновішу дату", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(report).toEqual({ pending: 3, delivered: 3, failed: 0 });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
  });

  it("не пересуває позначку за лід, який не вдалося доставити", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    const failingOnSecond: Integration = {
      name: "failing",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_0002") return { ok: false, error: "зовнішня система недоступна" };
        sent.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    const report = await runSync(leads, [failingOnSecond], statePath);

    // ld_0003 навіть не пробували: інакше наступний прогін надіслав би його вдруге.
    expect(sent).toEqual(["ld_0001"]);
    expect(report).toEqual({ pending: 3, delivered: 1, failed: 1 });
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T10:00:00.000Z" } });
  });

  // Рівна позначка приховала б невдалий лід назавжди: фільтр pending строгий (`>`).
  it("не пересуває позначку на час, який ділить із недоставленим лідом", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    const sameMoment = [makeLead("ld_0010", "2026-09-09T12:00:00.000Z"), makeLead("ld_0011", "2026-09-09T12:00:00.000Z")];
    const failingOnSecond: Integration = {
      name: "failing",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_0011") return { ok: false, error: "зовнішня система недоступна" };
        sent.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    await runSync(sameMoment, [failingOnSecond], statePath);

    expect(sent).toEqual(["ld_0010"]);
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "1970-01-01T00:00:00.000Z" } });
  });

  it("не розсилає нічого, якщо файл стану пошкоджений", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, '{"lastSyncedAt":');

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual([]);
    expect(report).toEqual({ pending: 0, delivered: 0, failed: 0 });
    expect(readFileSync(statePath, "utf8")).toBe('{"lastSyncedAt":');
  });

  it("розсилає лише ліди, новіші за збережений стан", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));

    await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual(["ld_0002", "ld_0003"]);
  });
});
