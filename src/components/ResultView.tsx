"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getResult, loadActiveSession } from "@/lib/storage";
import type { SessionQuestion, SessionResult } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { MistakeList } from "./MistakeList";
import { ResultSummary } from "./ResultSummary";
import { RepeatIcon } from "./Icons";
import { buttonClass } from "./styles";
import { startMistakesSession } from "./startSession";
import { useIsClient } from "./useIsClient";

/** useSearchParams ishlatadi — sahifada <Suspense> ichida render qiling. */
export function ResultView() {
  const id = useSearchParams().get("id");
  const isClient = useIsClient();
  if (!isClient) return <p className="py-16 text-center text-muted">Yuklanmoqda…</p>;
  return <ResultLoader key={id ?? ""} id={id} />;
}

/** Faol mashg'ulot shu natijaga tegishli bo'lsa (savol ID'lari tartibi bilan mos), savollar xaritasini qaytaradi. */
function matchSessionQuestions(result: SessionResult): Map<string, SessionQuestion> | null {
  const active = loadActiveSession();
  if (!active) return null;
  const ids = active.questions.map((q) => q.id);
  if (ids.length !== result.questionIds.length || ids.some((id, i) => id !== result.questionIds[i])) return null;
  return new Map(active.questions.map((q) => [q.id, q]));
}

function ResultLoader({ id }: { id: string | null }) {
  const router = useRouter();
  const [data] = useState(() => {
    const result = id ? getResult(id) : undefined;
    return { result, sessionQuestions: result ? matchSessionQuestions(result) : null };
  });
  const [error, setError] = useState<string | null>(null);

  const { result, sessionQuestions } = data;
  if (!result) {
    return (
      <EmptyState
        title="Natija topilmadi"
        description="Bu natija ushbu brauzerda saqlanmagan yoki tarix tozalangan."
        action={
          <>
            <Link href="/" className={buttonClass("primary")}>
              Yangi mashg‘ulot
            </Link>
            <Link href="/history" className={buttonClass("secondary")}>
              Tarix
            </Link>
          </>
        }
      />
    );
  }

  const correctIds = new Set(result.answers.filter((a) => a.correct).map((a) => a.questionId));
  const wrongIds = result.questionIds.filter((qid) => !correctIds.has(qid));

  const retryMistakes = () => {
    if (startMistakesSession(wrongIds, result.settings)) router.push("/quiz");
    else setError("Xato savollar bazada topilmadi.");
  };

  return (
    <div className="space-y-10">
      <ResultSummary result={result} />

      <div className="flex flex-col gap-3 sm:flex-row">
        {wrongIds.length > 0 ? (
          <button type="button" onClick={retryMistakes} className={buttonClass("primary", "sm:flex-1")}>
            <RepeatIcon size={18} />
            Faqat xatolardan yangi mashg‘ulot
          </button>
        ) : null}
        <Link
          href="/"
          className={buttonClass(wrongIds.length > 0 ? "secondary" : "primary", "sm:flex-1")}
        >
          Yangi mashg‘ulot
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <MistakeList result={result} sessionQuestions={sessionQuestions} />
    </div>
  );
}
