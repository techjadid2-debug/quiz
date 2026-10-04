import { DIFFICULTY_LABELS } from "@/lib/schema";
import { categoryName } from "@/lib/categories";
import type { DifficultyFilter, QuizSettings, SessionResult } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** "05.10.2026 14:30" — barcha brauzerlarda bir xil. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function difficultyFilterLabel(d: DifficultyFilter): string {
  return d === "mixed" ? "Aralash" : DIFFICULTY_LABELS[d];
}

export function categoriesLabel(ids: string[]): string {
  if (ids.length === 0) return "Barcha kategoriyalar";
  return ids.map(categoryName).join(", ");
}

export function sessionLabel(r: Pick<SessionResult, "mode"> & { settings: QuizSettings }): string {
  if (r.mode === "mistakes") return "Xatolar ustida ishlash";
  return categoriesLabel(r.settings.categories);
}
