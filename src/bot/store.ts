// KONTRAKT — BOT agenti amalga oshiradi (RedisStore, MemoryStore). Interfeysni o'zgartirmang.
import { Redis } from "@upstash/redis";
import IORedis from "ioredis";
import type { QuizSettings, SessionQuestion, SessionResult } from "@/lib/types";
import { DEFAULT_SETTINGS, sanitizeSettings } from "@/lib/storage";

/** Chatdagi faol sessiya (shaxsiy yoki guruh). */
export interface BotSession {
  chatId: number;
  kind: "private" | "group";
  mode: SessionResult["mode"];
  settings: QuizSettings;
  questions: SessionQuestion[];
  index: number;                 // joriy savol
  /** Shaxsiy: foydalanuvchi javoblari (index → tanlangan variant yoki null). */
  answers: (number | null)[];
  /** Guruh: userId → ball va to'g'ri javoblar soni. */
  scores: Record<string, { name: string; score: number; correct: number }>;
  hostId: number;                // boshlagan foydalanuvchi
  currentPollId?: string;
  currentPollMessageId?: number;
  startedAt: string;
  /** Joriy savol yuborilgan vaqt (ms) — javob vaqtini hisoblash uchun. */
  askedAt?: number;
  /** Shaxsiy: har bir javobga ketgan vaqt (ms), answers bilan bir xil tartibda. */
  answerTimes?: number[];
  /** Guruh: joriy savolga javob bergan userId'lar (takroriy poll_answer'ni e'tiborsiz qoldirish uchun). */
  answeredBy?: number[];
}

export interface PollRef {
  chatId: number;
  index: number;
}

export interface BotStore {
  getSettings(userId: number): Promise<QuizSettings>;
  setSettings(userId: number, s: QuizSettings): Promise<void>;

  getSession(chatId: number): Promise<BotSession | null>;
  setSession(s: BotSession): Promise<void>;
  deleteSession(chatId: number): Promise<void>;

  setPollRef(pollId: string, ref: PollRef): Promise<void>;
  getPollRef(pollId: string): Promise<PollRef | null>;

  /** Natijani tarixga qo'shadi (oxirgi 50) va xatolar to'plamini yangilaydi. */
  saveResult(userId: number, r: SessionResult): Promise<void>;
  getHistory(userId: number): Promise<SessionResult[]>;
  getMistakes(userId: number): Promise<string[]>;

  /** Guruh umumiy reytingiga ball qo'shadi. */
  addGroupScores(chatId: number, scores: BotSession["scores"]): Promise<void>;
  getGroupTop(chatId: number, limit: number): Promise<{ userId: string; name: string; score: number }[]>;
}

// ---------------------------------------------------------------------------

export const HISTORY_LIMIT = 50;
export const POLL_TTL_SEC = 60 * 60 * 24; // 1 kun
export const SESSION_TTL_SEC = 60 * 60 * 24 * 2; // 2 kun

export const keys = {
  settings: (id: number) => `u:${id}:settings`,
  history: (id: number) => `u:${id}:history`,
  mistakes: (id: number) => `u:${id}:mistakes`,
  session: (chatId: number) => `s:${chatId}`,
  poll: (pollId: string) => `p:${pollId}`,
  groupTop: (chatId: number) => `g:${chatId}:top`,
  groupNames: (chatId: number) => `g:${chatId}:names`,
};

/** Natijadan xatolar to'plamini yangilash uchun: to'g'ri (olib tashlanadi) va xato (qo'shiladi) ID'lar — web bilan bir xil qoida. */
export function mistakeDelta(r: SessionResult): { correct: string[]; wrong: string[] } {
  const correct = new Set<string>();
  const wrong = new Set<string>();
  const answered = new Set<string>();
  for (const a of r.answers) {
    answered.add(a.questionId);
    (a.correct ? correct : wrong).add(a.questionId);
  }
  for (const id of r.questionIds) if (!answered.has(id)) wrong.add(id);
  for (const id of correct) wrong.delete(id);
  return { correct: [...correct], wrong: [...wrong] };
}

