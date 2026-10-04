import { ClockIcon } from "./Icons";

/** timeLeft null bo'lsa (taymer o'chiq) hech narsa ko'rsatilmaydi. */
export function TimerBadge({ timeLeft }: { timeLeft: number | null }) {
  if (timeLeft === null) return null;
  const urgent = timeLeft <= 5;
  return (
    <div
      role="timer"
      aria-label={`Qolgan vaqt: ${timeLeft} soniya`}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold tabular-nums transition-colors ${
        urgent ? "border-danger bg-danger-soft text-danger" : "border-border bg-bg text-fg"
      }`}
    >
      <ClockIcon size={16} />
      <span aria-hidden="true">{timeLeft} s</span>
    </div>
  );
}
