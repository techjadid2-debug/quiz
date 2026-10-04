import type { Metadata } from "next";
import { QuizView } from "@/components/QuizView";

export const metadata: Metadata = {
  title: "Mashg‘ulot",
};

export default function QuizPage() {
  return (
    <>
      <h1 className="sr-only">Mashg‘ulot</h1>
      <QuizView />
    </>
  );
}