function parseJSON<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

export class RedisStore implements BotStore {
  constructor(private redis: Redis) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): RedisStore | null {
    const cfg = redisConfigFromEnv(env);
    if (!cfg) return null;
    return new RedisStore(new Redis({ ...cfg, automaticDeserialization: false }));
  }

  async getSettings(userId: number): Promise<QuizSettings> {
    const raw = await this.redis.get<string>(keys.settings(userId));
    return sanitizeSettings(parseJSON(raw) ?? DEFAULT_SETTINGS);
  }

  async setSettings(userId: number, s: QuizSettings): Promise<void> {
    await this.redis.set(keys.settings(userId), JSON.stringify(sanitizeSettings(s)));
  }

  async getSession(chatId: number): Promise<BotSession | null> {
    return parseJSON<BotSession>(await this.redis.get<string>(keys.session(chatId)));
  }

  async setSession(s: BotSession): Promise<void> {
    await this.redis.set(keys.session(s.chatId), JSON.stringify(s), { ex: SESSION_TTL_SEC });
  }

  async deleteSession(chatId: number): Promise<void> {
    await this.redis.del(keys.session(chatId));
  }

  async setPollRef(pollId: string, ref: PollRef): Promise<void> {
    await this.redis.set(keys.poll(pollId), JSON.stringify(ref), { ex: POLL_TTL_SEC });
  }

  async getPollRef(pollId: string): Promise<PollRef | null> {
    return parseJSON<PollRef>(await this.redis.get<string>(keys.poll(pollId)));
  }

  async saveResult(userId: number, r: SessionResult): Promise<void> {
    const { correct, wrong } = mistakeDelta(r);
    const p = this.redis.pipeline();
    p.lpush(keys.history(userId), JSON.stringify(r));
    p.ltrim(keys.history(userId), 0, HISTORY_LIMIT - 1);
    if (correct.length > 0) p.srem(keys.mistakes(userId), ...correct);
    if (wrong.length > 0) p.sadd(keys.mistakes(userId), wrong[0], ...wrong.slice(1));
    await p.exec();
  }

  async getHistory(userId: number): Promise<SessionResult[]> {
    const raw = await this.redis.lrange<string>(keys.history(userId), 0, HISTORY_LIMIT - 1);
    return raw.map((x) => parseJSON<SessionResult>(x)).filter((x): x is SessionResult => x !== null);
  }

  async getMistakes(userId: number): Promise<string[]> {
    return (await this.redis.smembers<string[]>(keys.mistakes(userId))).map(String);
  }

  async addGroupScores(chatId: number, scores: BotSession["scores"]): Promise<void> {
    const entries = Object.entries(scores);
    if (entries.length === 0) return;
    const p = this.redis.pipeline();
    const names: Record<string, string> = {};
    for (const [userId, s] of entries) {
      p.zincrby(keys.groupTop(chatId), s.score, userId);
      names[userId] = s.name;
    }
    p.hset(keys.groupNames(chatId), names);
    await p.exec();
  }

  async getGroupTop(chatId: number, limit: number): Promise<{ userId: string; name: string; score: number }[]> {
    const flat = await this.redis.zrange<(string | number)[]>(keys.groupTop(chatId), 0, limit - 1, {
      rev: true,
      withScores: true,
    });
    const rows: { userId: string; score: number }[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) rows.push({ userId: String(flat[i]), score: Number(flat[i + 1]) });
    if (rows.length === 0) return [];
    const names =
      (await this.redis.hmget<Record<string, string | null>>(keys.groupNames(chatId), ...rows.map((r) => r.userId))) ?? {};
    return rows.map((r) => ({ ...r, name: names[r.userId] ?? r.userId }));
  }
}

// ---------------------------------------------------------------------------

