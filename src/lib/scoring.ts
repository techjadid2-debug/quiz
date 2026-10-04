import { DIFFICULTY_POINTS, type Difficulty } from "./schema";
import type { AnswerRecord, QuizSettings, SessionQuestion, SessionResult } from "./types";

export function pointsFor(difficulty: Difficulty): number {
  return DIFFICULTY_POINTS[difficulty] ?? 0;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // randomUUID xavfsiz bo'lmagan kontekstda mavjud bo'lmasligi mumkin
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function computeResult(input: {
  questions: SessionQuestion[];
  answers: AnswerRecord[];
  settings: QuizSettings;
  mode: SessionResult["mode"];
  finishedAt?: Date;
}): SessionResult {
  const { questions, answers, settings, mode } = input;
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  let correctCount = 0;
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const pts = pointsFor(q.difficulty);
    maxScore += pts;
    if (byId.get(q.id)?.correct) {
      correctCount += 1;
      score += pts;
    }
  }
  const total = questions.length;
  return {
    id: newId(),
    finishedAt: (input.finishedAt ?? new Date()).toISOString(),
    settings,
    mode,
    questionIds: questions.map((q) => q.id),
    answers,
    correctCount,
    wrongCount: total - correctCount,
    score,
    maxScore,
    percent: total === 0 ? 0 : Math.round((correctCount / total) * 100),
  };
}
