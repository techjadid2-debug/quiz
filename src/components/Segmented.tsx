"use client";

import { useId } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

/** Native radio guruhi (strelkalar bilan boshqariladi), segment ko'rinishida. */
export function Segmented<T extends string | number>({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-fg">
        {legend}
        {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
      </legend>
      <div
        className="grid gap-1 rounded-xl border border-border bg-surface p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                checked ? "bg-bg text-fg shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