/** O'z serverimizdagi Redis (TCP, REDIS_URL) — kalitlar va qoidalar RedisStore bilan bir xil. */
export class TcpRedisStore implements BotStore {
  constructor(private redis: IORedis) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): TcpRedisStore | null {
    if (!env.REDIS_URL) return null;
    return new TcpRedisStore(new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 2 }));
  }

  async getSettings(userId: number): Promise<QuizSettings> {
    return sanitizeSettings(parseJSON(await this.redis.get(keys.settings(userId))) ?? DEFAULT_SETTINGS);
  }

  async setSettings(userId: number, s: QuizSettings): Promise<void> {
    await this.redis.set(keys.settings(userId), JSON.stringify(sanitizeSettings(s)));
  }

  async getSession(chatId: number): Promise<BotSession | null> {
    return parseJSON<BotSession>(await this.redis.get(keys.session(chatId)));
  }

  async setSession(s: BotSession): Promise<void> {
    await this.redis.set(keys.session(s.chatId), JSON.stringify(s), "EX", SESSION_TTL_SEC);
  }

  async deleteSession(chatId: number): Promise<void> {
    await this.redis.del(keys.session(chatId));
  }

  async setPollRef(pollId: string, ref: PollRef): Promise<void> {
    await this.redis.set(keys.poll(pollId), JSON.stringify(ref), "EX", POLL_TTL_SEC);
  }

  async getPollRef(pollId: string): Promise<PollRef | null> {
    return parseJSON<PollRef>(await this.redis.get(keys.poll(pollId)));
  }

  async saveResult(userId: number, r: SessionResult): Promise<void> {
    const { correct, wrong } = mistakeDelta(r);
    const p = this.redis.multi();
    p.lpush(keys.history(userId), JSON.stringify(r));
    p.ltrim(keys.history(userId), 0, HISTORY_LIMIT - 1);
    if (correct.length > 0) p.srem(keys.mistakes(userId), ...correct);
    if (wrong.length > 0) p.sadd(keys.mistakes(userId), ...wrong);
    await p.exec();
  }

  async getHistory(userId: number): Promise<SessionResult[]> {
    const raw = await this.redis.lrange(keys.history(userId), 0, HISTORY_LIMIT - 1);
    return raw.map((x) => parseJSON<SessionResult>(x)).filter((x): x is SessionResult => x !== null);
  }

  async getMistakes(userId: number): Promise<string[]> {
    return this.redis.smembers(keys.mistakes(userId));
  }

  async addGroupScores(chatId: number, scores: BotSession["scores"]): Promise<void> {
    const entries = Object.entries(scores);
    if (entries.length === 0) return;
    const p = this.redis.multi();
    const names: Record<string, string> = {};
    for (const [userId, s] of entries) {
      p.zincrby(keys.groupTop(chatId), s.score, userId);
      names[userId] = s.name;
    }
    p.hset(keys.groupNames(chatId), names);
    await p.exec();
  }

  async getGroupTop(chatId: number, limit: number): Promise<{ userId: string; name: string; score: number }[]> {
    const flat = await this.redis.zrevrange(keys.groupTop(chatId), 0, limit - 1, "WITHSCORES");
    const rows: { userId: string; score: number }[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) rows.push({ userId: flat[i], score: Number(flat[i + 1]) });
    if (rows.length === 0) return [];
    const names = await this.redis.hmget(keys.groupNames(chatId), ...rows.map((r) => r.userId));
    return rows.map((r, i) => ({ ...r, name: names[i] ?? r.userId }));
  }
}

// ---------------------------------------------------------------------------

/** Testlar va lokal ishlab chiqish uchun. Qiymatlar JSON orqali nusxalanadi (Redis bilan bir xil xatti-harakat). */
export class MemoryStore implements BotStore {
  settings = new Map<number, string>();
  sessions = new Map<number, string>();
  polls = new Map<string, string>();
  history = new Map<number, string[]>();
  mistakes = new Map<number, Set<string>>();
  groupTop = new Map<number, Map<string, number>>();
  groupNames = new Map<number, Map<string, string>>();

