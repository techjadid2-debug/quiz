import { describe, expect, it } from "vitest";
import { quizReducer } from "@/hooks/useQuizSession";
import { toSessionQuestion } from "@/lib/session";
import { makeQuestion } from "./helpers";

const questions = [makeQuestion({ id: "geo-001" }), makeQuestion({ id: "geo-002" })].map((q) => toSessionQuestion(q));
type S = Parameters<typeof quizReducer>[0];
const start: S = quizReducer({} as S, { type: "reset", questions, timer: 15, now: 1000 });

describe("quizReducer", () => {
  it("records a single answer per question (double dispatch safe)", () => {
    let s = quizReducer(start, { type: "select", optionIndex: questions[0].answer, now: 3500 });
    s = quizReducer(s, { type: "select", optionIndex: 0, now: 4000 });
    s = quizReducer(s, { type: "timeout", index: 0, now: 20000 });
    expect(s.phase).toBe("revealed");
    expect(s.answers).toEqual([{ questionId: "geo-001", selected: questions[0].answer, correct: true, timeMs: 2500 }]);
  });

  it("timeout records null/false, next advances and finishes", () => {
    let s = quizReducer(start, { type: "timeout", index: 0, now: 16000 });
    expect(s.answers[0]).toMatchObject({ selected: null, correct: false, timeMs: 15000 });
    expect(s.timeLeft).toBe(0);
    s = quizReducer(s, { type: "next", now: 17000 });
    expect([s.index, s.phase, s.timeLeft, s.selected]).toEqual([1, "answering", 15, null]);
    expect(quizReducer(s, { type: "timeout", index: 0, now: 99999 })).toBe(s); // eski savol taymeri
    s = quizReducer(s, { type: "select", optionIndex: (questions[1].answer + 1) % 4, now: 18000 });
    expect(s.answers[1].correct).toBe(false);
    s = quizReducer(s, { type: "next", now: 19000 });
    expect(s.phase).toBe("finished");
  });
});
