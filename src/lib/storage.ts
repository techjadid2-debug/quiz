// Barcha o'qish/yozish try/catch ichida; SSR'da (window yo'q) default qiymat qaytaradi.
import { DIFFICULTIES, QuestionSchema, type Question } from "./schema";
import type { QuizSettings, SessionQuestion, SessionResult } from "./types";

export const DEFAULT_SETTINGS: QuizSettings = { categories: [], difficulty: "mixed", count: 10, timer: 0 };

export interface ActiveSession {
  questions: SessionQuestion[];
  settings: QuizSettings;
  mode: SessionResult["mode"];
  startedAt: string;
  /** Mashg'ulot tugagach natija ID'si — qayta ochilganda takroriy natija saqlanmasligi uchun. */
  resultId?: string;
}

export const STORAGE_PREFIX = "zakovat:v1:";
export const STORAGE_KEYS = {
  settings: `${STORAGE_PREFIX}settings`,
  history: `${STORAGE_PREFIX}history`,
  mistakes: `${STORAGE_PREFIX}mistakes`,
  imported: `${STORAGE_PREFIX}imported`,
  active: `${STORAGE_PREFIX}active`,
} as const;
export const HISTORY_LIMIT = 200;

type StoreKind = "local" | "session";

function getStore(kind: StoreKind): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJSON(kind: StoreKind, key: string): unknown {
  try {
    const raw = getStore(kind)?.getItem(key);
    return raw == null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

function writeJSON(kind: StoreKind, key: string, value: unknown): void {
  try {
    getStore(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // kvota to'lgan yoki saqlash bloklangan — jimgina e'tiborsiz qoldiramiz
  }
}

function remove(kind: StoreKind, key: string): void {
  try {
    getStore(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Har qanday (ehtimol buzilgan) qiymatni yaroqli QuizSettings ga aylantiradi, DEFAULT_SETTINGS bilan to'ldiradi. */
export function sanitizeSettings(value: unknown): QuizSettings {
  const s = isObject(value) ? value : {};
  const categories = Array.isArray(s.categories)
    ? Array.from(new Set(s.categories.filter((c): c is string => typeof c === "string" && c.length > 0)))
    : DEFAULT_SETTINGS.categories;
  const difficulty =
    s.difficulty === "mixed" || (DIFFICULTIES as readonly unknown[]).includes(s.difficulty)
      ? (s.difficulty as QuizSettings["difficulty"])
      : DEFAULT_SETTINGS.difficulty;
  const count = [5, 10, 20].includes(s.count as number) ? (s.count as QuizSettings["count"]) : DEFAULT_SETTINGS.count;
  const timer = [0, 15, 30].includes(s.timer as number) ? (s.timer as QuizSettings["timer"]) : DEFAULT_SETTINGS.timer;
  return { categories, difficulty, count, timer };
}

export function loadSettings(): QuizSettings {
  return sanitizeSettings(readJSON("local", STORAGE_KEYS.settings));
}

export function saveSettings(s: QuizSettings): void {
  writeJSON("local", STORAGE_KEYS.settings, sanitizeSettings(s));
}

function isResult(v: unknown): v is SessionResult {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    typeof v.finishedAt === "string" &&
    Array.isArray(v.questionIds) &&
    Array.isArray(v.answers) &&
    typeof v.correctCount === "number" &&
    typeof v.wrongCount === "number" &&
    typeof v.score === "number" &&
    typeof v.maxScore === "number" &&
    typeof v.percent === "number"
  );
}

/** Yangi -> eski tartibda. */
export function loadHistory(): SessionResult[] {
  const raw = readJSON("local", STORAGE_KEYS.history);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isResult).map((r) => ({ ...r, settings: sanitizeSettings(r.settings) }));
}

export function getResult(id: string): SessionResult | undefined {
  return loadHistory().find((r) => r.id === id);
}

/** Natijani tarixga qo'shadi va xatolar pulini yangilaydi (xato -> qo'shiladi, to'g'ri -> olib tashlanadi). */
export function saveResult(r: SessionResult): void {
  const history = [r, ...loadHistory().filter((h) => h.id !== r.id)].slice(0, HISTORY_LIMIT);
  writeJSON("local", STORAGE_KEYS.history, history);

  const correct = new Set<string>();
  const wrong = new Set<string>();
  const answered = new Set<string>();
  for (const a of r.answers) {
    answered.add(a.questionId);
    (a.correct ? correct : wrong).add(a.questionId);
  }
  // Javob berilmagan savollar ham xato hisoblanadi (scoring bilan izchil).
  for (const id of r.questionIds) if (!answered.has(id)) wrong.add(id);

  const mistakes = loadMistakes().filter((id) => !correct.has(id));
  const set = new Set(mistakes);
  for (const id of wrong) if (!correct.has(id) && !set.has(id)) {
    set.add(id);
    mistakes.push(id);
  }
  writeJSON("local", STORAGE_KEYS.mistakes, mistakes);
}

export function clearHistory(): void {
  remove("local", STORAGE_KEYS.history);
}

/** Hali to'g'ri javob berilmagan xato savollar ID'lari. */
export function loadMistakes(): string[] {
  const raw = readJSON("local", STORAGE_KEYS.mistakes);
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((x): x is string => typeof x === "string")));
}

export function clearMistakes(): void {
  remove("local", STORAGE_KEYS.mistakes);
}

/** Joriy mashg'ulot (sahifalar orasida uzatish uchun, sessionStorage). */
export function saveActiveSession(s: ActiveSession): void {
  writeJSON("session", STORAGE_KEYS.active, s);
}

export function loadActiveSession(): ActiveSession | null {
  const raw = readJSON("session", STORAGE_KEYS.active);
  if (!isObject(raw) || !Array.isArray(raw.questions) || typeof raw.startedAt !== "string") return null;
  const questions = raw.questions.filter(
    (q): q is SessionQuestion =>
      isObject(q) &&
      typeof q.id === "string" &&
      Array.isArray(q.options) &&
      typeof q.answer === "number" &&
      Array.isArray(q.optionOrder),
  );
  if (questions.length === 0) return null;
  return {
    questions,
    settings: sanitizeSettings(raw.settings),
    mode: raw.mode === "mistakes" ? "mistakes" : "normal",
    startedAt: raw.startedAt,
    resultId: typeof raw.resultId === "string" ? raw.resultId : undefined,
  };
}

export function clearActiveSession(): void {
  remove("session", STORAGE_KEYS.active);
}

/** Brauzerga import qilingan savollar — doim status "pending", mashg'ulotga kirmaydi. */
export function loadImported(): Question[] {
  const raw = readJSON("local", STORAGE_KEYS.imported);
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const item of raw) {
    const p = QuestionSchema.safeParse(item);
    if (p.success) out.push({ ...p.data, status: "pending" });
  }
  return out;
}

export function saveImported(qs: Question[]): void {
  writeJSON(
    "local",
    STORAGE_KEYS.imported,
    qs.map((q) => ({ ...q, status: "pending" })),
  );
}

export function clearImported(): void {
  remove("local", STORAGE_KEYS.imported);
}
