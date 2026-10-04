import { CATEGORIES } from "@/lib/categories";
import { getCategoryStats } from "@/lib/questions";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/schema";

export function LibraryStats() {
  const stats = getCategoryStats();
  const rows = CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    total: stats[c.id]?.total ?? 0,
    by: DIFFICULTIES.map((d) => stats[c.id]?.byDifficulty[d] ?? 0),
  }));
  const totals = DIFFICULTIES.map((_, i) => rows.reduce((s, r) => s + r.by[i], 0));
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <section aria-labelledby="stats-heading" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="stats-heading" className="text-lg font-semibold text-fg">
          Tasdiqlangan savollar
        </h2>
        <p className="text-sm text-muted">
          Jami: <span className="font-semibold tabular-nums text-fg">{grand}</span>
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[320px] text-sm">
          <caption className="sr-only">Kategoriya va qiyinlik bo‘yicha tasdiqlangan savollar soni</caption>
          <thead className="bg-surface text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Kategoriya
              </th>
              {DIFFICULTIES.map((d) => (
                <th key={d} scope="col" className="px-2 py-3 text-right font-medium sm:px-4">
                  {DIFFICULTY_LABELS[d]}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Jami
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-4 py-3 text-left font-medium text-fg">
                  {r.name}
                  <span className="mt-0.5 hidden text-xs font-normal text-muted sm:block">{r.description}</span>
                </th>
                {r.by.map((n, i) => (
                  <td key={i} className={`px-2 py-3 text-right tabular-nums sm:px-4 ${n === 0 ? "text-muted" : "text-fg"}`}>
                    {n}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">{r.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-surface">
            <tr>
              <th scope="row" className="px-4 py-3 text-left font-semibold text-fg">
                Jami
              </th>
              {totals.map((n, i) => (
                <td key={i} className="px-2 py-3 text-right font-semibold tabular-nums text-fg sm:px-4">
                  {n}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">{grand}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
