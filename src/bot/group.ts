import type { Api, Context } from "grammy";
import type { PollAnswer } from "grammy/types";
import { pointsFor } from "@/lib/scoring";
import { createSession } from "@/lib/session";
import type { QuizSettings } from "@/lib/types";
import { groupNextKeyboard, sessionKey } from "./keyboards";
import { displayName, isChatAdmin, sendQuestion, stopCurrentPoll } from "./poll";
import type { BotSession, BotStore } from "./store";
import { T, rankLine } from "./texts";

const HTML = { parse_mode: "HTML" as const };
export const GROUP_DEFAULT_TIMER = 30;
export const GROUP_DEFAULT_COUNT = 10;

function parseCount(arg: string | undefined): QuizSettings["count"] | null {
  const n = Number((arg ?? "").trim().split(/\s+/)[0]);
  return n === 5 || n === 10 || n === 20 ? n : null;
}

function groupTimer(s: BotSession): number {
  return s.settings.timer > 0 ? s.settings.timer : GROUP_DEFAULT_TIMER;
}

function sendGroupQuestion(api: Api, store: BotStore, session: BotSession) {
  const last = session.index === session.questions.length - 1;
  return sendQuestion(
    api,
    store,
    session,
    groupTimer(session),
    groupNextKeyboard(sessionKey(session.startedAt), session.index, last),
  );
}

async function canControl(ctx: Context, session: BotSession): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId === undefined) return false;
  if (userId === session.hostId) return true;
  return isChatAdmin(ctx.api, session.chatId, userId);
}

/** /quiz [5|10|20] guruhda. Boshlovchi sozlamalari (kategoriya, qiyinlik) ishlatiladi; taymer majburiy. */
export async function startGroupQuiz(ctx: Context, store: BotStore, arg?: string) {
  const chatId = ctx.chat!.id;
  const host = ctx.from!;
  if (await store.getSession(chatId)) {
    await ctx.reply(T.groupAlreadyRunning);
    return;
  }
  const hostSettings = await store.getSettings(host.id);
  const settings: QuizSettings = {
    ...hostSettings,
    count: parseCount(arg) ?? GROUP_DEFAULT_COUNT,
    timer: hostSettings.timer > 0 ? hostSettings.timer : GROUP_DEFAULT_TIMER,
  };
  const questions = createSession(settings);
  if (questions.length === 0) {
    await ctx.reply(T.noQuestions);
    return;
  }
  const session: BotSession = {
    chatId,
    kind: "group",
    mode: "normal",
    settings,
    questions,
    index: 0,
    answers: [],
    scores: {},
    hostId: host.id,
    answeredBy: [],
    startedAt: new Date().toISOString(),
  };
  await ctx.reply(T.groupStart(questions.length, settings.timer, displayName(host)), HTML);
  await sendGroupQuestion(ctx.api, store, session);
}

/** poll_answer (guruh): har a'zoning bali yig'iladi; takroriy/eskirgan javoblar e'tiborsiz. */
export async function onGroupPollAnswer(store: BotStore, session: BotSession, pa: PollAnswer, refIndex: number) {
  const user = pa.user;
  if (!user || user.is_bot) return;
  if (pa.poll_id !== session.currentPollId || refIndex !== session.index) return;
  const answered = (session.answeredBy ??= []);
  if (answered.includes(user.id)) return;
  const selected = pa.option_ids[0];
  if (selected === undefined) return;
  answered.push(user.id);
  const q = session.questions[session.index];
  const entry = (session.scores[String(user.id)] ??= { name: displayName(user), score: 0, correct: 0 });
  entry.name = displayName(user);
  if (selected === q.answer) {
    entry.score += pointsFor(q.difficulty);
    entry.correct += 1;
  }
  await store.setSession(session);
}

/** gn:<key>:<index> — faqat boshlovchi yoki admin. */
export async function onGroupNext(ctx: Context, store: BotStore, key: string, index: number) {
  const session = await store.getSession(ctx.chat!.id);
  if (!session || session.kind !== "group" || sessionKey(session.startedAt) !== key || session.index !== index) {
    await ctx.answerCallbackQuery({ text: T.stale }).catch(() => {});
    return;
  }
  if (!(await canControl(ctx, session))) {
    await ctx.answerCallbackQuery({ text: T.onlyHost, show_alert: true }).catch(() => {});
    return;
  }
  await ctx.answerCallbackQuery().catch(() => {});
  await stopCurrentPoll(ctx.api, session);
  session.index += 1;
  session.answeredBy = [];
  session.currentPollId = undefined;
  session.currentPollMessageId = undefined;
  if (session.index >= session.questions.length) await finishGroup(ctx.api, store, session);
  else await sendGroupQuestion(ctx.api, store, session);
}

export function leaderboard(scores: BotSession["scores"], limit = 10): string {
  const rows = Object.values(scores)
    .sort((a, b) => b.score - a.score || b.correct - a.correct)
    .slice(0, limit);
  if (rows.length === 0) return T.groupNobody;
  return rows.map((r, i) => rankLine(i, r.name, r.score, r.correct)).join("\n");
}

async function finishGroup(api: Api, store: BotStore, session: BotSession) {
  await store.addGroupScores(session.chatId, session.scores);
  await store.deleteSession(session.chatId);
  await api.sendMessage(session.chatId, `${T.groupFinishTitle}\n\n${leaderboard(session.scores)}\n\n/top — umumiy reyting`, HTML);
}

export async function stopGroup(ctx: Context, store: BotStore) {
  const session = await store.getSession(ctx.chat!.id);
  if (!session) {
    await ctx.reply(T.groupNoGame);
    return;
  }
  if (!(await canControl(ctx, session))) {
    await ctx.reply(T.onlyHostStop);
    return;
  }
  await stopCurrentPoll(ctx.api, session);
  await store.deleteSession(session.chatId);
  await ctx.reply(`${T.groupStoppedTitle}\n\n${leaderboard(session.scores)}`, HTML);
}

export async function showGroupTop(ctx: Context, store: BotStore) {
  const top = await store.getGroupTop(ctx.chat!.id, 10);
  if (top.length === 0) {
    await ctx.reply(T.groupTopEmpty);
    return;
  }
  await ctx.reply(`${T.groupTopTitle}\n\n${top.map((r, i) => rankLine(i, r.name, r.score)).join("\n")}`, HTML);
}
