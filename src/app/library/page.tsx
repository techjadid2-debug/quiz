import type { Metadata } from "next";
import { LibraryManager } from "@/components/LibraryManager";
import { LibraryStats } from "@/components/LibraryStats";

export const metadata: Metadata = {
  title: "Savollar bazasi",
};

export default function LibraryPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Savollar bazasi</h1>
        <p className="mt-2 text-muted">
          Mashg‘ulotlar faqat manbasi tekshirilgan (tasdiqlangan) savollardan tuziladi.
        </p>
      </header>
      <LibraryStats />
      <LibraryManager />
    </div>
  );
}
