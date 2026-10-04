"use client";

import type { QuestionCount } from "@/lib/types";
import { Segmented } from "./Segmented";

const OPTIONS: { value: QuestionCount; label: string }[] = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 20, label: "20" },
];

export function CountPicker({
  value,
  onChange,
}: {
  value: QuestionCount;
  onChange: (v: QuestionCount) => void;
}) {
  return <Segmented legend="Savollar soni" options={OPTIONS} value={value} onChange={onChange} />;
}
