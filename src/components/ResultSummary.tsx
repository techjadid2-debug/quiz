import type { SessionResult } from "@/lib/types";
import { categoriesLabel, difficultyFilterLabel, formatDateTime } from "./format";

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? "text-fg"}`}>{value}</dd>
    </div>
  );
}

export function ResultSummary({ result }: { result: SessionResult }) {
  const total = result.questionIds.length;
  const verdict =
    result.percent >= 80 ? "A’lo natija" : result.percent >= 50 ? "Yaxshi, davom eting" : "Mashq qilishda davom eting";

  return (
    <section aria-labelledby="result-heading" className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          {result.mode === "mistakes" ? "Xatolar ustida ishlash" : categoriesLabel(result.settings.categories)} ·{" "}
          {difficultyFilterLabel(result.settings.difficulty)} · {formatDateTime(result.finishedAt)}
        </p>
        <h1 id="result-heading" className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-6xl font-semibold tracking-tight tabular-nums text-fg sm:text-7xl">
            {result.percent}%
          </span>
          <span className="text-base font-medium text-muted">{verdict}</span>
        </h1>
        <p className="mt-2 text-lg text-fg">
          <span className="font-semibold tabular-nums">
            {result.score} / {result.maxScore}
          </span>{" "}
          ball
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Savollar" value={total} />
        <Tile label="To‘g‘ri" value={result.correctCount} tone="text-success" />
        <Tile label="Noto‘g‘ri" value={result.wrongCount} tone="text-danger" />
      </dl>
    </section>
  );
}
