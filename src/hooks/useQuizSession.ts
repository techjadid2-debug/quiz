"use client";
import { useCallback, useEffect, useReducer } from "react";
import type { AnswerRecord, SessionQuestion, TimerSetting } from "@/lib/types";

export type QuizPhase = "answering" | "revealed" | "finished";

export interface QuizSessionState {
  index: number;               // joriy savol, 0 dan
  phase: QuizPhase;
  answers: AnswerRecord[];     // har bir javob berilgan savol uchun
  selected: number | null;     // joriy savolda tanlangan variant (revealed'da), null = vaqt tugagan
  timeLeft: number | null;     // soniya; timer=0 bo'lsa null
}

export interface UseQuizSession {
  state: QuizSessionState;
  current: SessionQuestion | undefined;
  total: number;
  isLast: boolean;
  /** Variant tanlash (faqat "answering" fazasida ishlaydi). */
  select: (optionIndex: number) => void;
  /** Keyingi savolga o'tish yoki oxirgisida "finished" ga o'tish. */
  next: () => void;
}

const TICK_MS = 250;
/** Vaqt manbai. Render paytidagi reset uchun ham ishlatiladi: natija faqat yangi savol boshlanish vaqti
 * sifatida saqlanadi, shuning uchun takroriy render zararsiz. */
const clock = () => Date.now();

interface InternalState extends QuizSessionState {
  questions: SessionQuestion[];
  timer: TimerSetting;
  /** Joriy savol ko'rsatilgan vaqt (ms, Date.now). */
  shownAt: number;
}

type Action =
  | { type: "select"; optionIndex: number; now: number }
  | { type: "timeout"; index: number; now: number }
  | { type: "tick"; index: number; timeLeft: number }
  | { type: "next"; now: number }
  | { type: "reset"; questions: SessionQuestion[]; timer: TimerSetting; now: number };

function initState(args: { questions: SessionQuestion[]; timer: TimerSetting; now: number }): InternalState {
  return {
    questions: args.questions,
    timer: args.timer,
    shownAt: args.now,
    index: 0,
    phase: args.questions.length === 0 ? "finished" : "answering",
    answers: [],
    selected: null,
    timeLeft: args.timer > 0 ? args.timer : null,
  };
}

function record(state: InternalState, selected: number | null, now: number): InternalState {
  const q = state.questions[state.index];
  // Bir savol uchun faqat bitta javob (StrictMode / ikki marta bosish himoyasi).
  if (!q || state.phase !== "answering" || state.answers.length !== state.index) return state;
  const answer: AnswerRecord = {
    questionId: q.id,
    selected,
    correct: selected !== null && selected === q.answer,
    timeMs: Math.max(0, now - state.shownAt),
  };
  return {
    ...state,
    phase: "revealed",
    selected,
    answers: [...state.answers, answer],
    timeLeft: selected === null ? 0 : state.timeLeft,
  };
}

export function quizReducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "select":
      if (action.optionIndex < 0 || action.optionIndex >= (state.questions[state.index]?.options.length ?? 0)) {
        return state;
      }
      return record(state, action.optionIndex, action.now);
    case "timeout":
      if (action.index !== state.index) return state;
      return record(state, null, action.now);
    case "tick":
      if (action.index !== state.index || state.phase !== "answering" || state.timeLeft === action.timeLeft) {
        return state;
      }
      return { ...state, timeLeft: action.timeLeft };
    case "next": {
      if (state.phase !== "revealed") return state;
      if (state.index >= state.questions.length - 1) return { ...state, phase: "finished" };
      return {
        ...state,
        index: state.index + 1,
        phase: "answering",
        selected: null,
        shownAt: action.now,
        timeLeft: state.timer > 0 ? state.timer : null,
      };
    }
    case "reset":
      return initState(action);
  }
}

/** Taymer tugasa avtomatik selected=null, correct=false bilan "revealed" ga o'tadi. */
export function useQuizSession(questions: SessionQuestion[], timer: TimerSetting): UseQuizSession {
  const [internal, dispatch] = useReducer(quizReducer, { questions, timer, now: 0 }, (a) =>
    initState({ ...a, now: clock() }),
  );

  // Savollar yoki taymer o'zgarsa — holatni qayta boshlash (render paytida, "prev props" namunasi).
  if (internal.questions !== questions || internal.timer !== timer) {
    dispatch({ type: "reset", questions, timer, now: clock() });
  }

  const { index, phase, shownAt } = internal;
  const timerActive = phase === "answering" && timer > 0 && internal.timer === timer;

  useEffect(() => {
    if (!timerActive) return;
    const deadline = shownAt + timer * 1000;
    const tick = () => {
      const now = Date.now();
      const msLeft = deadline - now;
      if (msLeft <= 0) {
        dispatch({ type: "timeout", index, now });
        return true;
      }
      dispatch({ type: "tick", index, timeLeft: Math.ceil(msLeft / 1000) });
      return false;
    };
    const id = window.setInterval(() => {
      if (tick()) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [timerActive, index, shownAt, timer]);

  const select = useCallback((optionIndex: number) => {
    dispatch({ type: "select", optionIndex, now: Date.now() });
  }, []);
  const next = useCallback(() => {
    dispatch({ type: "next", now: Date.now() });
  }, []);

  const state: QuizSessionState = {
    index: internal.index,
    phase: internal.phase,
    answers: internal.answers,
    selected: internal.selected,
    timeLeft: internal.timeLeft,
  };

  return {
    state,
    current: questions[internal.index],
    total: questions.length,
    isLast: internal.index >= questions.length - 1,
    select,
    next,
  };
}
