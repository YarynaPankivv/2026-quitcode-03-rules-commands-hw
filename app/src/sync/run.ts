// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
import { log } from "../core/log.js";
import type { Integration, Lead } from "../core/types.js";
import { loadState, saveState } from "./state.js";

export interface SyncReport {
  pending: number;
  delivered: number;
  failed: number;
}

export async function runSync(
  leads: readonly Lead[],
  integrations: readonly Integration[],
  statePath: string,
): Promise<SyncReport> {
  const state = loadState(statePath);
  if (!state.ok) {
    log.error(`sync: ${state.error}; стан не перезаписано, прогін пропущено`);
    return { pending: 0, delivered: 0, failed: 0 };
  }

  const pending = leads.filter((lead) => lead.createdAt > state.value.lastSyncedAt);
  let delivered = 0;
  let failed = 0;

  for (const lead of pending) {
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) delivered++;
      else failed++;
    }
  }

  const newest = pending.reduce(
    (latest, lead) => (lead.createdAt > latest ? lead.createdAt : latest),
    state.value.lastSyncedAt,
  );
  const saved = saveState(statePath, { lastSyncedAt: newest });
  if (!saved.ok) {
    // Позначка не зрушила: наступний прогін повторить уже доставлені ліди.
    // Єдине, що тут можна зробити, — не дати цьому статися тихо.
    log.error(`sync: ${saved.error}; позначку не збережено, наступний прогін повторить ці ліди`);
  }

  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