  async getSettings(userId: number): Promise<QuizSettings> {
    const raw = this.settings.get(userId);
    return sanitizeSettings(raw ? JSON.parse(raw) : DEFAULT_SETTINGS);
  }

  async setSettings(userId: number, s: QuizSettings): Promise<void> {
    this.settings.set(userId, JSON.stringify(sanitizeSettings(s)));
  }

  async getSession(chatId: number): Promise<BotSession | null> {
    const raw = this.sessions.get(chatId);
    return raw ? (JSON.parse(raw) as BotSession) : null;
  }

  async setSession(s: BotSession): Promise<void> {
    this.sessions.set(s.chatId, JSON.stringify(s));
  }

  async deleteSession(chatId: number): Promise<void> {
    this.sessions.delete(chatId);
  }

  async setPollRef(pollId: string, ref: PollRef): Promise<void> {
    this.polls.set(pollId, JSON.stringify(ref));
  }

  async getPollRef(pollId: string): Promise<PollRef | null> {
    const raw = this.polls.get(pollId);
    return raw ? (JSON.parse(raw) as PollRef) : null;
  }

  async saveResult(userId: number, r: SessionResult): Promise<void> {
    const list = [JSON.stringify(r), ...(this.history.get(userId) ?? [])].slice(0, HISTORY_LIMIT);
    this.history.set(userId, list);
    const { correct, wrong } = mistakeDelta(r);
    const set = this.mistakes.get(userId) ?? new Set<string>();
    for (const id of correct) set.delete(id);
    for (const id of wrong) set.add(id);
    this.mistakes.set(userId, set);
  }

  async getHistory(userId: number): Promise<SessionResult[]> {
    return (this.history.get(userId) ?? []).map((x) => JSON.parse(x) as SessionResult);
  }

  async getMistakes(userId: number): Promise<string[]> {
    return [...(this.mistakes.get(userId) ?? [])];
  }

  async addGroupScores(chatId: number, scores: BotSession["scores"]): Promise<void> {
    const top = this.groupTop.get(chatId) ?? new Map<string, number>();
    const names = this.groupNames.get(chatId) ?? new Map<string, string>();
    for (const [userId, s] of Object.entries(scores)) {
      top.set(userId, (top.get(userId) ?? 0) + s.score);
      names.set(userId, s.name);
    }
    this.groupTop.set(chatId, top);
    this.groupNames.set(chatId, names);
  }

  async getGroupTop(chatId: number, limit: number): Promise<{ userId: string; name: string; score: number }[]> {
    const names = this.groupNames.get(chatId);
    return [...(this.groupTop.get(chatId) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, score]) => ({ userId, score, name: names?.get(userId) ?? userId }));
  }
}

// ---------------------------------------------------------------------------

/** Vercel Marketplace (Upstash) ikkala nomlash sxemasini qo'llab-quvvatlaydi. */
export function redisConfigFromEnv(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

let storeSingleton: BotStore | null = null;

/** Redis env bo'lsa RedisStore; aks holda production'da xato, test/dev'da MemoryStore. */
export function getStore(): BotStore {
  if (storeSingleton) return storeSingleton;
  const tcp = TcpRedisStore.fromEnv();
  if (tcp) return (storeSingleton = tcp);
  const redis = RedisStore.fromEnv();
  if (redis) return (storeSingleton = redis);
  const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST;
  if (process.env.NODE_ENV === "production" && !isTest) {
    throw new Error(
      "[bot] Redis sozlanmagan: REDIS_URL yoki KV_REST_API_URL/KV_REST_API_TOKEN yoki UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN env o'zgaruvchilarini qo'shing.",
    );
  }
  if (!isTest) console.warn("[bot] Redis env topilmadi — MemoryStore ishlatilmoqda (faqat lokal sinov uchun).");
  return (storeSingleton = new MemoryStore());
}
