import { createSessionFromIds } from "@/lib/session";
import { loadSettings, saveActiveSession } from "@/lib/storage";
import type { QuizSettings } from "@/lib/types";

/** Xato savollardan yangi mashg'ulot tuzib saqlaydi. Savol topilmasa false qaytaradi. */
export function startMistakesSession(ids: string[], settings: QuizSettings = loadSettings()): boolean {
  const questions = createSessionFromIds(ids);
  if (questions.length === 0) return false;
  saveActiveSession({ questions, settings, mode: "mistakes", startedAt: new Date().toISOString() });
  return true;
}
