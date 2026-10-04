"use client";

import { useId, useRef, useState } from "react";
import { categoryName } from "@/lib/categories";
import { detectFormat, parseQuestions, questionsToCSV, questionsToJSON, type ParseResult } from "@/lib/io";
import { getVerifiedQuestions } from "@/lib/questions";
import { DIFFICULTY_LABELS, type Question } from "@/lib/schema";
import { clearImported, loadImported, saveImported } from "@/lib/storage";
import { downloadText } from "./download";
import { ChevronDownIcon, DownloadIcon, InfoIcon, UploadIcon } from "./Icons";
import { buttonClass, cardClass } from "./styles";
import { useIsClient } from "./useIsClient";

const MAX_ERRORS_SHOWN = 30;

export function LibraryManager() {
  const isClient = useIsClient();
  if (!isClient) return <p className="py-8 text-center text-muted">Yuklanmoqda…</p>;
  return <LibraryManagerInner />;
}

function exportFile(qs: Question[], name: string, format: "json" | "csv") {
  if (format === "json") downloadText(`${name}.json`, questionsToJSON(qs), "application/json");
  else downloadText(`${name}.csv`, questionsToCSV(qs), "text/csv");
}

function LibraryManagerInner() {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<Question[]>(() => loadImported());
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reset = () => {
    setParsed(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setMessage(null);
    setParsed(null);
    if (!file) return;
    setFileName(file.name);
    const format = detectFormat(file.name);
    if (!format) {
      setMessage({ tone: "error", text: "Faqat .json yoki .csv fayllarni yuklash mumkin." });
      return;
    }
    try {
      const text = await file.text();
      setParsed(parseQuestions(text, format, { forcePending: true }));
    } catch {
      setMessage({ tone: "error", text: "Faylni o‘qib bo‘lmadi." });
    }
  };

  const save = () => {
    if (!parsed || parsed.valid.length === 0) return;
    const byId = new Map(imported.map((q) => [q.id, q]));
    for (const q of parsed.valid) byId.set(q.id, q);
    const merged = [...byId.values()];
    saveImported(merged);
    setImported(loadImported());
    setMessage({ tone: "ok", text: `${parsed.valid.length} ta savol “Tekshiruvda” holatida saqlandi.` });
    reset();
  };

  const clearAll = () => {
    if (!window.confirm("Import qilingan barcha savollar o‘chirilsinmi?")) return;
    clearImported();
    setImported(loadImported());
    setMessage(null);
  };

  return (
    <div className="space-y-10">
      {/* Import */}
      <section aria-labelledby="import-heading" className={`${cardClass} space-y-5`}>
        <div>
          <h2 id="import-heading" className="text-lg font-semibold text-fg">
            Savollarni import qilish
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            JSON yoki CSV fayldan savollar qo‘shing. Import qilingan savollar faqat shu brauzerda{" "}
            <strong className="font-medium text-fg">“Tekshiruvda”</strong> holatida saqlanadi va{" "}
            <strong className="font-medium text-fg">mashg‘ulotlarga kirmaydi</strong>. Savol mashg‘ulotda chiqishi
            uchun u ma’lumot fayllarida <code className="rounded bg-surface px-1 py-0.5 text-xs">status: &quot;verified&quot;</code>{" "}
            bilan tasdiqlanib, <code className="rounded bg-surface px-1 py-0.5 text-xs">npm run import</code> orqali
            qo‘shilishi kerak.
          </p>
        </div>

        <div>
          <label
            htmlFor={inputId}
            className={buttonClass(
              "secondary",
              "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            )}
          >
            <UploadIcon size={18} />
            {fileName ? "Boshqa fayl tanlash" : "Fayl tanlash (.json, .csv)"}
            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={onFile}
              className="sr-only"
            />
          </label>
          {fileName ? <p className="mt-2 text-sm text-muted">Tanlangan: {fileName}</p> : null}
        </div>

        <div aria-live="polite" className="space-y-4">
          {parsed ? (
            <div className="space-y-4">
              <p className="text-sm text-fg">
                Yaroqli savollar: <span className="font-semibold tabular-nums">{parsed.valid.length}</span>
                {parsed.errors.length > 0 ? (
                  <>
                    {" "}
                    · Xatoli qatorlar:{" "}
                    <span className="font-semibold tabular-nums text-danger">{parsed.errors.length}</span>
                  </>
                ) : null}
              </p>
              {parsed.errors.length > 0 ? (
                <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-danger-soft p-4 text-sm text-fg">
                  {parsed.errors.slice(0, MAX_ERRORS_SHOWN).map((err, i) => (
                    <li key={i}>
                      {/* message allaqachon "N-qator: ..." bilan boshlanadi (fayl darajasidagi xatolarda qatorsiz) */}
                      {err.message}
                    </li>
                  ))}
                  {parsed.errors.length > MAX_ERRORS_SHOWN ? (
                    <li className="text-muted">…yana {parsed.errors.length - MAX_ERRORS_SHOWN} ta xato</li>
                  ) : null}
                </ul>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={save}
                  disabled={parsed.valid.length === 0}
                  className={buttonClass("primary")}
                >
                  Saqlash
                </button>
                <button type="button" onClick={reset} className={buttonClass("ghost")}>
                  Bekor qilish
                </button>
              </div>
            </div>
          ) : null}
          {message ? (
            <p role={message.tone === "error" ? "alert" : undefined} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-success"}`}>
              {message.text}
            </p>
          ) : null}
        </div>

        <details className="group rounded-xl bg-surface px-4 py-3 text-sm">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-medium text-fg [&::-webkit-details-marker]:hidden">
            <InfoIcon size={18} className="text-muted" />
            CSV ustunlari formati
            <ChevronDownIcon size={16} className="ml-auto text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-2 text-muted">
            <p className="break-words font-mono text-xs text-fg">
              id,question,optionA,optionB,optionC,optionD,answer,explanation,category,difficulty,source,status,asOf
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code>id</code> — <code>&lt;kategoriya&gt;-&lt;raqam&gt;</code>, masalan <code>geo-012</code>
              </li>
              <li>
                <code>answer</code> — CSV’da harf (A–D), JSON’da indeks (0–3)
              </li>
              <li>
                <code>difficulty</code> — easy, medium yoki hard; <code>asOf</code> — ixtiyoriy
              </li>
            </ul>
          </div>
        </details>
      </section>

      {/* Imported pending list */}
      <section aria-labelledby="pending-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="pending-heading" className="text-lg font-semibold text-fg">
            Tekshiruvda <span className="font-normal text-muted">({imported.length})</span>
          </h2>
          {imported.length > 0 ? (
            <button type="button" onClick={clearAll} className={buttonClass("danger", "min-h-11 px-4 text-sm")}>
              Tozalash
            </button>
          ) : null}
        </div>
        {imported.length === 0 ? (
          <p className="text-sm text-muted">Import qilingan savollar yo‘q.</p>
        ) : (
          <details className="group rounded-xl border border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-fg [&::-webkit-details-marker]:hidden">
              Ro‘yxatni ko‘rsatish
              <ChevronDownIcon size={16} className="ml-auto text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {imported.map((q) => (
                <li key={q.id} className="px-4 py-3">
                  <p className="text-xs text-muted">
                    {q.id} · {categoryName(q.category)} · {DIFFICULTY_LABELS[q.difficulty]} ·{" "}
                    <span className="font-medium">Tekshiruvda</span>
                  </p>
                  <p className="mt-1 text-sm text-fg">{q.question}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Export */}
      <section aria-labelledby="export-heading" className="space-y-4">
        <h2 id="export-heading" className="text-lg font-semibold text-fg">
          Eksport
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportCard
            title="Tasdiqlangan baza"
            description="Mashg‘ulotlarda ishlatiladigan savollar."
            onExport={(f) => exportFile(getVerifiedQuestions(), "zakovat-verified", f)}
          />
          <ExportCard
            title="Tekshiruvdagi savollar"
            description="Shu brauzerga import qilingan savollar."
            disabled={imported.length === 0}
            onExport={(f) => exportFile(imported, "zakovat-pending", f)}
          />
        </div>
      </section>
    </div>
  );
}

function ExportCard({
  title,
  description,
  disabled,
  onExport,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  onExport: (format: "json" | "csv") => void;
}) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="text-[15px] font-medium text-fg">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExport("json")}
          className={buttonClass("secondary", "gap-1.5 whitespace-nowrap px-2 text-sm sm:px-3")}
        >
          <DownloadIcon size={16} className="shrink-0" />
          JSON eksport
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExport("csv")}
          className={buttonClass("secondary", "gap-1.5 whitespace-nowrap px-2 text-sm sm:px-3")}
        >
          <DownloadIcon size={16} className="shrink-0" />
          CSV eksport
        </button>
      </div>
    </div>
  );
}
