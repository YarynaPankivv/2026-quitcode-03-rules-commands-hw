// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

const isSyncState: Guard<SyncState> = (value): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt);

export function loadState(path: string): Result<SyncState> {
  if (!existsSync(path)) return { ok: true, value: { ...INITIAL_STATE } };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sync state ${path}: ${reason}` };
  }

  return parseJson(text, isSyncState, `sync state ${path}`);
}

// Запис через тимчасовий файл: якщо диск заповнений, падає запис у tmp, а
// поточний стан лишається цілим. Прямий writeFileSync обрізав би його до нуля
// перед записом — саме так стан було втрачено в інциденті 10.09.2026.
export function saveState(path: string, state: SyncState): void {
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(state, null, 2));
  renameSync(tempPath, path);
}
