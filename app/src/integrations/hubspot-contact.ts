// Створення контакту в HubSpot CRM за новим лідом.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

interface HubspotContact {
  id: string;
}

const isHubspotContact: Guard<HubspotContact> = (value): value is HubspotContact =>
  isRecord(value) && isString(value.id);

export const hubspotContact: Integration = {
  name: "hubspot-contact",
  requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const accessToken = readEnv("HUBSPOT_ACCESS_TOKEN");
    if (!accessToken.ok) return accessToken;

    // CRM — система обліку, а не канал сповіщень, тому повні дані ліда допустимі.
    // Створення контакту не ідемпотентне: повтор після втраченої відповіді дає
    // або дубль, або 409 на вже створений контакт. Повторну спробу бере на себе
    // наступний прогін — runSync не рухає позначку далі невдалого ліда.
    const response = await postJson(
      CONTACTS_URL,
      {
        properties: {
          email: lead.email,
          firstname: lead.name,
          phone: lead.phone ?? "",
          lead_source: lead.source,
          budget_usd: lead.budgetUsd,
        },
      },
      { headers: { authorization: `Bearer ${accessToken.value}` }, retries: 0 },
    );
    if (!response.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const contact = parseJson(response.value, isHubspotContact, "hubspot-contact");
    if (!contact.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${contact.error}`);
      return contact;
    }

    log.info(`hubspot-contact: lead ${lead.id} saved as contact ${contact.value.id}`);
    return { ok: true, value: undefined };
  },
};
