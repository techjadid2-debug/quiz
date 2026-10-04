import { GrammyError, type Api, type InlineKeyboard } from "grammy";
import type { User } from "grammy/types";
import { categoryName } from "@/lib/categories";
import { DIFFICULTY_LABELS } from "@/lib/schema";
import { pointsFor } from "@/lib/scoring";
import type { SessionQuestion } from "@/lib/types";
import type { BotSession, BotStore } from "./store";

export const POLL_QUESTION_MAX = 300;
export const POLL_EXPLANATION_MAX = 200;

function cut(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** "3/10 · Geografiya · Qiyin · 3 ball\n\n<savol>" — 300 belgidan oshsa prefiks qisqartiriladi. */
export function pollQuestionText(q: SessionQuestion, index: number, total: number): string {
  const pos = `${index + 1}/${total}`;
  const full = `${pos} · ${categoryName(q.category)} · ${DIFFICULTY_LABELS[q.difficulty]} · ${pointsFor(q.difficulty)} ball\n\n`;
  for (const prefix of [full, `${pos}\n\n`, ""]) {
    if (prefix.length + q.question.length <= POLL_QUESTION_MAX) return prefix + q.question;
  }
  return cut(q.question, POLL_QUESTION_MAX);
}

/** Joriy savolni quiz-poll sifatida yuboradi va sessiya + poll havolasini saqlaydi. */
export async function sendQuestion(
  api: Api,
  store: BotStore,
  session: BotSession,
  openPeriod: number,
  replyMarkup: InlineKeyboard,
): Promise<void> {
  const q = session.questions[session.index];
  const question = pollQuestionText(q, session.index, session.questions.length);
  const base = {
    is_anonymous: false,
    type: "quiz" as const,
    explanation: cut(q.explanation, POLL_EXPLANATION_MAX),
    reply_markup: replyMarkup,
    ...(openPeriod > 0 ? { open_period: openPeriod } : {}),
  };
  let msg;
  try {
    msg = await api.sendPoll(session.chatId, question, q.options, { ...base, correct_option_ids: [q.answer] });
  } catch (err) {
    // Eski Bot API versiyasi bilan moslik: correct_option_id (yagona).
    if (!(err instanceof GrammyError && /correct_option/i.test(err.description))) throw err;
    msg = await api.sendPoll(session.chatId, question, q.options, {
      ...base,
      correct_option_id: q.answer,
    } as typeof base);
  }
  session.currentPollId = msg.poll.id;
  session.currentPollMessageId = msg.message_id;
  session.askedAt = Date.now();
  await store.setPollRef(msg.poll.id, { chatId: session.chatId, index: session.index });
  await store.setSession(session);
}

/** Joriy pollni yopadi (xatolar e'tiborsiz — poll allaqachon yopilgan bo'lishi mumkin). */
export async function stopCurrentPoll(api: Api, session: BotSession): Promise<void> {
  if (session.currentPollMessageId === undefined) return;
  try {
    await api.stopPoll(session.chatId, session.currentPollMessageId);
  } catch {
    // allaqachon yopilgan yoki o'chirilgan
  }
}

export function displayName(u: Pick<User, "first_name" | "last_name" | "username">): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || (u.username ? `@${u.username}` : "Ishtirokchi");
  return name.length > 40 ? name.slice(0, 39) + "…" : name;
}

export async function isChatAdmin(api: Api, chatId: number, userId: number): Promise<boolean> {
  try {
    const m = await api.getChatMember(chatId, userId);
    return m.status === "creator" || m.status === "administrator";
  } catch {
    return false;
  }
}
