import { describe, expect, it } from "vitest";
import { detectFormat, parseQuestions, questionsToCSV, questionsToJSON } from "@/lib/io";
import { makeQuestion } from "./helpers";

const qs = [
  makeQuestion({ id: "geo-001", answer: 0 }),
  makeQuestion({
    id: "geo-002",
    question: 'Vergul, "qo‘shtirnoq" va\nyangi qatorli savol?',
    options: ["A, b", 'Say "hi"', "Uch", "To‘rt"],
    answer: 3,
    asOf: "2025-01",
    status: "pending",
    difficulty: "hard",
  }),
];

describe("io", () => {
  it("CSV round-trip", () => {
    const csv = questionsToCSV(qs);
    expect(csv.split("\n")[0]).toBe(
      "id,question,optionA,optionB,optionC,optionD,answer,explanation,category,difficulty,source,status,asOf",
    );
    const r = parseQuestions(csv, "csv");
    expect(r.errors).toEqual([]);
    expect(r.valid).toEqual(qs);
  });

  it("JSON round-trip, accepts {questions}", () => {
    expect(parseQuestions(questionsToJSON(qs), "json").valid).toEqual(qs);
    expect(parseQuestions(JSON.stringify({ questions: qs }), "json").valid).toHaveLength(2);
  });

  it("forcePending", () => {
    const r = parseQuestions(questionsToCSV(qs), "csv", { forcePending: true });
    expect(r.valid.every((q) => q.status === "pending")).toBe(true);
  });

  it("collects row-numbered errors", () => {
    const csv = questionsToCSV(qs)
      .replace(",A,", ",Z,") // 2-qator: noto'g'ri harf
      .replace("geo-002", "BAD ID"); // 3-qator: id formati
    const r = parseQuestions(csv, "csv");
    expect(r.valid).toHaveLength(0);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(r.errors[0].message).toMatch(/^2-qator: answer/);
    expect(r.errors[1].message).toMatch(/id/);
  });

  it("reports missing columns, bad JSON, wrong shape", () => {
    expect(parseQuestions("id,question\nx,y", "csv").errors[0].row).toBe(1);
    expect(parseQuestions("{oops", "json").errors).toHaveLength(1);
    expect(parseQuestions('{"a":1}', "json").errors).toHaveLength(1);
    const r = parseQuestions(JSON.stringify([qs[0], { id: "x" }]), "json");
    expect(r.valid).toHaveLength(1);
    expect(r.errors[0].row).toBe(2);
  });

  it("detectFormat", () => {
    expect(detectFormat("a.CSV")).toBe("csv");
    expect(detectFormat("dir/b.json")).toBe("json");
    expect(detectFormat("c.txt")).toBeNull();
    expect(detectFormat("csv")).toBeNull();
  });
});
