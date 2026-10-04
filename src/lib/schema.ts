import { z } from "zod";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Oson",
  medium: "O‘rta",
  hard: "Qiyin",
};
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{3,}$/, "id formati: <kategoriya>-<raqam>, masalan geo-012"),
    question: z.string().trim().min(10),
    options: z.array(z.string().trim().min(1)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10),
    category: z.string().min(1),
    difficulty: z.enum(DIFFICULTIES),
    source: z.string().trim().min(3),
    status: z.enum(["verified", "pending"]),
    asOf: z.string().optional(),
  })
  .refine(
    (q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4,
    { message: "Variantlar takrorlanmasligi kerak", path: ["options"] },
  );

export type Question = z.infer<typeof QuestionSchema>;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Category {
  id: string;
  name: string;
  description: string;
}
