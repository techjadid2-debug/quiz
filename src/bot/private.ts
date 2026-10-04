import type { Api, Context } from "grammy";
import type { PollAnswer } from "grammy/types";
import { categoryName } from "@/lib/categories";
import { filterQuestions, getQuestionById } from "@/lib/questions";
import { computeResult } from "@/lib/scoring";
import { createSession, createSessionFromIds } from "@/lib/session";
import type { AnswerRecord, QuizSettings, SessionQuestion, SessionResult } from "@/lib/types";
import {
  applySettingsCallback,
  mainMenu,
  nextKeyboard,
  resultKeyboard,
  sessionKey,
  settingsKeyboard,
} from "./keyboards";
import { sendQuestion, stopCurrentPoll } from "./poll";
import type { BotSession, BotStore } from "./store";
import { T, esc } from "./texts";

const HTML = { parse_mode: "HTML" as const };

/** Telegram "message is not modified" xatosini e'tiborsiz qoldiradi. */
async function safeEdit(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (!(err instanceof Error && /not modified/i.test(err.message))) throw err;
  }
}

async function answerCb(ctx: Context, text?: string, alert = false): Promise<void> {
  if (!ctx.callbackQuery) return;
  try {
    await ctx.answerCallbackQuery(text ? { text, show_alert: alert } : undefined);
  } catch {
    // eskirgan callback — e'tiborsiz
  }
}

// ---------------------------------------------------------------- menyu

export async function showMenu(ctx: Context, store: BotStore, opts: { welcome?: boolean; edit?: boolean } = {}) {
  const user = ctx.from!;
  const mistakes = (await store.getMistakes(user.id)).length;
  const text = opts.welcome ? T.welcome(user.first_name) : T.menu;
  const markup = { reply_markup: mainMenu(mistakes), ...HTML };
  if (opts.edit && ctx.callbackQuery?.message) await safeEdit(() => ctx.editMessageText(text, markup));
  else await ctx.reply(text, markup);
}

export async function showHelp(ctx: Context) {
  await ctx.reply(T.help, { ...HTML, link_preview_options: { is_disabled: true } });
}

// ---------------------------------------------------------------- sozlamalar

function settingsView(s: QuizSettings) {
  const available = filterQuestions(s.categories, s.difficulty).length;
  return { text: T.settingsTitle(s, available), markup: { reply_markup: settingsKeyboard(s), ...HTML } };
}

export async function showSettings(ctx: Context, store: BotStore, edit = false) {
  const s = await store.getSettings(ctx.from!.id);
  const v = settingsView(s);
  if (edit && ctx.callbackQuery?.message) await safeEdit(() => ctx.editMessageText(v.text, v.markup));
  else await ctx.reply(v.text, v.markup);
}

/** sc:/sd:/sn:/st: callback'lari — o'sha xabarni tahrirlaydi. */
export async function onSettingsCallback(ctx: Context, store: BotStore, data: string) {
  const userId = ctx.from!.id;
  const next = applySettingsCallback(await store.getSettings(userId), data);
  if (!next) return answerCb(ctx);
  await store.setSettings(userId, next);
  await answerCb(ctx);
  const v = settingsView(await store.getSettings(userId));
  await safeEdit(() => ctx.editMessageText(v.text, v.markup));
}

export async function onSettingsDone(ctx: Context, store: BotStore) {
  await answerCb(ctx, T.settingsSaved);
  await showMenu(ctx, store, { edit: true });
}

// ---------------------------------------------------------------- mashg'ulot

async function beginSession(
  ctx: Context,
  store: BotStore,
  questions: SessionQuestion[],
  settings: QuizSettings,
  mode: SessionResult["mode"],
) {
  const chatId = ctx.chat!.id;
  const userId = ctx.from!.id;
  if (questions.length === 0) {
    await ctx.reply(mode === "mistakes" ? T.noMistakes : T.noQuestions);
    return;
  }
  // Oldingi faol mashg'ulot bo'lsa — uning so'rovnomasini yopamiz.
  const prev = await store.getSession(chatId);
  if (prev) await stopCurrentPoll(ctx.api, prev);

  if (mode === "normal" && questions.length < settings.count) {
    await ctx.reply(T.fewQuestions(questions.length, settings.count));
  }
  await ctx.reply(T.sessionStart(questions.length, settings, mode === "mistakes"));
  const session: BotSession = {
    chatId,
    kind: "private",
    mode,
    settings,
    questions,
    index: 0,
    answers: [],
    answerTimes: [],
    scores: {},
    hostId: userId,
    startedAt: new Date().toISOString(),
  };
  await sendPrivateQuestion(ctx.api, store, session);
}

function sendPrivateQuestion(api: Api, store: BotStore, session: BotSession) {
  return sendQuestion(api, store, session, session.settings.timer, nextKeyboard(sessionKey(session.startedAt), session.index));
}

export async function startQuiz(ctx: Context, store: BotStore) {
  const settings = await store.getSettings(ctx.from!.id);
  await beginSession(ctx, store, createSession(settings), settings, "normal");
}

