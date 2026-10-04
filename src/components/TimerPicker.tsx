"use client";

import type { TimerSetting } from "@/lib/types";
import { Segmented } from "./Segmented";

const OPTIONS: { value: TimerSetting; label: string }[] = [
  { value: 0, label: "O‘chiq" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
];

export function TimerPicker({
  value,
  onChange,
}: {
  value: TimerSetting;
  onChange: (v: TimerSetting) => void;
}) {
  return (
    <Segmented
      legend="Taymer"
      hint="har bir savolga"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
