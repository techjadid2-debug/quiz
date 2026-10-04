"use client";

import { useTheme } from "next-themes";
import { useIsClient } from "./useIsClient";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const ORDER = ["light", "dark", "system"] as const;
type ThemeName = (typeof ORDER)[number];

const LABELS: Record<ThemeName, string> = {
  light: "Yorug‘",
  dark: "Qorong‘i",
  system: "Tizim",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  const current: ThemeName = isClient && (ORDER as readonly string[]).includes(theme ?? "")
    ? (theme as ThemeName)
    : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? SunIcon : current === "dark" ? MoonIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Mavzu: ${LABELS[current]}. ${LABELS[next]} mavzuga o‘tish`}
      title={`Mavzu: ${LABELS[current]}`}
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-fg"
    >
      {/* Gidratsiyadan oldin bir xil belgi — mos kelmaslik bo'lmasligi uchun */}
      {isClient ? <Icon /> : <MonitorIcon />}
    </button>
  );
}
