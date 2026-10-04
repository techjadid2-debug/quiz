// CSV ustunlari: id,question,optionA,optionB,optionC,optionD,answer,explanation,category,difficulty,source,status,asOf
// answer CSV'da "A".."D" harfi; JSON'da 0..3 indeks.
import Papa from "papaparse";
import { QuestionSchema, type Question } from "./schema";

export interface ParseResult {
  valid: Question[];
  errors: { row: number; message: string }[];
}

export const CSV_COLUMNS = [
  "id",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "answer",
  "explanation",
  "category",
  "difficulty",
  "source",
  "status",
  "asOf",
] as const;
const REQUIRED_CSV_COLUMNS = CSV_COLUMNS.filter((c) => c !== "asOf" && c !== "status");
const LETTERS = ["A", "B", "C", "D"] as const;

export function answerToLetter(i: number): string {
  return LETTERS[i] ?? "";
}

export function letterToAnswer(s: string): number | null {
  const i = LETTERS.indexOf(s.trim().toUpperCase() as (typeof LETTERS)[number]);
  return i === -1 ? null : i;
}

function formatIssues(err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.map(String).join(".")}: ${i.message}` : i.message))
    .join("; ");
}

function validateRow(candidate: unknown, row: number, forcePending: boolean, result: ParseResult): void {
  let input = candidate;
  if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
    const c = { ...(candidate as Record<string, unknown>) };
    if (forcePending || c.status === undefined || c.status === "") c.status = "pending";
    if (c.asOf === "" || c.asOf === null) delete c.asOf;
    input = c;
  }
  const parsed = QuestionSchema.safeParse(input);
  if (parsed.success) result.valid.push(parsed.data);
  else result.errors.push({ row, message: `${row}-qator: ${formatIssues(parsed.error)}` });
}

function parseJSON(text: string, forcePending: boolean): ParseResult {
  const result: ParseResult = { valid: [], errors: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    result.errors.push({ row: 0, message: `JSON o‘qib bo‘lmadi: ${(e as Error).message}` });
    return result;
  }
  const list =
    Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && Array.isArray((data as { questions?: unknown }).questions)
        ? (data as { questions: unknown[] }).questions
        : null;
  if (!list) {
    result.errors.push({ row: 0, message: "JSON massiv yoki { \"questions\": [...] } ko‘rinishida bo‘lishi kerak" });
    return result;
  }
  list.forEach((item, i) => validateRow(item, i + 1, forcePending, result));
  return result;
}

function parseCSV(text: string, forcePending: boolean): ParseResult {
  const result: ParseResult = { valid: [], errors: [] };
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED_CSV_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length > 0) {
    result.errors.push({ row: 1, message: `1-qator (sarlavha): ustunlar yetishmayapti — ${missing.join(", ")}` });
    return result;
  }
  const rowErrors = new Map<number, string>();
  for (const e of parsed.errors) {
    if (typeof e.row === "number") rowErrors.set(e.row, e.message);
  }
  parsed.data.forEach((r, i) => {
    const row = i + 2; // 1-qator sarlavha
    const papaErr = rowErrors.get(i);
    if (papaErr) {
      result.errors.push({ row, message: `${row}-qator: CSV xatosi — ${papaErr}` });
      return;
    }
    const get = (k: string) => (r[k] ?? "").trim();
    const answer = letterToAnswer(get("answer"));
    if (answer === null) {
      result.errors.push({ row, message: `${row}-qator: answer A, B, C yoki D bo‘lishi kerak (berilgan: "${get("answer")}")` });
      return;
    }
    const candidate: Record<string, unknown> = {
      id: get("id"),
      question: get("question"),
      options: [get("optionA"), get("optionB"), get("optionC"), get("optionD")],
      answer,
      explanation: get("explanation"),
      category: get("category"),
      difficulty: get("difficulty"),
      source: get("source"),
      status: get("status"),
      asOf: get("asOf"),
    };
    validateRow(candidate, row, forcePending, result);
  });
  return result;
}

/** forcePending=true bo'lsa barcha savollar status "pending" ga o'tkaziladi. */
export function parseQuestions(text: string, format: "json" | "csv", opts?: { forcePending?: boolean }): ParseResult {
  const forcePending = opts?.forcePending ?? false;
  return format === "json" ? parseJSON(text, forcePending) : parseCSV(text, forcePending);
}

export function questionsToJSON(qs: Question[]): string {
  return JSON.stringify(qs, null, 2) + "\n";
}

export function questionsToCSV(qs: Question[]): string {
  const rows = qs.map((q) => [
    q.id,
    q.question,
    q.options[0],
    q.options[1],
    q.options[2],
    q.options[3],
    answerToLetter(q.answer),
    q.explanation,
    q.category,
    q.difficulty,
    q.source,
    q.status,
    q.asOf ?? "",
  ]);
  return Papa.unparse({ fields: [...CSV_COLUMNS], data: rows }, { newline: "\n" }) + "\n";
}

export function detectFormat(filename: string): "json" | "csv" | null {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  const ext = m?.[1].toLowerCase();
  return ext === "json" ? "json" : ext === "csv" ? "csv" : null;
}
