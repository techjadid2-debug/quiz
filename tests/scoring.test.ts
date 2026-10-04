import { describe, expect, it } from "vitest";
import { computeResult, pointsFor } from "@/lib/scoring";
import { toSessionQuestion } from "@/lib/session";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { makeQuestion } from "./helpers";

describe("scoring", () => {
  it("points per difficulty", () => {
    expect([pointsFor("easy"), pointsFor("medium"), pointsFor("hard")]).toEqual([1, 2, 3]);
  });

  it("computes result numbers", () => {
    const qs = [
      makeQuestion({ id: "geo-001", difficulty: "easy" }),
      makeQuestion({ id: "geo-002", difficulty: "medium" }),
      makeQuestion({ id: "geo-003", difficulty: "hard" }),
    ].map((q) => toSessionQuestion(q));
    const r = computeResult({
      questions: qs,
      answers: [
        { questionId: "geo-001", selected: qs[0].answer, correct: true, timeMs: 1000 },
        { questionId: "geo-002", selected: null, correct: false, timeMs: 15000 },
        { questionId: "geo-003", selected: qs[2].answer, correct: true, timeMs: 2000 },
      ],
      settings: DEFAULT_SETTINGS,
      mode: "normal",
      finishedAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(r).toMatchObject({
      correctCount: 2,
      wrongCount: 1,
      score: 4,
      maxScore: 6,
      percent: 67,
      finishedAt: "2026-01-01T00:00:00.000Z",
      questionIds: ["geo-001", "geo-002", "geo-003"],
    });
    expect(r.id).toBeTruthy();
  });

  it("unanswered counts as wrong; empty session is 0%", () => {
    const qs = [makeQuestion({ id: "geo-001" }), makeQuestion({ id: "geo-002" })].map((q) => toSessionQuestion(q));
    const r = computeResult({ questions: qs, answers: [], settings: DEFAULT_SETTINGS, mode: "mistakes" });
    expect([r.correctCount, r.wrongCount, r.percent]).toEqual([0, 2, 0]);
    const e = computeResult({ questions: [], answers: [], settings: DEFAULT_SETTINGS, mode: "normal" });
    expect([e.percent, e.maxScore]).toEqual([0, 0]);
  });
});
