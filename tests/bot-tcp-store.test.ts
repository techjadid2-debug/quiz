// Haqiqiy Redis'ga qarshi integratsion test: faqat TEST_REDIS_URL berilganda ishlaydi.
import { afterAll, describe, expect, it } from "vitest";
import IORedis from "ioredis";
import { TcpRedisStore } from "@/bot/store";
import type { SessionResult } from "@/lib/types";

const url = process.env.TEST_REDIS_URL;

describe.skipIf(!url)("TcpRedisStore", () => {
  const client = new IORedis(url ?? "", { lazyConnect: true });
  const store = new TcpRedisStore(client);
  afterAll(async () => {
    await client.flushdb();
    client.disconnect();
  });

  it("sozlamalar, sessiya va poll havolalari", async () => {
    await store.setSettings(1, { categories: ["logic"], difficulty: "hard", count: 5, timer: 15 });
    expect((await store.getSettings(1)).difficulty).toBe("hard");
    expect(await store.getSession(5)).toBeNull();
    await store.setPollRef("p1", { chatId: 5, index: 2 });
    expect(await store.getPollRef("p1")).toEqual({ chatId: 5, index: 2 });
    expect(await client.ttl("p:p1")).toBeGreaterThan(0);
  });

  it("natija tarix va xatolarni yangilaydi", async () => {
    const r = (answers: [string, boolean][]): SessionResult => ({
      id: "r", finishedAt: new Date().toISOString(),
      settings: { categories: [], difficulty: "mixed", count: 5, timer: 0 }, mode: "normal",
      questionIds: answers.map(([id]) => id),
      answers: answers.map(([questionId, correct]) => ({ questionId, selected: correct ? 0 : 1, correct, timeMs: 1 })),
      correctCount: 0, wrongCount: 0, score: 0, maxScore: 0, percent: 0,
    });
    await store.saveResult(7, r([["a", false], ["b", false], ["c", true]]));
    expect((await store.getMistakes(7)).sort()).toEqual(["a", "b"]);
    await store.saveResult(7, r([["a", true]]));
    expect(await store.getMistakes(7)).toEqual(["b"]);
    expect(await store.getHistory(7)).toHaveLength(2);
  });

  it("guruh reytingi", async () => {
    await store.addGroupScores(-100, { "11": { name: "Ali", score: 5, correct: 2 }, "22": { name: "Vali", score: 3, correct: 1 } });
    await store.addGroupScores(-100, { "22": { name: "Vali", score: 4, correct: 2 } });
    expect(await store.getGroupTop(-100, 10)).toEqual([
      { userId: "22", name: "Vali", score: 7 },
      { userId: "11", name: "Ali", score: 5 },
    ]);
  });
});
