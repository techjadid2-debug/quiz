import type { Question } from "@/lib/schema";

/** Deterministik (mulberry32) tasodifiy son generatori. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeQuestion(over: Partial<Question> & { id: string }): Question {
  return {
    question: `Test savoli ${over.id} uchun matn?`,
    options: ["Birinchi", "Ikkinchi", "Uchinchi", "To‘rtinchi"],
    answer: 1,
    explanation: "Bu tushuntirish matni yetarlicha uzun.",
    category: "geography",
    difficulty: "easy",
    source: "https://example.com",
    status: "verified",
    ...over,
  };
}

export class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
