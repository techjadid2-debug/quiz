"use client";

import { useState } from "react";
import Link from "next/link";
import { loadActiveSession, type ActiveSession } from "@/lib/storage";
import { EmptyState } from "./EmptyState";
import { QuizRunner } from "./QuizRunner";
import { buttonClass } from "./styles";
import { useIsClient } from "./useIsClient";

export function QuizView() {
  const isClient = useIsClient();
  if (!isClient) {
    return <p className="py-16 text-center text-muted">Yuklanmoqda…</p>;
  }
  return <QuizLoader />;
}

function QuizLoader() {
  const [session] = useState<ActiveSession | null>(() => loadActiveSession());
  if (!session || session.questions.length === 0) {
    return (
      <EmptyState
        title="Faol mashg‘ulot yo‘q"
        description="Kategoriya va qiyinlikni tanlab, yangi mashg‘ulotni boshlang."
        action={
          <Link href="/" className={buttonClass("primary")}>
            Mashg‘ulotni boshlash
          </Link>
        }
      />
    );
  }
  if (session.resultId) {
    return (
      <EmptyState
        title="Bu mashg‘ulot yakunlangan"
        description="Natijani ko‘rishingiz yoki yangi mashg‘ulot boshlashingiz mumkin."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/result?id=${encodeURIComponent(session.resultId)}`} className={buttonClass("primary")}>
              Natijani ko‘rish
            </Link>
            <Link href="/" className={buttonClass("secondary")}>
              Yangi mashg‘ulot
            </Link>
          </div>
        }
      />
    );
  }
  return <QuizRunner session={session} />;
}
