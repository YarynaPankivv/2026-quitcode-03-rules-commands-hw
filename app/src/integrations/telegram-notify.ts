// Сповіщення про новий лід у Telegram-чат менеджерів.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, parseJson, type Guard } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

const isTelegramResponse: Guard<TelegramResponse> = (value): value is TelegramResponse =>
  isRecord(value) && typeof value.ok === "boolean";

/** Канал сповіщень: ні email, ні телефону — лише ім'я, джерело й бюджет. */
export function formatTelegramMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

export const telegramNotify: Integration = {
  name: "telegram-notify",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],

  async send(lead: Lead): Promise<Result<void>> {
    const botToken = readEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken.ok) return botToken;

    const chatId = readEnv("TELEGRAM_CHAT_ID");
    if (!chatId.ok) return chatId;

    const url = `https://api.telegram.org/bot${botToken.value}/sendMessage`;
    // sendMessage не ідемпотентний: повтор після втраченої відповіді надсилає
    // друге повідомлення. Повторну спробу бере на себе наступний прогін —
    // runSync не рухає позначку далі невдалого ліда.
    const response = await postJson(
      url,
      { chat_id: chatId.value, text: formatTelegramMessage(lead) },
      { retries: 0 },
    );
    if (!response.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const data = parseJson(response.value, isTelegramResponse, "telegram-notify");
    if (!data.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${data.error}`);
      return data;
    }

    if (!data.value.ok) {
      const reason = data.value.description ?? "unknown";
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${reason}`);
      return { ok: false, error: `telegram error: ${reason}` };
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
