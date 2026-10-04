/**
 * Telegram botni sozlash: webhook, buyruqlar, tavsiflar.
 *
 *   npm run bot:setup                     # production URL'ga webhook o'rnatadi
 *   npm run bot:setup -- --url https://... # boshqa URL
 *   npm run bot:setup -- --info           # faqat getMe + getWebhookInfo (hech narsani o'zgartirmaydi)
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (process.env yoki .env.local).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Api } from "grammy";
import type { BotCommand } from "grammy/types";

const DEFAULT_URL = "https://zakovat-mashgulot.vercel.app/api/telegram";

function loadEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const PRIVATE_COMMANDS: BotCommand[] = [
  { command: "start", description: "Asosiy menyu" },
  { command: "quiz", description: "Mashg‘ulotni boshlash" },
  { command: "settings", description: "Sozlamalar: kategoriya, qiyinlik, son, taymer" },
  { command: "stats", description: "Natijalarim" },
  { command: "mistakes", description: "Xatolar ustida ishlash" },
  { command: "stop", description: "Joriy mashg‘ulotni to‘xtatish" },
  { command: "help", description: "Yordam" },
];

const GROUP_COMMANDS: BotCommand[] = [
  { command: "quiz", description: "Guruh o‘yinini boshlash (/quiz 5, 10 yoki 20)" },
  { command: "top", description: "Guruhning umumiy reytingi" },
  { command: "stop", description: "O‘yinni to‘xtatish (boshlovchi yoki admin)" },
  { command: "help", description: "Yordam" },
];

const DESCRIPTION =
  "Zakovat mashg‘uloti: turli sohalardan tasdiqlangan savollar Telegram viktorinasi ko‘rinishida. " +
  "Kategoriya, qiyinlik va taymerni sozlang, xatolaringiz ustida ishlang, natijalaringizni kuzating. " +
  "Guruhga qo‘shib, do‘stlar bilan bellashing!";
const SHORT_DESCRIPTION = "Zakovat savollari bilan mashg‘ulot va guruh o‘yini.";

async function main() {
  loadEnvLocal();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN topilmadi (.env.local yoki env)");
  const api = new Api(token);

  const me = await api.getMe();
  console.log(`Bot: @${me.username} (id ${me.id})`);

  if (process.argv.includes("--info")) {
    const info = await api.getWebhookInfo();
    console.log("Webhook:", { ...info, url: info.url || "(yo‘q)" });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET topilmadi (.env.local yoki env)");
  const url = arg("url") ?? DEFAULT_URL;

  await api.setWebhook(url, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query", "poll_answer", "my_chat_member"],
    drop_pending_updates: true,
    // Update'lar ketma-ket keladi — sessiya JSON'ini parallel yozishda poyga holati bo'lmaydi.
    max_connections: 1,
  });
  console.log(`setWebhook: ${url}`);

  await api.setMyCommands(PRIVATE_COMMANDS, { scope: { type: "all_private_chats" } });
  await api.setMyCommands(GROUP_COMMANDS, { scope: { type: "all_group_chats" } });
  console.log("setMyCommands: private + group");

  await api.setMyDescription(DESCRIPTION);
  await api.setMyShortDescription(SHORT_DESCRIPTION);
  console.log("setMyDescription / setMyShortDescription: OK");

  const info = await api.getWebhookInfo();
  console.log("getWebhookInfo:", info);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
