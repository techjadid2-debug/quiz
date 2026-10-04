// Skriptlar uchun umumiy yordamchilar (Node muhiti).
import fs from "node:fs";
import path from "node:path";
import { QuestionSchema, type Category, type Question } from "../src/lib/schema";

export const ROOT = path.resolve(__dirname, "..");
/** ZAKOVAT_QUESTIONS_DIR — test uchun boshqa katalogni ko'rsatish imkoniyati. */
export const QUESTIONS_DIR = process.env.ZAKOVAT_QUESTIONS_DIR
  ? path.resolve(process.env.ZAKOVAT_QUESTIONS_DIR)
  : path.join(ROOT, "data", "questions");
export const CATEGORIES_FILE = path.join(ROOT, "data", "categories.json");

export function loadCategories(): Category[] {
  return JSON.parse(fs.readFileSync(CATEGORIES_FILE, "utf8")) as Category[];
}

export function listQuestionFiles(): string[] {
  return fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function categoryFile(categoryId: string): string {
  return path.join(QUESTIONS_DIR, `${categoryId}.json`);
}

/** Faylni xom holda o'qiydi (yo'q bo'lsa bo'sh massiv). */
export function readRaw(file: string): unknown[] {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(data)) throw new Error(`${path.basename(file)}: JSON massiv bo‘lishi kerak`);
  return data;
}

/** Faqat sxemadan o'tgan savollar. */
export function readValid(file: string): Question[] {
  return readRaw(file).flatMap((q) => {
    const p = QuestionSchema.safeParse(q);
    return p.success ? [p.data] : [];
  });
}

export function writeQuestions(file: string, qs: unknown[]): void {
  fs.writeFileSync(file, JSON.stringify(qs, null, 2) + "\n", "utf8");
}

export function idPrefix(id: string): string | null {
  const m = /^([a-z]+)-(\d+)$/.exec(id);
  return m ? m[1] : null;
}

export function idNumber(id: string): number | null {
  const m = /^[a-z]+-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’ʻʼ`']/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) flags[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}