export async function startMistakes(ctx: Context, store: BotStore, ids?: string[]) {
  const userId = ctx.from!.id;
  const settings = await store.getSettings(userId);
  const pool = ids ?? (await store.getMistakes(userId));
  await beginSession(ctx, store, createSessionFromIds(pool), settings, "mistakes");
}

/** rw:<resultId> — o'sha natijadagi xato savollardan mashg'ulot. */
export async function onRetryWrong(ctx: Context, store: BotStore, resultId: string) {
  await answerCb(ctx);
  const r = (await store.getHistory(ctx.from!.id)).find((h) => h.id === resultId);
  if (!r) return startMistakes(ctx, store);
  const correct = new Set(r.answers.filter((a) => a.correct).map((a) => a.questionId));
  await startMistakes(
    ctx,
    store,
    r.questionIds.filter((id) => !correct.has(id)),
  );
}

/** Joriy savolga javobni yozadi va keyingisiga o'tadi (yoki yakunlaydi). */
async function recordAndAdvance(api: Api, store: BotStore, session: BotSession, selected: number | null) {
  session.answers.push(selected);
  (session.answerTimes ??= []).push(session.askedAt ? Math.max(0, Date.now() - session.askedAt) : 0);
  session.index += 1;
  session.currentPollId = undefined;
  session.currentPollMessageId = undefined;
  if (session.index >= session.questions.length) await finishPrivate(api, store, session);
  else await sendPrivateQuestion(api, store, session);
}

/** poll_answer (shaxsiy). Eskirgan yoki takroriy javoblar e'tiborsiz qoldiriladi. */
export async function onPrivatePollAnswer(api: Api, store: BotStore, session: BotSession, pa: PollAnswer, refIndex: number) {
  if (pa.user?.id !== session.hostId) return;
  if (pa.poll_id !== session.currentPollId || refIndex !== session.index) return;
  if (session.answers.length > session.index) return; // allaqachon javob berilgan
  const selected = pa.option_ids[0];
  if (selected === undefined) return; // ovoz qaytarib olindi
  await recordAndAdvance(api, store, session, selected);
}

/** nx:<key>:<index> — javob berilmagan bo'lsa null (xato) yoziladi, poll yopiladi. */
export async function onPrivateNext(ctx: Context, store: BotStore, key: string, index: number) {
  const session = await store.getSession(ctx.chat!.id);
  if (!session || session.kind !== "private" || sessionKey(session.startedAt) !== key || session.index !== index) {
    return answerCb(ctx, T.stale);
  }
  await answerCb(ctx);
  if (session.answers.length > session.index) return; // javob allaqachon yozilgan
  await stopCurrentPoll(ctx.api, session);
  await recordAndAdvance(ctx.api, store, session, null);
}

async function finishPrivate(api: Api, store: BotStore, session: BotSession) {
  const answers: AnswerRecord[] = session.questions.map((q, i) => {
    const selected = session.answers[i] ?? null;
    return { questionId: q.id, selected, correct: selected === q.answer, timeMs: session.answerTimes?.[i] ?? 0 };
  });
  const result = computeResult({ questions: session.questions, answers, settings: session.settings, mode: session.mode });
  await store.saveResult(session.hostId, result);
  await store.deleteSession(session.chatId);
  await api.sendMessage(session.chatId, T.result(result), {
    ...HTML,
    reply_markup: resultKeyboard(result.wrongCount > 0 ? result.id : null),
  });
}

export async function stopPrivate(ctx: Context, store: BotStore) {
  const session = await store.getSession(ctx.chat!.id);
  if (!session) return ctx.reply(T.noSession);
  await stopCurrentPoll(ctx.api, session);
  await store.deleteSession(session.chatId);
  await ctx.reply(T.stopped);
}

// ---------------------------------------------------------------- statistika

export async function showStats(ctx: Context, store: BotStore) {
  const history = await store.getHistory(ctx.from!.id);
  if (history.length === 0) return ctx.reply(T.statsEmpty);
  const avg = Math.round(history.reduce((s, r) => s + r.percent, 0) / history.length);
  let correct = 0;
  let total = 0;
  const byCat = new Map<string, { correct: number; total: number }>();
  for (const r of history) {
    for (const a of r.answers) {
      total += 1;
      if (a.correct) correct += 1;
      const cat = getQuestionById(a.questionId)?.category;
      if (!cat) continue;
      const c = byCat.get(cat) ?? { correct: 0, total: 0 };
      c.total += 1;
      if (a.correct) c.correct += 1;
      byCat.set(cat, c);
    }
  }
  const lines = [T.statsTitle(history.length, avg, correct, total)];
  if (byCat.size > 0) {
    lines.push(T.statsCategoryHeader);
    [...byCat.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([cat, c]) =>
        lines.push(`${esc(categoryName(cat))}: ${Math.round((c.correct / c.total) * 100)}% (${c.correct}/${c.total})`),
      );
  }
  await ctx.reply(lines.join("\n"), HTML);
}
