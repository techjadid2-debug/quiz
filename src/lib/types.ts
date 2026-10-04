import type { Difficulty, Question } from "./schema";

export type DifficultyFilter = Difficulty | "mixed";
export type QuestionCount = 5 | 10 | 20;
export type TimerSetting = 0 | 15 | 30; // 0 = o'chirilgan

export interface QuizSettings {
  categories: string[]; // bo'sh massiv = barcha kategoriyalar
  difficulty: DifficultyFilter;
  count: QuestionCount;
  timer: TimerSetting;
}

/** Mashg'ulot uchun tayyorlangan savol: variantlar aralashtirilgan, answer yangi indeksga moslangan. */
export interface SessionQuestion extends Question {
  /** Asl savoldagi variant indekslari, aralashtirilgan tartibda. */
  optionOrder: number[];
}

export interface AnswerRecord {
  questionId: string;
  /** Tanlangan variant indeksi (SessionQuestion.options bo'yicha); null = vaqt tugadi. */
  selected: number | null;
  correct: boolean;
  timeMs: number;
}

export interface SessionResult {
  id: string;
  finishedAt: string; // ISO
  settings: QuizSettings;
  mode: "normal" | "mistakes";
  questionIds: string[];
  answers: AnswerRecord[];
  correctCount: number;
  wrongCount: number;
  score: number;
  maxScore: number;
  percent: number; // 0-100, butun son
}
