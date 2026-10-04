import { Suspense } from "react";
import type { Metadata } from "next";
import { ResultView } from "@/components/ResultView";

export const metadata: Metadata = {
  title: "Natija",
};

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-muted">Yuklanmoqda…</p>}>
      <ResultView />
    </Suspense>
  );
}
