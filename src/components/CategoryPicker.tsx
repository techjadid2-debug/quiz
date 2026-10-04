"use client";

import { CATEGORIES } from "@/lib/categories";
import { CheckIcon } from "./Icons";

function Chip({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
        checked
          ? "border-accent bg-accent-soft text-fg"
          : "border-border bg-bg text-fg hover:bg-surface"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked ? "border-accent bg-accent text-accent-fg" : "border-border"
        }`}
      >
        {checked ? <CheckIcon size={14} strokeWidth={2.4} /> : null}
      </span>
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      {count !== undefined ? (
        <span className="tabular-nums text-muted">
          {count}
          <span className="sr-only"> ta savol</span>
        </span>
      ) : null}
    </label>
  );
}

/** value bo'sh massiv = barcha kategoriyalar ("Hammasi"). */
export function CategoryPicker({
  value,
  onChange,
  counts,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  counts: Record<string, number>;
}) {
  const all = value.length === 0;
  const total = CATEGORIES.reduce((s, c) => s + (counts[c.id] ?? 0), 0);

  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    // Hammasi tanlansa — "Hammasi" holatiga qaytaramiz
    onChange(next.length === CATEGORIES.length ? [] : next);
  };

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-fg">Kategoriyalar</legend>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <Chip checked={all} onChange={() => onChange([])} label="Hammasi" count={total} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            checked={value.includes(c.id)}
            onChange={() => toggle(c.id)}
            label={c.name}
            count={counts[c.id] ?? 0}
          />
        ))}
      </div>
    </fieldset>
  );
}
