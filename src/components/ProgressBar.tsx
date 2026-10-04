export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const label = `Savol ${current} / ${total}`;
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-sm font-medium tabular-nums text-muted">
        Savol <span className="text-fg">{current}</span> / {total}
      </p>
      <div
        role="progressbar"
        aria-label="Mashg‘ulot jarayoni"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        className="h-1 w-full overflow-hidden rounded-full bg-surface"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
