import { beforeEach, describe, expect, it } from "vitest";
import type { SessionResult } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  STORAGE_KEYS,
  loadActiveSession,
  loadHistory,
  loadImported,
  loadMistakes,
  loadSettings,
  saveImported,
  saveResult,
  saveSettings,
} from "@/lib/storage";
import { MemoryStorage, makeQuestion } from "./helpers";

const g = globalThis as unknown as { window?: { localStorage: Storage; sessionStorage: Storage } };

function result(id: string, answers: [string, boolean][]): SessionResult {
  return {
    id,
    finishedAt: new Date().toISOString(),
    settings: DEFAULT_SETTINGS,
    mode: "normal",
    questionIds: answers.map(([q]) => q),
    answers: answers.map(([questionId, correct]) => ({ questionId, correct, selected: correct ? 0 : 1, timeMs: 1 })),
    correctCount: answers.filter(([, c]) => c).length,
    wrongCount: answers.filter(([, c]) => !c).length,
    score: 0,
    maxScore: 0,
    percent: 0,
  };
}

beforeEach(() => {
  g.window = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
});

describe("storage", () => {
  it("SSR-safe without window", () => {
    delete g.window;
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadHistory()).toEqual([]);
    expect(() => saveResult(result("a", [["geo-001", false]]))).not.toThrow();
  });

  it("updates mistakes: add wrong, remove correct, unique", () => {
    saveResult(result("r1", [["geo-001", false], ["geo-002", false], ["geo-003", true]]));
    expect(loadMistakes()).toEqual(["geo-001", "geo-002"]);
    saveResult(result("r2", [["geo-001", true], ["geo-002", false], ["geo-004", false]]));
    expect(loadMistakes()).toEqual(["geo-002", "geo-004"]);
    const h = loadHistory();
    expect(h.map((r) => r.id)).toEqual(["r2", "r1"]);
  });

  it("caps history", () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) saveResult(result(`r${i}`, []));
    const h = loadHistory();
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[0].id).toBe(`r${HISTORY_LIMIT + 4}`);
  });

  it("tolerates corrupt data", () => {
    const ls = g.window!.localStorage;
    ls.setItem(STORAGE_KEYS.settings, "{not json");
    ls.setItem(STORAGE_KEYS.history, '{"x":1}');
    ls.setItem(STORAGE_KEYS.mistakes, '[1,"geo-001",null,"geo-001"]');
    ls.setItem(STORAGE_KEYS.imported, '"str"');
    g.window!.sessionStorage.setItem(STORAGE_KEYS.active, "[]");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadHistory()).toEqual([]);
    expect(loadMistakes()).toEqual(["geo-001"]);
    expect(loadImported()).toEqual([]);
    expect(loadActiveSession()).toBeNull();

    ls.setItem(STORAGE_KEYS.settings, JSON.stringify({ count: 999, difficulty: "hard", timer: 15, categories: ["a", 5] }));
    expect(loadSettings()).toEqual({ categories: ["a"], difficulty: "hard", count: 10, timer: 15 });
  });

  it("settings round-trip and storage exceptions are swallowed", () => {
    saveSettings({ categories: ["space"], difficulty: "easy", count: 5, timer: 30 });
    expect(loadSettings()).toEqual({ categories: ["space"], difficulty: "easy", count: 5, timer: 30 });
    const broken = new MemoryStorage();
    broken.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    g.window!.localStorage = broken;
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });

  it("imported questions are always pending", () => {
    saveImported([makeQuestion({ id: "geo-001", status: "verified" })]);
    expect(loadImported()[0].status).toBe("pending");
  });
});
