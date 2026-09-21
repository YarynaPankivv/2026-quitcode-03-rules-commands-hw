import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord, parseJson } from "../core/parse.js";
import type { Lead } from "../core/types.js";
import { telegramNotify } from "./telegram-notify.js";

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  const parsed = parseJson(String(init?.body), isRecord, "тіло запиту");
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

const lead: Lead = {
  id: "ld_0007",
  name: "Олена Тестова",
  email: "olena@studio-nova.example.test",
  phone: "+380000000000",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T10:15:00.000Z",
};

const BOT_TOKEN = "123456789:fake-telegram-token-000000000000";

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000001");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("надсилає повідомлення в чат і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(telegramNotify.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
    expect(requestBody(init)).toEqual({
      chat_id: "-1000000000001",
      text: "Новий лід: Олена Тестова · referral · бюджет $2500",
    });
  });

  it("не передає email і телефон ліда у сповіщення", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await telegramNotify.send(lead);

    const body = String(fetchMock.mock.calls[0]![1]?.body);
    expect(body).not.toContain(lead.email);
    expect(body).not.toContain(lead.phone);
  });

  it("повертає помилку, якщо змінної середовища немає", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("повертає помилку, якщо Telegram відхилив повідомлення", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false,"description":"chat not found"}', { status: 200 })),
    );

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram error: chat not found",
    });
  });

  it("повертає помилку, якщо Telegram відповів не 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Request", { status: 400 })));

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("HTTP 400");
  });
});
