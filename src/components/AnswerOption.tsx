"use client";

import { CheckIcon, CrossIcon } from "./Icons";

export type AnswerOptionState = "default" | "correct" | "wrong" | "dimmed";

const LETTERS = ["A", "B", "C", "D"];

export function AnswerOption({
  index,
  text,
  state,
  isSelected,
  disabled,
  onSelect,
}: {
  index: number;
  text: string;
  state: AnswerOptionState;
  /** Foydalanuvchi aynan shu variantni tanlaganmi (to'g'ri bo'lsa ham belgilanadi). */
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const letter = LETTERS[index] ?? String(index + 1);

  const tone =
    state === "correct"
      ? "border-success bg-success-soft text-fg"
      : state === "wrong"
        ? "border-danger bg-danger-soft text-fg"
        : state === "dimmed"
          ? "border-border bg-bg text-muted opacity-70"
          : "border-border bg-bg text-fg hover:border-fg/30 hover:bg-surface";

  const badgeTone =
    state === "correct"
      ? "border-success bg-success text-bg"
      : state === "wrong"
        ? "border-danger bg-danger text-bg"
        : "border-border text-muted";

  const statusLabel =
    state === "correct"
      ? isSelected
        ? "To‘g‘ri · Sizning javobingiz"
        : "To‘g‘ri javob"
      : state === "wrong"
        ? "Noto‘g‘ri · Sizning javobingiz"
        : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-keyshortcuts={`${index + 1} ${letter}`}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${badgeTone}`}
      >
        {state === "correct" ? (
          <CheckIcon size={16} strokeWidth={2.4} />
        ) : state === "wrong" ? (
          <CrossIcon size={16} strokeWidth={2.4} />
        ) : (
          letter
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{letter}. </span>
        <span className="block text-[15px] leading-snug sm:text-base">{text}</span>
        {statusLabel ? (
          <span
            className={`mt-1 block text-xs font-medium ${state === "correct" ? "text-success" : "text-danger"}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}
