import { InlineKeyboard } from "grammy";
import { CATEGORIES } from "@/lib/categories";
import type { DifficultyFilter, QuizSettings } from "@/lib/types";
import { T, difficultyLabel, timerLabel } from "./texts";

/**
 * callback_data formatlari (hammasi < 64 bayt):
 *  m:quiz | m:set | m:stats | m:mis | m:help | m:menu   — menyu
 *  sc:<catId> | sc:*                                     — kategoriya almashtirish / hammasi
 *  sd:<difficulty> | sn:<count> | st:<timer> | s:ok      — sozlamalar
 *  nx:<sessionKey>:<index>                               — shaxsiy "Keyingi"
 *  gn:<sessionKey>:<index>                               — guruh "Keyingi savol"
 *  rw:<resultId>                                         — natijadagi xatolardan mashg'ulot
 */
export const CB = {
  quiz: "m:quiz",
  settings: "m:set",
  stats: "m:stats",
  mistakes: "m:mis",
  help: "m:help",
  menu: "m:menu",
  done: "s:ok",
} as const;

const CHECK = "✓ ";

export function mainMenu(mistakesCount: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("▶️ Mashg‘ulot", CB.quiz)
    .row()
    .text("⚙️ Sozlamalar", CB.settings)
    .text("📊 Natijalarim", CB.stats)
    .row()
    .text(`🔁 Xatolarim (${mistakesCount})`, CB.mistakes)
    .text("❓ Yordam", CB.help);
}

const DIFFS: DifficultyFilter[] = ["mixed", "easy", "medium", "hard"];
const COUNTS = [5, 10, 20] as const;
const TIMERS = [0, 15, 30] as const;

export function settingsKeyboard(s: QuizSettings): InlineKeyboard {
  const kb = new InlineKeyboard();
  const selected = new Set(s.categories);
  kb.text((selected.size === 0 ? CHECK : "") + "Hammasi", "sc:*").row();
  CATEGORIES.forEach((c, i) => {
    kb.text((selected.has(c.id) ? CHECK : "") + c.name, `sc:${c.id}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row();
  for (const d of DIFFS) kb.text((s.difficulty === d ? CHECK : "") + difficultyLabel(d), `sd:${d}`);
  kb.row();
  for (const n of COUNTS) kb.text((s.count === n ? CHECK : "") + `${n} ta`, `sn:${n}`);
  kb.row();
  for (const t of TIMERS) kb.text((s.timer === t ? CHECK : "") + "⏱ " + timerLabel(t), `st:${t}`);
  kb.row().text("✅ Tayyor", CB.done);
  return kb;
}

/** Sessiyani aniqlovchi qisqa kalit (eskirgan tugmalarni ajratish uchun). */
export function sessionKey(startedAt: string): string {
  const t = Date.parse(startedAt);
  return Number.isFinite(t) ? t.toString(36) : "0";
}

export function nextKeyboard(key: string, index: number): InlineKeyboard {
  return new InlineKeyboard().text(T.next, `nx:${key}:${index}`);
}

export function groupNextKeyboard(key: string, index: number, last: boolean): InlineKeyboard {
  return new InlineKeyboard().text(last ? T.finishGroupBtn : T.nextGroup, `gn:${key}:${index}`);
}

export function resultKeyboard(resultId: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (resultId) kb.text(T.fromMistakesBtn, `rw:${resultId}`);
  kb.text(T.againBtn, CB.quiz).row().text(T.menuBtn, CB.menu);
  return kb;
}

/** Sozlamalarni callback bo'yicha o'zgartiradi (sof funksiya). null — noma'lum callback. */
export function applySettingsCallback(s: QuizSettings, data: string): QuizSettings | null {
  const [kind, value] = [data.slice(0, 2), data.slice(3)];
  switch (kind) {
    case "sc": {
      if (value === "*") return { ...s, categories: [] };
      if (!CATEGORIES.some((c) => c.id === value)) return null;
      const set = new Set(s.categories);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      // Hammasi belgilangan bo'lsa — "Hammasi" (bo'sh massiv) sifatida saqlaymiz.
      const categories = set.size === CATEGORIES.length ? [] : CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
      return { ...s, categories };
    }
    case "sd":
      return (DIFFS as string[]).includes(value) ? { ...s, difficulty: value as DifficultyFilter } : null;
    case "sn": {
      const n = Number(value);
      return (COUNTS as readonly number[]).includes(n) ? { ...s, count: n as QuizSettings["count"] } : null;
    }
    case "st": {
      const t = Number(value);
      return (TIMERS as readonly number[]).includes(t) ? { ...s, timer: t as QuizSettings["timer"] } : null;
    }
    default:
      return null;
  }
}
