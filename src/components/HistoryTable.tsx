import Link from "next/link";
import type { SessionResult } from "@/lib/types";
import { difficultyFilterLabel, formatDateTime, sessionLabel } from "./format";
import { ArrowRightIcon } from "./Icons";

export function HistoryTable({ history }: { history: SessionResult[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {history.map((r) => (
        <li key={r.id}>
          <Link
            href={`/result?id=${encodeURIComponent(r.id)}`}
            className="flex min-h-16 items-center gap-4 px-4 py-4 transition-colors hover:bg-surface sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-fg">{sessionLabel(r)}</p>
              <p className="mt-0.5 text-sm text-muted">
                <time dateTime={r.finishedAt}>{formatDateTime(r.finishedAt)}</time> ·{" "}
                {difficultyFilterLabel(r.settings.difficulty)} · {r.score}/{r.maxScore} ball
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums text-fg">{r.percent}%</span>
            <ArrowRightIcon size={18} className="shrink-0 text-muted" />
            <span className="sr-only">Natijani ochish</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
