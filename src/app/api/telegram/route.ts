import { timingSafeEqual } from "node:crypto";
import type { Bot } from "grammy";
import type { Update } from "grammy/types";
import { createBot, handleUpdateSafe } from "@/bot/bot";
import { getStore } from "@/bot/store";

// Telegram webhook (Node.js runtime — standart). Har bir instansiyada bot bir marta yaratiladi va init qilinadi
// (getMe faqat sovuq startda chaqiriladi).
let botPromise: Promise<Bot> | null = null;

function getBot(): Promise<Bot> {
  if (!botPromise) {
    botPromise = (async () => {
      const bot = createBot(getStore());
      await bot.init();
      return bot;
    })().catch((err) => {
      botPromise = null; // keyingi so'rovda qayta urinish
      throw err;
    });
  }
  return botPromise;
}

function secretMatches(given: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("unauthorized", { status: 401 });
  }
  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!update || typeof update.update_id !== "number") return new Response("bad request", { status: 400 });

  let bot: Bot;
  try {
    bot = await getBot();
  } catch (err) {
    // Sozlash xatosi (token/Redis yo'q) — 500, Telegram keyinroq qayta yuboradi.
    console.error("[telegram] bot init xatosi:", err);
    return new Response("bot init failed", { status: 500 });
  }
  // Ishlov berishdagi xatolar loglanadi, Telegram'ga doim 200 (qayta yuborish tsikli bo'lmasligi uchun).
  await handleUpdateSafe(bot, update);
  return new Response("ok");
}

export async function GET(): Promise<Response> {
  return new Response("ok");
}
