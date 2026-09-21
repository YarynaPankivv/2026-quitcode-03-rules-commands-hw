// Додавання ліда окремим рядком у Google-таблицю.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface SheetsResponse {
  status: string;
}

const isSheetsResponse: Guard<SheetsResponse> = (value): value is SheetsResponse =>
  isRecord(value) && isString(value.status);

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;

    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = webhookUrl.value + "?token=" + token.value;
    // Append не ідемпотентний і дедуплікації в таблиці немає: якщо рядок уже
    // додано, а відповідь загубилась, повтор створить дубль. Саме дублі в
    // таблиці були скаргою клієнта в інциденті 10.09.2026, тому тут одна спроба.
    // Канали сповіщень (slack-notify, telegram-notify) лишаються з типовими
    // повторами: дубль повідомлення дешевший за втрачене.
    const response = await postJson(
      url,
      { values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]] },
      { retries: 0 },
    );
    if (!response.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const data = parseJson(response.value, isSheetsResponse, "sheets-append");
    if (!data.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${data.error}`);
      return data;
    }

    if (data.value.status !== "ok") {
      log.error("sheets-append failed: " + url + " -> " + data.value.status);
      return { ok: false, error: "sheets error: " + data.value.status };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
