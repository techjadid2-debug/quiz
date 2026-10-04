import type { SessionQuestion } from "@/lib/types";
import { CheckIcon, ClockIcon, CrossIcon } from "./Icons";
import { SourceText } from "./SourceText";

/** selected: null = vaqt tugadi. */
export function Explanation({ question, selected }: { question: SessionQuestion; selected: number | null }) {
  const timedOut = selected === null;
  const correct = !timedOut && selected === question.answer;

  const { label, Icon, tone } = correct
    ? { label: "To‘g‘ri!", Icon: CheckIcon, tone: "text-success" }
    : timedOut
      ? { label: "Vaqt tugadi", Icon: ClockIcon, tone: "text-danger" }
      : { label: "Noto‘g‘ri", Icon: CrossIcon, tone: "text-danger" };

  return (
    <section aria-labelledby="explanation-title" className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h3 id="explanation-title" className={`flex items-center gap-2 text-base font-semibold ${tone}`}>
        <Icon size={18} strokeWidth={2.2} />
        {label}
      </h3>
      {!correct ? (
        <p className="mt-3 text-[15px] text-fg">
          <span className="text-muted">To‘g‘ri javob: </span>
          <span className="font-medium">{question.options[question.answer]}</span>
        </p>
      ) : null}
      <p className="mt-3 text-[15px] leading-relaxed text-fg">{question.explanation}</p>
      <p className="mt-4 text-sm text-muted">
        Manba: <SourceText source={question.source} />
        {question.asOf ? <span> · {question.asOf} holatiga</span> : null}
      </p>
    </section>
  );
}
