"use client";

import { categoryName } from "@/lib/categories";
import { DIFFICULTY_LABELS } from "@/lib/schema";
import { pointsFor } from "@/lib/scoring";
import type { SessionQuestion } from "@/lib/types";
import { AnswerOption, type AnswerOptionState } from "./AnswerOption";

export function QuestionCard({
  question,
  revealed,
  selected,
  onSelect,
  headingRef,
}: {
  question: SessionQuestion;
  revealed: boolean;
  /** revealed bo'lsa — tanlangan indeks yoki null (vaqt tugadi). */
  selected: number | null;
  onSelect: (i: number) => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const points = pointsFor(question.difficulty);

  const stateFor = (i: number): AnswerOptionState => {
    if (!revealed) return "default";
    if (i === question.answer) return "correct";
    if (i === selected) return "wrong";
    return "dimmed";
  };

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-lg bg-surface px-2.5 py-1 text-muted">{categoryName(question.category)}</span>
        <span className="rounded-lg bg-surface px-2.5 py-1 text-muted">{DIFFICULTY_LABELS[question.difficulty]}</span>
        <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-accent">
          {points} ball
        </span>
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold leading-snug tracking-tight text-fg outline-none sm:text-2xl"
      >
        {question.question}
      </h2>
      <div role="group" aria-label="Javob variantlari" className="space-y-2.5">
        {question.options.map((opt, i) => (
          <AnswerOption
            key={i}
            index={i}
            text={opt}
            state={stateFor(i)}
            isSelected={revealed && selected === i}
            disabled={revealed}
            onSelect={() => onSelect(i)}
          />
        ))}
      </div>
    </article>
  );
}
