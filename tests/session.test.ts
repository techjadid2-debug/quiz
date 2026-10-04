import { describe, expect, it, vi } from "vitest";
import { makeQuestion, seededRng } from "./helpers";

const pool = [
  ...Array.from({ length: 12 }, (_, i) =>
    makeQuestion({ id: `geo-${String(i + 1).padStart(3, "0")}`, difficulty: i % 2 ? "easy" : "hard" }),
  ),
  ...Array.from({ length: 8 }, (_, i) =>
    makeQuestion({ id: `his-${String(i + 1).padStart(3, "0")}`, category: "history", difficulty: "medium" }),
  ),
  makeQuestion({ id: "his-999", category: "history", status: "pending" }),
];

vi.mock("../data/questions/index", () => ({ default: pool }));

const { shuffle, toSessionQuestion, createSession, createSessionFromIds } = await import("@/lib/session");
const { filterQuestions, getVerifiedQuestions, getCategoryStats } = await import("@/lib/questions");

describe("shuffle", () => {
  it("keeps all elements and does not mutate input", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const copy = [...input];
    const out = shuffle(input, seededRng(1));
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
    expect(out).not.toEqual(copy);
  });
  it("is deterministic with seeded rng", () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });
});

describe("toSessionQuestion", () => {
  it("keeps correct option text and valid optionOrder", () => {
    for (let seed = 0; seed < 30; seed++) {
      const q = makeQuestion({ id: "geo-001", answer: seed % 4 });
      const s = toSessionQuestion(q, seededRng(seed));
      expect(s.options[s.answer]).toBe(q.options[q.answer]);
      expect([...s.optionOrder].sort()).toEqual([0, 1, 2, 3]);
      s.optionOrder.forEach((orig, i) => expect(s.options[i]).toBe(q.options[orig]));
    }
  });
});

describe("questions", () => {
  it("only verified questions are used", () => {
    expect(getVerifiedQuestions().some((q) => q.status !== "verified")).toBe(false);
    expect(filterQuestions(["history"], "mixed")).toHaveLength(8);
    expect(getCategoryStats().geography.byDifficulty.hard).toBe(6);
  });
});

describe("createSession", () => {
  it("respects count, has no duplicates", () => {
    const s = createSession({ categories: [], difficulty: "mixed", count: 20, timer: 0 }, seededRng(3));
    expect(s).toHaveLength(20);
    expect(new Set(s.map((q) => q.id)).size).toBe(20);
    expect(s.some((q) => q.id === "his-999")).toBe(false);
  });
  it("respects filters and may return fewer than count", () => {
    const s = createSession({ categories: ["geography"], difficulty: "hard", count: 10, timer: 0 }, seededRng(4));
    expect(s).toHaveLength(6);
    expect(s.every((q) => q.category === "geography" && q.difficulty === "hard")).toBe(true);
    const h = createSession({ categories: ["history"], difficulty: "mixed", count: 5, timer: 0 }, seededRng(5));
    expect(h).toHaveLength(5);
    expect(h.every((q) => q.category === "history")).toBe(true);
  });
});

describe("createSessionFromIds", () => {
  it("dedupes and ignores unknown ids", () => {
    const s = createSessionFromIds(["geo-001", "geo-001", "nope-001", "his-002"], seededRng(1));
    expect(s.map((q) => q.id).sort()).toEqual(["geo-001", "his-002"]);
  });
});
