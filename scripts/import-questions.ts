// Ishlatish: npm run import -- path/to/file.(csv|json) [--status verified]
// Standart holatda barcha import qilingan savollar status "pending" bo'ladi.
import fs from "node:fs";
import path from "node:path";
import { detectFormat, parseQuestions } from "../src/lib/io";
import type { Question } from "../src/lib/schema";
import {
  QUESTIONS_DIR,
  categoryFile,
  idNumber,
  idPrefix,
  listQuestionFiles,
  loadCategories,
  normalizeText,
  parseArgs,
  readRaw,
  writeQuestions,
} from "./lib";

function fail(msg: string): never {
  console.error(`Xato: ${msg}`);
  process.exit(1);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const input = positional[0];
if (!input) fail("fayl ko‘rsatilmagan. Ishlatish: npm run import -- savollar.csv [--status verified]");
const format = detectFormat(input);
if (!format) fail("fayl kengaytmasi .csv yoki .json bo‘lishi kerak");
if (!fs.existsSync(input)) fail(`fayl topilmadi: ${input}`);
const status = flags.status;
if (status !== undefined && status !== "verified" && status !== "pending") {
  fail("--status faqat verified yoki pending bo‘lishi mumkin");
}

const text = fs.readFileSync(input, "utf8");
const { valid, errors } = parseQuestions(text, format, { forcePending: status !== "verified" });
if (errors.length) {
  console.warn(`Yaroqsiz qatorlar (${errors.length}) o‘tkazib yuborildi:`);
  errors.forEach((e) => console.warn(`  - ${e.message}`));
}

const categoryIds = new Set(loadCategories().map((c) => c.id));
const unknown = [...new Set(valid.map((q) => q.category).filter((c) => !categoryIds.has(c)))];
if (unknown.length) fail(`noma’lum kategoriya(lar): ${unknown.join(", ")} — avval data/categories.json ga qo‘shing`);

// Mavjud barcha id va matnlar (barcha fayllar bo'yicha)
const existingIds = new Set<string>();
const existingTexts = new Set<string>();
const fileData = new Map<string, unknown[]>();
for (const f of listQuestionFiles()) {
  const raw = readRaw(path.join(QUESTIONS_DIR, f));
  fileData.set(path.basename(f, ".json"), raw);
  for (const item of raw) {
    const q = item as Partial<Question>;
    if (typeof q.id === "string") existingIds.add(q.id);
    if (typeof q.question === "string") existingTexts.add(normalizeText(q.question));
  }
}

function prefixFor(category: string, incoming: Question): string {
  for (const item of fileData.get(category) ?? []) {
    const p = typeof (item as Partial<Question>).id === "string" ? idPrefix((item as Question).id) : null;
    if (p) return p;
  }
  return idPrefix(incoming.id) ?? category.slice(0, 3);
}

function nextFreeId(prefix: string): string {
  let max = 0;
  for (const id of existingIds) if (idPrefix(id) === prefix) max = Math.max(max, idNumber(id) ?? 0);
  let n = max + 1;
  let id = `${prefix}-${String(n).padStart(3, "0")}`;
  while (existingIds.has(id)) id = `${prefix}-${String(++n).padStart(3, "0")}`;
  return id;
}

const added: Record<string, number> = {};
let reassigned = 0;
let skippedDup = 0;
for (const q of valid) {
  const norm = normalizeText(q.question);
  if (existingTexts.has(norm)) {
    // Bir xil id va matn — allaqachon mavjud; boshqa id bilan bir xil matn — dublikat.
    skippedDup++;
    console.warn(`  o‘tkazildi (mavjud savol): ${q.id} — ${q.question.slice(0, 60)}`);
    continue;
  }
  const prefix = prefixFor(q.category, q);
  let id = q.id;
  if (existingIds.has(id) || idPrefix(id) !== prefix) {
    id = nextFreeId(prefix);
    reassigned++;
    console.log(`  id qayta berildi: ${q.id} → ${id}`);
  }
  const item: Question = { ...q, id };
  existingIds.add(id);
  existingTexts.add(norm);
  const list = fileData.get(q.category) ?? [];
  list.push(item);
  fileData.set(q.category, list);
  added[q.category] = (added[q.category] ?? 0) + 1;
}

for (const cat of Object.keys(added)) {
  const file = categoryFile(cat);
  writeQuestions(file, fileData.get(cat) ?? []);
}

const total = Object.values(added).reduce((a, b) => a + b, 0);
console.log("\nNatija:");
console.log(`  qo‘shildi:         ${total}`);
for (const [cat, n] of Object.entries(added)) console.log(`    ${cat}: +${n}`);
console.log(`  id qayta berildi:  ${reassigned}`);
console.log(`  dublikat (o‘tkazildi): ${skippedDup}`);
console.log(`  yaroqsiz qatorlar: ${errors.length}`);
console.log(`  status:            ${status === "verified" ? "verified" : "pending"}`);
if (total > 0 && Object.keys(added).some((c) => !fs.readFileSync(path.join(QUESTIONS_DIR, "index.ts"), "utf8").includes(`./${c}.json`))) {
  console.warn("  ! Yangi kategoriya fayli data/questions/index.ts da ro‘yxatdan o‘tkazilishi kerak.");
}
console.log("Keyingi qadam: npm run validate");
