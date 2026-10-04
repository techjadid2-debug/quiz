// Ishlatish: npm run validate
// data/questions/*.json fayllarini tekshiradi; xato bo'lsa 1 kodi bilan chiqadi.
import fs from "node:fs";
import path from "node:path";
import { DIFFICULTIES, QuestionSchema, type Difficulty, type Question } from "../src/lib/schema";
import { QUESTIONS_DIR, idPrefix, listQuestionFiles, loadCategories, normalizeText, readRaw } from "./lib";

const errors: string[] = [];
const warnings: string[] = [];
const categories = loadCategories();
const categoryIds = new Set(categories.map((c) => c.id));

const idSeen = new Map<string, string>(); // id -> fayl
const textSeen = new Map<string, string>(); // normallashgan matn -> "fayl:id"
const all: Question[] = [];

const indexFile = path.join(QUESTIONS_DIR, "index.ts");
const indexSource = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8") : "";

for (const file of listQuestionFiles()) {
  const fileCategory = path.basename(file, ".json");
  const fullPath = path.join(QUESTIONS_DIR, file);
  if (!categoryIds.has(fileCategory)) {
    errors.push(`${file}: "${fileCategory}" kategoriyasi categories.json da yo‘q`);
  }
  if (!indexSource.includes(`./${file}`)) {
    warnings.push(`${file}: data/questions/index.ts da ro‘yxatdan o‘tkazilmagan (ilovaga yuklanmaydi)`);
  }
  let raw: unknown[];
  try {
    raw = readRaw(fullPath);
  } catch (e) {
    errors.push(`${file}: ${(e as Error).message}`);
    continue;
  }
  const prefixes = new Map<string, number>();
  raw.forEach((item, i) => {
    const where = `${file}[${i}]`;
    const p = QuestionSchema.safeParse(item);
    if (!p.success) {
      const id = (item as { id?: unknown } | null)?.id;
      errors.push(
        `${where}${typeof id === "string" ? ` (${id})` : ""}: ` +
          p.error.issues.map((x) => `${x.path.map(String).join(".") || "-"}: ${x.message}`).join("; "),
      );
      return;
    }
    const q = p.data;
    if (q.category !== fileCategory) {
      errors.push(`${where} (${q.id}): category "${q.category}" fayl nomiga (${fileCategory}) mos emas`);
    }
    if (!categoryIds.has(q.category)) errors.push(`${where} (${q.id}): noma’lum kategoriya "${q.category}"`);
    const prev = idSeen.get(q.id);
    if (prev) errors.push(`${where}: takroriy id "${q.id}" (avval: ${prev})`);
    else idSeen.set(q.id, file);
    const norm = normalizeText(q.question);
    const prevText = textSeen.get(norm);
    if (prevText) errors.push(`${where} (${q.id}): takroriy savol matni (avval: ${prevText})`);
    else textSeen.set(norm, `${file}:${q.id}`);
    const pre = idPrefix(q.id);
    if (pre) prefixes.set(pre, (prefixes.get(pre) ?? 0) + 1);
    all.push(q);
  });
  if (prefixes.size > 1) {
    const list = [...prefixes.entries()].map(([k, v]) => `${k}-* (${v})`).join(", ");
    errors.push(`${file}: id prefikslari bir xil emas: ${list}`);
  }
}

// Jadval: kategoriya x qiyinlik
const header = ["Kategoriya", ...DIFFICULTIES, "jami", "verified", "pending"];
const rows: string[][] = [];
const totals = { easy: 0, medium: 0, hard: 0, all: 0, verified: 0, pending: 0 };
const catIds = [...categoryIds, ...new Set(all.map((q) => q.category).filter((c) => !categoryIds.has(c)))];
for (const cat of catIds) {
  const qs = all.filter((q) => q.category === cat);
  const by = (d: Difficulty) => qs.filter((q) => q.difficulty === d).length;
  const verified = qs.filter((q) => q.status === "verified").length;
  for (const d of DIFFICULTIES) totals[d] += by(d);
  totals.all += qs.length;
  totals.verified += verified;
  totals.pending += qs.length - verified;
  rows.push([cat, ...DIFFICULTIES.map((d) => String(by(d))), String(qs.length), String(verified), String(qs.length - verified)]);
}
rows.push([
  "JAMI",
  String(totals.easy),
  String(totals.medium),
  String(totals.hard),
  String(totals.all),
  String(totals.verified),
  String(totals.pending),
]);
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const fmt = (r: string[]) => r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
console.log(fmt(header));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
rows.forEach((r, i) => {
  if (i === rows.length - 1) console.log(widths.map((w) => "-".repeat(w)).join("  "));
  console.log(fmt(r));
});

if (warnings.length) {
  console.log(`\nOgohlantirishlar (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  ! ${w}`));
}
if (errors.length) {
  console.error(`\nXatolar (${errors.length}):`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
console.log(`\n✓ ${all.length} ta savol tekshirildi, xato yo‘q.`);
