"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { filterQuestions, getCategoryStats } from "@/lib/questions";
import { createSession } from "@/lib/session";
import {
  DEFAULT_SETTINGS,
  loadMistakes,
  loadSettings,
  saveActiveSession,
  saveSettings,
} from "@/lib/storage";
import type { QuizSettings } from "@/lib/types";
import { CategoryPicker } from "./CategoryPicker";
import { DifficultyPicker } from "./DifficultyPicker";
import { CountPicker } from "./CountPicker";
import { TimerPicker } from "./TimerPicker";
import { AlertIcon, ArrowRightIcon, RepeatIcon } from "./Icons";
import { buttonClass } from "./styles";
import { startMistakesSession } from "./startSession";
import { useIsClient } from "./useIsClient";

export function SetupForm() {
  const isClient = useIsClient();
  // Gidratsiyadan keyin qayta o'rnatiladi: localStorage'dagi sozlamalar lazy initializer orqali o'qiladi.
  return <SetupFormInner key={isClient ? "client" : "server"} hydrated={isClient} />;
}

function SetupFormInner({ hydrated }: { hydrated: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState<QuizSettings>(() =>
    hydrated ? loadSettings() : DEFAULT_SETTINGS,
  );
  const [mistakes] = useState<string[]>(() => (hydrated ? loadMistakes() : []));
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => getCategoryStats(), []);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, s] of Object.entries(stats)) {
      out[id] = settings.difficulty === "mixed" ? s.total : s.byDifficulty[settings.difficulty];
    }
    return out;
  }, [stats, settings.difficulty]);

  const available = useMemo(
    () => filterQuestions(settings.categories, settings.difficulty).length,
    [settings.categories, settings.difficulty],
  );

  const update = (patch: Partial<QuizSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    saveSettings(next);
  };

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const questions = createSession(settings);
    if (questions.length === 0) {
      setError("Tanlangan filtr bo‘yicha savol topilmadi.");
      return;
    }
    saveActiveSession({ questions, settings, mode: "normal", startedAt: new Date().toISOString() });
    router.push("/quiz");
  };

  const startMistakes = () => {
    if (startMistakesSession(mistakes, settings)) router.push("/quiz");
    else setError("Xato savollar bazada topilmadi.");
  };

  return (
    <form onSubmit={start} className="space-y-8" aria-describedby="available-count">
      <CategoryPicker
        value={settings.categories}
        onChange={(categories) => update({ categories })}
        counts={counts}
      />
      <DifficultyPicker value={settings.difficulty} onChange={(difficulty) => update({ difficulty })} />
      <div className="grid gap-8 sm:grid-cols-2">
        <CountPicker value={settings.count} onChange={(count) => update({ count })} />
        <TimerPicker value={settings.timer} onChange={(timer) => update({ timer })} />
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div aria-live="polite" id="available-count" className="space-y-3">
          <p className="text-sm text-muted">
            Mavjud savollar: <span className="font-semibold tabular-nums text-fg">{available}</span>
          </p>
          {available > 0 && available < settings.count ? (
            <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-fg">
              <AlertIcon className="mt-0.5 shrink-0 text-accent" size={18} />
              <span>
                Faqat {available} ta savol mavjud — mashg‘ulot {available} ta savol bilan boshlanadi.
              </span>
            </p>
          ) : null}
          {available === 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-fg">
              <AlertIcon className="mt-0.5 shrink-0 text-danger" size={18} />
              <span>Bu filtr bo‘yicha savol yo‘q. Boshqa kategoriya yoki qiyinlikni tanlang.</span>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={available === 0} className={buttonClass("primary", "sm:flex-1")}>
            Mashg‘ulotni boshlash
            <ArrowRightIcon size={18} />
          </button>
          {mistakes.length > 0 ? (
            <button type="button" onClick={startMistakes} className={buttonClass("secondary")}>
              <RepeatIcon size={18} />
              Xatolarimni takrorlash ({mistakes.length})
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
