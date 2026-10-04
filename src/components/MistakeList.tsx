import { categoryName } from "@/lib/categories";
import { getQuestionById } from "@/lib/questions";
import type { SessionQuestion, SessionResult } from "@/lib/types";
import { CheckIcon, CrossIcon } from "./Icons";
import { SourceText } from "./SourceText";

/**
 * Natijadagi xato savollar. sessionQuestions — shu natijaga tegishli mashg'ulot savollari
 * (aralashtirilgan variantlar bilan); bo'lmasa foydalanuvchi javobi matni "—" ko'rsatiladi.
 */
export function MistakeList({
  result,
  sessionQuestions,
}: {
  result: SessionResult;
  sessionQuestions: Map<string, SessionQuestion> | null;
}) {
  const answers = new Map(result.answers.map((a) => [a.questionId, a]));
  const wrongIds = result.questionIds.filter((id) => !answers.get(id)?.correct);

  if (wrongIds.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-fg">
        <CheckIcon className="text-success" size={18} />
        Barcha savollarga to‘g‘ri javob berdingiz.
      </p>
    );
  }

  return (
    <section aria-labelledby="mistakes-heading" className="space-y-4">
      <h2 id="mistakes-heading" className="text-lg font-semibold text-fg">
        Xatolar ustida ishlash <span className="font-normal text-muted">({wrongIds.length})</span>
      </h2>
      <ol className="space-y-3">
        {wrongIds.map((id, n) => {
          const q = getQuestionById(id);
          const a = answers.get(id);
          const sq = sessionQuestions?.get(id);

          let userAnswer: string;
          if (!a || a.selected === null) userAnswer = "Javob berilmadi";
          else if (sq && sq.options[a.selected] !== undefined) userAnswer = sq.options[a.selected];
          else userAnswer = "—";

          if (!q) {
            return (
              <li key={id} className="rounded-xl border border-border p-5 text-sm text-muted">
                {n + 1}. Savol ({id}) bazadan topilmadi.
              </li>
            );
          }

          return (
            <li key={id} className="rounded-xl border border-border bg-bg p-5 sm:p-6">
              <p className="text-xs font-medium text-muted">
                {n + 1}. {categoryName(q.category)}
              </p>
              <p className="mt-2 text-base font-medium leading-snug text-fg">{q.question}</p>
              <dl className="mt-4 space-y-2 text-[15px]">
                <div className="flex items-start gap-2">
                  <CrossIcon className="mt-0.5 shrink-0 text-danger" size={18} />
                  <div>
                    <dt className="text-xs font-medium text-muted">Sizning javobingiz</dt>
                    <dd className="text-fg">{userAnswer}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 shrink-0 text-success" size={18} />
                  <div>
                    <dt className="text-xs font-medium text-muted">To‘g‘ri javob</dt>
                    <dd className="font-medium text-fg">{q.options[q.answer]}</dd>
                  </div>
                </div>
              </dl>
              <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-fg">{q.explanation}</p>
              <p className="mt-2 text-xs text-muted">
                Manba: <SourceText source={q.source} />
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
