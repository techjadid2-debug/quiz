import type { Metadata } from "next";
import { HistoryView } from "@/components/HistoryView";

export const metadata: Metadata = {
  title: "Tarix",
};

export default function HistoryPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Tarix</h1>
        <p className="mt-2 text-muted">Natijalar faqat shu brauzerda saqlanadi.</p>
      </header>
      <HistoryView />
    </div>
  );
}
