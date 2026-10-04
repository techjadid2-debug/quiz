"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { getQuestionById } from "@/lib/questions";
import { clearHistory, loadHistory, loadMistakes } from "@/lib/storage";
import type { SessionResult } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { HistoryTable } from "./HistoryTable";
import { RepeatIcon } from "./Icons";
import { buttonClass } from "./styles";
import { startMistakesSession } from "./startSession";
import { useIsClient } from "./useIsClient";

export function HistoryView() {
  const isClient = useIsClient();
  if (!isClient) return <p className="py-16 text-center text-muted">Yuklanmoqda…</p>;
  return <HistoryContent />;
}

function categoryAccuracy(history: SessionResult[]) {
  const acc = new Map<string, { correct: number; total: number }>();
  for (const r of history) {
    for (const a of r.answers) {
      const q = getQuestionById(a.questionId);
      if (!q) continue;
      const e = acc.get(q.category) ?? { correct: 0, total: 0 };
      e.total += 1;
      if (a.correct) e.correct += 1;
      acc.set(q.category, e);
    }
  }
  return CATEGORIES.filter((c) => acc.has(c.id)).map((c) => {
    const e = acc.get(c.id)!;
    return { id: c.id, name: c.name, ...e, percent: Math.round((e.correct / e.total) * 100) };
  });
}

function HistoryContent() {
  const router = useRouter();
  const [history, setHistory] = useState<SessionResult[]>(() => loadHistory());
  const [mistakes, setMistakes] = useState<string[]>(() => loadMistakes());
  const [error, setError] = useState<string | null>(null);

  const perCategory = useMemo(() => categoryAccuracy(history), [history]);
  const avg = history.length
    ? Math.round(history.reduce((s, r) => s + r.percent, 0) / history.length)
    : 0;

  const retryAll = () => {
    if (startMistakesSession(mistakes)) router.push("/quiz");
    else setError("Xato savollar bazada topilmadi.");
  };

  const clear = () => {
    if (!window.confirm("Butun tarix o‘chirilsinmi? Bu amalni ortga qaytarib bo‘lmaydi.")) return;
    clearHistory();
    setHistory(loadHistory());
    setMistakes(loadMistakes());
  };

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Hali mashg‘ulot o‘tkazilmagan"
          description="Birinchi mashg‘ulotni yakunlaganingizdan so‘ng natijalar shu yerda ko‘rinadi."
          action={
            <Link href="/" className={buttonClass("primary")}>
              Mashg‘ulotni boshlash
            </Link>
          }
        />
        {mistakes.length > 0 ? (
          <button type="button" onClick={retryAll} className={buttonClass("secondary", "w-full")}>
            <RepeatIcon size={18} />
            Barcha xatolarni takrorlash ({mistakes.length})
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border p-4">
          <dt className="text-xs font-medium text-muted">Mashg‘ulotlar</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-fg">{history.length}</dd>
        </div>
        <div className="rounded-xl border border-border p-4">
          <dt className="text-xs font-medium text-muted">O‘rtacha natija</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-fg">{avg}%</dd>
        </div>
      </dl>

      {perCategory.length > 0 ? (
        <section aria-labelledby="cat-acc" className="space-y-4">
          <h2 id="cat-acc" className="text-lg font-semibold text-fg">
            Kategoriyalar bo‘yicha aniqlik
          </h2>
          <ul className="space-y-3">
            {perCategory.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-fg">{c.name}</span>
                  <span className="tabular-nums text-muted">
                    {c.correct}/{c.total} · <span className="font-medium text-fg">{c.percent}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${c.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="sessions" className="space-y-4">
        <h2 id="sessions" className="text-lg font-semibold text-fg">
          Mashg‘ulotlar
        </h2>
        {mistakes.length > 0 ? (
          <button type="button" onClick={retryAll} className={buttonClass("primary", "w-full")}>
            <RepeatIcon size={18} />
            Barcha xatolarni takrorlash ({mistakes.length})
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <HistoryTable history={history} />
      </section>

      <div className="border-t border-border pt-6">
        <button type="button" onClick={clear} className={buttonClass("danger")}>
          Tarixni tozalash
        </button>
      </div>
    </div>
  );
}
