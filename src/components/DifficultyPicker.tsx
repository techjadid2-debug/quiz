"use client";

import type { DifficultyFilter } from "@/lib/types";
import { Segmented } from "./Segmented";

const OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: "mixed", label: "Aralash" },
  { value: "easy", label: "Oson" },
  { value: "medium", label: "O‘rta" },
  { value: "hard", label: "Qiyin" },
];

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: DifficultyFilter;
  onChange: (v: DifficultyFilter) => void;
}) {
  return (
    <Segmented
      legend="Qiyinlik"
      hint="Oson 1, o‘rta 2, qiyin 3 ball"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
