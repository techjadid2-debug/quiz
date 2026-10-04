"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/hooks/useQuizSession";
import { computeResult } from "@/lib/scoring";
import { clearActiveSession, saveActiveSession, saveResult, type ActiveSession } from "@/lib/storage";
import type { AnswerRecord } from "@/lib/types";
import { QuestionCard } from "./QuestionCard";
import { ProgressBar } from "./ProgressBar";
import { TimerBadge } from "./TimerBadge";
import { Explanation } from "./Explanation";
import { ArrowRightIcon } from "./Icons";
import { buttonClass } from "./styles";

const KEY_TO_INDEX: Record<string, number> = {
  "1": 0, "2": 1, "3": 2, "4": 3,
  a: 0, b: 1, c: 2, d: 3,
};

export function QuizRunner({ session }: { session: ActiveSession }) {
  const router = useRouter();
  const { questions, settings, mode } = session;
  const { state, current, total, isLast, select, next } = useQuizSession(questions, settings.timer);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);

  const finish = useCallback(
    (answers: AnswerRecord[]) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      // Javob berilmagan savollar noto'g'ri hisoblanadi; maxScore barcha savollar bo'yicha.
      const byId = new Map(answers.map((a) => [a.questionId, a]));
      const full: AnswerRecord[] = questions.map(
        (q) => byId.get(q.id) ?? { questionId: q.id, selected: null, correct: false, timeMs: 0 },
      );
      const result = computeResult({ questions, answers: full, settings, mode });
      saveResult(result);
      // Faol mashg'ulot sessionStorage'da qoladi — natija sahifasi javob matnlarini shundan oladi.
      // resultId belgisi "Orqaga" bosilganda mashg'ulot qayta boshlanib ketishining oldini oladi.
      saveActiveSession({ ...session, resultId: result.id });
      router.replace(`/result?id=${encodeURIComponent(result.id)}`);
    },
    [questions, settings, mode, router, session],
  );

  // Oxirgi savoldan keyin natijani saqlash
  useEffect(() => {
    if (state.phase === "finished") finish(state.answers);
  }, [state.phase, state.answers, finish]);

  // Yangi savolda fokusni savol matniga o'tkazamiz (ekran o'quvchilar va mobil skroll uchun)
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.index]);

  // Javob ochilgach — "Keyingi" tugmasiga fokus
  useEffect(() => {
    if (state.phase === "revealed") nextRef.current?.focus();
  }, [state.phase]);

  // Klaviatura: 1–4 yoki A–D — tanlash; Enter / → — keyingi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

      if (state.phase === "answering") {
        const idx = KEY_TO_INDEX[e.key.toLowerCase()];
        if (idx !== undefined && current && idx < current.options.length) {
          e.preventDefault();
          select(idx);
        }
      } else if (state.phase === "revealed") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next();
        } else if (e.key === "Enter") {
          // Tugma/havola fokusda bo'lsa — brauzerning o'zi bosadi (ikki marta o'tmaslik uchun)
          if (target && (target.tagName === "BUTTON" || target.tagName === "A")) return;
          e.preventDefault();
          next();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, current, select, next]);

  const endEarly = () => {
    const ok = window.confirm(
      "Mashg‘ulotni tugatasizmi? Javob berilmagan savollar noto‘g‘ri deb hisoblanadi.",
    );
    if (!ok) return;
    if (state.answers.length === 0) {
      finishedRef.current = true;
      clearActiveSession();
      router.push("/");
      return;
    }
    finish(state.answers);
  };

  if (state.phase === "finished" || !current) {
    return (
      <p className="py-16 text-center text-muted" aria-live="polite">
        Natija hisoblanmoqda…
      </p>
    );
  }

  const revealed = state.phase === "revealed";

  return (
    <div className="space-y-8">
      <div className="flex items-end gap-4">
        <ProgressBar current={state.index + 1} total={total} />
        <TimerBadge timeLeft={state.timeLeft} />
      </div>

      {mode === "mistakes" ? (
        <p className="-mt-4 text-xs font-medium uppercase tracking-wide text-muted">Xatolar ustida ishlash</p>
      ) : null}

      <QuestionCard
        key={current.id}
        question={current}
        revealed={revealed}
        selected={state.selected}
        onSelect={select}
        headingRef={headingRef}
      />

      <div aria-live="polite">
        {revealed ? <Explanation question={current} selected={state.selected} /> : null}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={endEarly} className={buttonClass("ghost", "text-sm")}>
          Mashg‘ulotni tugatish
        </button>
        {revealed ? (
          <button ref={nextRef} type="button" onClick={next} className={buttonClass("primary", "sm:min-w-52")}>
            {isLast ? "Natijani ko‘rish" : "Keyingi savol"}
            <ArrowRightIcon size={18} />
          </button>
        ) : (
          <p className="hidden text-sm text-muted sm:block">
            Klaviatura: <kbd className="font-sans font-medium text-fg">1–4</kbd> yoki{" "}
            <kbd className="font-sans font-medium text-fg">A–D</kbd>
          </p>
        )}
      </div>
    </div>
  );
}
