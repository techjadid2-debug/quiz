import type { Question } from "./schema";
import type { QuizSettings, SessionQuestion } from "./types";
import { filterQuestions, getQuestionById } from "./questions";

/** Fisher–Yates aralashtirish (asl massiv o'zgarmaydi). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Savolni mashg'ulotga tayyorlaydi: variantlar aralashtiriladi, answer yangi indeksga o'tkaziladi. */
export function toSessionQuestion(q: Question, rng: () => number = Math.random): SessionQuestion {
  const optionOrder = shuffle(
    q.options.map((_, i) => i),
    rng,
  );
  return {
    ...q,
    options: optionOrder.map((i) => q.options[i]),
    answer: optionOrder.indexOf(q.answer),
    optionOrder,
  };
}

/** Savollar ro'yxatidan mashg'ulot tuzadi (sof funksiya, testlar uchun qulay). */
export function buildSession(pool: readonly Question[], count: number, rng: () => number = Math.random): SessionQuestion[] {
  const unique = Array.from(new Map(pool.map((q) => [q.id, q])).values());
  return shuffle(unique, rng)
    .slice(0, Math.max(0, count))
    .map((q) => toSessionQuestion(q, rng));
}

/** Filtr bo'yicha takrorlanmaydigan, aralashtirilgan savollar (count dan kam bo'lishi mumkin). */
export function createSession(settings: QuizSettings, rng: () => number = Math.random): SessionQuestion[] {
  return buildSession(filterQuestions(settings.categories, settings.difficulty), settings.count, rng);
}

/** Berilgan ID'lar bo'yicha (masalan, xato savollar) yangi mashg'ulot; mavjud bo'lmagan ID'lar tashlab yuboriladi. */
export function createSessionFromIds(ids: string[], rng: () => number = Math.random): SessionQuestion[] {
  const qs = Array.from(new Set(ids))
    .map((id) => getQuestionById(id))
    .filter((q): q is Question => q !== undefined);
  return shuffle(qs, rng).map((q) => toSessionQuestion(q, rng));
}
