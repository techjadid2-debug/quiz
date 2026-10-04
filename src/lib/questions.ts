import rawQuestions from "../../data/questions/index";
import { DIFFICULTIES, QuestionSchema, type Difficulty, type Question } from "./schema";
import type { DifficultyFilter } from "./types";

/** Xom ma'lumotni sxema bo'yicha tekshiradi; yaroqsizlari tashlab yuboriladi (dev rejimida ogohlantirish). */
export function validateQuestions(raw: readonly unknown[]): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const parsed = QuestionSchema.safeParse(item);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        const id = (item as { id?: unknown } | null)?.id;
        console.warn(
          `[questions] Yaroqsiz savol #${i}${typeof id === "string" ? ` (${id})` : ""} tashlab yuborildi:`,
          parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        );
      }
      return;
    }
    if (seen.has(parsed.data.id)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[questions] Takroriy id "${parsed.data.id}" tashlab yuborildi`);
      }
      return;
    }
    seen.add(parsed.data.id);
    out.push(parsed.data);
  });
  return out;
}

let allCache: Question[] | null = null;
let verifiedCache: Question[] | null = null;
let byIdCache: Map<string, Question> | null = null;

/** data/questions/*.json dagi barcha savollar (har qanday status). */
export function getAllQuestions(): Question[] {
  if (!allCache) allCache = validateQuestions(rawQuestions);
  return allCache;
}

/** Faqat status === "verified" savollar — mashg'ulot faqat shulardan tuziladi. */
export function getVerifiedQuestions(): Question[] {
  if (!verifiedCache) verifiedCache = getAllQuestions().filter((q) => q.status === "verified");
  return verifiedCache;
}

export function getQuestionById(id: string): Question | undefined {
  if (!byIdCache) byIdCache = new Map(getAllQuestions().map((q) => [q.id, q]));
  return byIdCache.get(id);
}

/** Filtr bo'yicha verified savollar. categories bo'sh = hammasi. */
export function filterQuestions(categories: string[], difficulty: DifficultyFilter): Question[] {
  const cats = categories.length > 0 ? new Set(categories) : null;
  return getVerifiedQuestions().filter(
    (q) => (!cats || cats.has(q.category)) && (difficulty === "mixed" || q.difficulty === difficulty),
  );
}

function emptyByDifficulty(): Record<Difficulty, number> {
  return Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
}

/** Kategoriya bo'yicha verified savollar soni (umumiy va qiyinlik bo'yicha). */
export function getCategoryStats(): Record<string, { total: number; byDifficulty: Record<Difficulty, number> }> {
  const stats: Record<string, { total: number; byDifficulty: Record<Difficulty, number> }> = {};
  for (const q of getVerifiedQuestions()) {
    const s = (stats[q.category] ??= { total: 0, byDifficulty: emptyByDifficulty() });
    s.total += 1;
    s.byDifficulty[q.difficulty] += 1;
  }
  return stats;
}
