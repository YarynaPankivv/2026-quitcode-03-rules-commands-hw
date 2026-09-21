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

  const pending = leads
    .filter((lead) => lead.createdAt > state.value.lastSyncedAt)
    .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1));

  let delivered = 0;
  let failed = 0;
  const deliveredAt: string[] = [];
  let failedAt: string | undefined;

  // Ліди йдуть за часом створення, і прогін спиняється на першій невдачі:
  // раніше позначка рухалася вперед попри помилки, і недоставлений лід лічився
  // синхронізованим назавжди. Зупинка замість «пропустити й піти далі» ще й не
  // дає повторно розіслати те, що вже дійшло.
  for (const lead of pending) {
    let leadDelivered = true;
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) delivered++;
      else {
        failed++;
        leadDelivered = false;
      }
    }
    if (!leadDelivered) {
      failedAt = lead.createdAt;
      break;
    }
    deliveredAt.push(lead.createdAt);
  }

  // Позначка не доходить до часу невдалого ліда, навіть якщо інший лід із
  // тим самим createdAt доставлено: порівняння в фільтрі строге (`>`), тож
  // рівна позначка назавжди приховала б недоставлений лід.
  const limit = failedAt;
  const syncedUpTo = deliveredAt
    .filter((at) => limit === undefined || at < limit)
    .reduce((latest, at) => (at > latest ? at : latest), state.value.lastSyncedAt);

  const saved = saveState(statePath, { lastSyncedAt: syncedUpTo });
  if (!saved.ok) {
    // Позначка не зрушила: наступний прогін повторить уже доставлені ліди.
    // Єдине, що тут можна зробити, — не дати цьому статися тихо.
    log.error(`sync: ${saved.error}; позначку не збережено, наступний прогін повторить ці ліди`);
  }

  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
