import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord, parseJson } from "../core/parse.js";
import type { Lead } from "../core/types.js";
import { hubspotContact } from "./hubspot-contact.js";

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  const parsed = parseJson(String(init?.body), isRecord, "тіло запиту");
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

const lead: Lead = {
  id: "ld_0011",
  name: "Марія Тестова",
  email: "mariia@studio-nova.example.test",
  phone: "+380000000002",
  source: "website",
  budgetUsd: 4000,
  createdAt: "2026-09-10T11:00:00.000Z",
};

const ACCESS_TOKEN = "fake-hubspot-access-token-000000";

beforeEach(() => {
  vi.stubEnv("HUBSPOT_ACCESS_TOKEN", ACCESS_TOKEN);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot-contact", () => {
  it("створює контакт і повертає ok", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"id":"701234567"}', { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspotContact.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(requestBody(init)).toEqual({
      properties: {
        email: "mariia@studio-nova.example.test",
        firstname: "Марія Тестова",
        phone: "+380000000002",
        lead_source: "website",
        budget_usd: 4000,
      },
    });
  });

  it("передає токен заголовком Authorization", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"id":"701234567"}', { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await hubspotContact.send(lead);

    const headers = fetchMock.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("повертає помилку, якщо змінної середовища немає", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_ACCESS_TOKEN",
    });
  });

  it("повертає помилку, якщо HubSpot відповів не 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));

    const result = await hubspotContact.send(lead);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("HTTP 401");
  });

  it("повертає помилку, якщо відповідь має несподівану форму", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"status":"created"}', { status: 201 })));

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "hubspot-contact: unexpected shape",
    });
  });
});
