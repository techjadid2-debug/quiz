import { Bot, BotError, type Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { onGroupNext, onGroupPollAnswer, showGroupTop, startGroupQuiz, stopGroup } from "./group";
import { CB } from "./keyboards";
import {
  onPrivateNext,
  onPrivatePollAnswer,
  onRetryWrong,
  onSettingsCallback,
  onSettingsDone,
  showHelp,
  showMenu,
  showSettings,
  showStats,
  startMistakes,
  startQuiz,
  stopPrivate,
} from "./private";
import type { BotStore } from "./store";
import { T } from "./texts";

const isPrivate = (ctx: Context) => ctx.chat?.type === "private";
const isGroup = (ctx: Context) => ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

export function createBot(store: BotStore, token = process.env.TELEGRAM_BOT_TOKEN, botInfo?: UserFromGetMe): Bot {
  if (!token) throw new Error("[bot] TELEGRAM_BOT_TOKEN topilmadi");
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  // ---------------------------------------------------------------- buyruqlar
  bot.command("start", async (ctx) => {
    if (isPrivate(ctx)) await showMenu(ctx, store, { welcome: true });
    else if (isGroup(ctx)) await ctx.reply(T.groupIntro);
  });

  bot.command("help", async (ctx) => {
    if (isPrivate(ctx)) await showHelp(ctx);
    else await ctx.reply(T.groupHelp, { parse_mode: "HTML" });
  });

  bot.command("quiz", async (ctx) => {
    if (isPrivate(ctx)) await startQuiz(ctx, store);
    else if (isGroup(ctx)) await startGroupQuiz(ctx, store, ctx.match);
  });

  bot.command("stop", async (ctx) => {
    if (isPrivate(ctx)) await stopPrivate(ctx, store);
    else if (isGroup(ctx)) await stopGroup(ctx, store);
  });

  bot.command("top", async (ctx) => {
    if (isGroup(ctx)) await showGroupTop(ctx, store);
    else await ctx.reply(T.groupOnly);
  });

  bot.command(["settings", "stats", "mistakes"], async (ctx) => {
    if (!isPrivate(ctx)) {
      await ctx.reply(T.privateOnly);
      return;
    }
    const cmd = ctx.message?.text?.split(/[\s@]/)[0].slice(1);
    if (cmd === "settings") await showSettings(ctx, store);
    else if (cmd === "stats") await showStats(ctx, store);
    else await startMistakes(ctx, store);
  });

  // ---------------------------------------------------------------- tugmalar
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [kind, a, b] = data.split(":");

    if (kind === "gn" && isGroup(ctx)) return onGroupNext(ctx, store, a, Number(b));
    if (!isPrivate(ctx)) return void (await ctx.answerCallbackQuery().catch(() => {}));

    if (kind === "nx") return onPrivateNext(ctx, store, a, Number(b));
    if (kind === "sc" || kind === "sd" || kind === "sn" || kind === "st") return onSettingsCallback(ctx, store, data);
    if (data === CB.done) return onSettingsDone(ctx, store);
    if (kind === "rw") return onRetryWrong(ctx, store, data.slice(3));

    await ctx.answerCallbackQuery().catch(() => {});
    switch (data) {
      case CB.quiz:
        return startQuiz(ctx, store);
      case CB.settings:
        return showSettings(ctx, store, true);
      case CB.stats:
        return showStats(ctx, store);
      case CB.mistakes:
        return startMistakes(ctx, store);
      case CB.help:
        return showHelp(ctx);
      case CB.menu:
        return showMenu(ctx, store);
    }
  });

  // ---------------------------------------------------------------- javoblar
  bot.on("poll_answer", async (ctx) => {
    const pa = ctx.pollAnswer;
    const ref = await store.getPollRef(pa.poll_id);
    if (!ref) return;
    const session = await store.getSession(ref.chatId);
    if (!session) return;
    if (session.kind === "private") await onPrivatePollAnswer(ctx.api, store, session, pa, ref.index);
    else await onGroupPollAnswer(store, session, pa, ref.index);
  });

  // ---------------------------------------------------------------- guruhga qo'shilganda
  bot.on("my_chat_member", async (ctx) => {
    const { old_chat_member: oldM, new_chat_member: newM } = ctx.myChatMember;
    const joined =
      (oldM.status === "left" || oldM.status === "kicked") &&
      (newM.status === "member" || newM.status === "administrator");
    if (joined && isGroup(ctx)) await ctx.reply(T.groupIntro);
  });

  // Shaxsiy chatdagi boshqa matnlar — menyu.
  bot.on("message:text", async (ctx) => {
    if (isPrivate(ctx) && !ctx.message.text.startsWith("/")) await showMenu(ctx, store);
  });

  bot.catch((err) => logBotError(err));
  return bot;
}

export function logBotError(err: unknown) {
  if (err instanceof BotError) {
    console.error(`[bot] update ${err.ctx.update.update_id} xatosi:`, err.error);
  } else {
    console.error("[bot] xato:", err);
  }
}

/** Update'ni qayta ishlaydi; xatolarni loglaydi, tashqariga chiqarmaydi (Telegram qayta yubormasligi uchun). */
export async function handleUpdateSafe(bot: Bot, update: Update): Promise<void> {
  try {
    await bot.handleUpdate(update);
  } catch (err) {
    logBotError(err);
  }
}
