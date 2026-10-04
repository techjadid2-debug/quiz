import { beforeEach, describe, expect, it } from "vitest";
import type { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { createBot, handleUpdateSafe } from "@/bot/bot";
import { applySettingsCallback } from "@/bot/keyboards";
import { pollQuestionText } from "@/bot/poll";
import { MemoryStore, type BotSession } from "@/bot/store";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { pointsFor } from "@/lib/scoring";
import { toSessionQuestion } from "@/lib/session";
import { POST, GET } from "@/app/api/telegram/route";
import { makeQuestion } from "./helpers";

type Call = { method: string; payload: Record<string, unknown> };

const BOT_INFO = {
  id: 999,
  is_bot: true,
  first_name: "Zakovat",
  username: "fibotbook_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as unknown as UserFromGetMe;

const USER = { id: 111, is_bot: false, first_name: "Ali" };
const USER2 = { id: 222, is_bot: false, first_name: "Vali" };
const ADMIN = { id: 333, is_bot: false, first_name: "Admin" };
const GROUP = { id: -1001, type: "supergroup" as const, title: "Zakovat klubi" };
const PRIVATE = { id: USER.id, type: "private" as const, first_name: "Ali" };

interface Harness {
  bot: Bot;
  store: MemoryStore;
  calls: Call[];
  send: (u: Omit<Update, "update_id">) => Promise<void>;
  polls: () => Call[];
  last: (method: string) => Call | undefined;
}

function setup(): Harness {
  const store = new MemoryStore();
  const bot = createBot(store, "123:TEST", BOT_INFO);
  const calls: Call[] = [];
  let msgId = 1000;
  let pollSeq = 0;
  bot.api.config.use(async (_prev, method, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    calls.push({ method, payload: p });
    const chat = { id: p.chat_id, type: Number(p.chat_id) < 0 ? "supergroup" : "private" };
    let result: unknown = true;
    if (method === "sendPoll") {
      result = {
        message_id: ++msgId,
        date: 0,
        chat,
        poll: { id: `poll-${++pollSeq}`, question: p.question, options: [], type: "quiz", is_closed: false },
      };
    } else if (method === "sendMessage") {
      result = { message_id: ++msgId, date: 0, chat, text: p.text };
    } else if (method === "getChatMember") {
      result = { status: p.user_id === ADMIN.id ? "administrator" : "member", user: { id: p.user_id, is_bot: false, first_name: "x" } };
    } else if (method === "stopPoll") {
      result = { id: "x", question: "", options: [], is_closed: true };
    }
    return { ok: true, result } as never;
  });
  let updateId = 0;
  const send = (u: Omit<Update, "update_id">) => handleUpdateSafe(bot, { update_id: ++updateId, ...u } as Update);
  return {
    bot,
    store,
    calls,
    send,
    polls: () => calls.filter((c) => c.method === "sendPoll"),
    last: (m) => calls.filter((c) => c.method === m).at(-1),
  };
}

let msgSeq = 1;
function cmd(text: string, from = USER, chat: object = PRIVATE): Omit<Update, "update_id"> {
  const len = text.split(" ")[0].length;
  return {
    message: {
      message_id: msgSeq++,
      date: 0,
      chat,
      from,
      text,
      entities: [{ type: "bot_command", offset: 0, length: len }],
    },
  } as never;
}

let cbSeq = 1;
function cb(data: string, from = USER, chat: object = PRIVATE): Omit<Update, "update_id"> {
  return {
    callback_query: {
      id: `cb-${cbSeq++}`,
      from,
      chat_instance: "ci",
      data,
      message: { message_id: 1, date: 0, chat, text: "x" },
    },
  } as never;
}

function answer(pollId: string, option: number, user = USER): Omit<Update, "update_id"> {
  return { poll_answer: { poll_id: pollId, user, option_ids: [option], option_persistent_ids: [] } } as never;
}

const pollId = (i: number) => `poll-${i + 1}`;
const correctOf = (c: Call) => (c.payload.correct_option_ids as number[])[0];
const markupData = (c: Call) =>
  ((c.payload.reply_markup as { inline_keyboard: { text: string; callback_data: string }[][] }).inline_keyboard ?? []).flat();

describe("bot: shaxsiy chat", () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it("/start menyuni ko‘rsatadi", async () => {
    await h.send(cmd("/start"));
    const m = h.last("sendMessage")!;
    expect(m.payload.text).toContain("Ali");
    const buttons = markupData(m).map((b) => b.callback_data);
    expect(buttons).toEqual(expect.arrayContaining(["m:quiz", "m:set", "m:stats", "m:mis", "m:help"]));
    expect(markupData(m).find((b) => b.callback_data === "m:mis")!.text).toContain("(0)");
  });

  it("sozlamalar o‘zgaradi va saqlanadi (o‘sha xabar tahrirlanadi)", async () => {
    await h.send(cmd("/settings"));
    await h.send(cb("sc:geography"));
    await h.send(cb("sc:history"));
    await h.send(cb("sd:hard"));
    await h.send(cb("sn:5"));
    await h.send(cb("st:15"));
    const s = await h.store.getSettings(USER.id);
    expect(s).toEqual({ categories: ["history", "geography"], difficulty: "hard", count: 5, timer: 15 });
    expect(h.calls.filter((c) => c.method === "editMessageText")).toHaveLength(5);
    const kb = markupData(h.last("editMessageText")!);
    expect(kb.find((b) => b.callback_data === "sc:geography")!.text.startsWith("✓")).toBe(true);
    expect(kb.find((b) => b.callback_data === "sc:*")!.text.startsWith("✓")).toBe(false);
    for (const b of kb) expect(Buffer.byteLength(b.callback_data)).toBeLessThan(64);

    await h.send(cb("sc:*"));
    expect((await h.store.getSettings(USER.id)).categories).toEqual([]);
  });

  it("applySettingsCallback: noma’lum qiymatlar rad etiladi", () => {
    expect(applySettingsCallback(DEFAULT_SETTINGS, "sn:7")).toBeNull();
    expect(applySettingsCallback(DEFAULT_SETTINGS, "sc:nope")).toBeNull();
    expect(applySettingsCallback({ ...DEFAULT_SETTINGS, categories: ["art"] }, "sc:art")?.categories).toEqual([]);
  });

  it("to‘liq mashg‘ulot: poll → javob → keyingi → yakuniy natija", async () => {
    await h.store.setSettings(USER.id, { ...DEFAULT_SETTINGS, count: 5, timer: 15 });
    await h.send(cmd("/quiz"));
    expect(h.polls()).toHaveLength(1);
    const first = h.polls()[0].payload;
    expect(first.type).toBe("quiz");
    expect(first.is_anonymous).toBe(false);
    expect(first.open_period).toBe(15);
    expect(String(first.question)).toMatch(/^1\/5 · .+ · .+ · \d ball\n\n/);
    expect((first.options as string[]).length).toBe(4);
    expect(markupData(h.polls()[0])[0].callback_data).toMatch(/^nx:[a-z0-9]+:0$/);

    // 3 ta to'g'ri, 2 ta xato
    for (let i = 0; i < 5; i++) {
      const poll = h.polls()[i];
      const right = correctOf(poll);
      await h.send(answer(pollId(i), i < 3 ? right : (right + 1) % 4));
      if (i < 4) expect(h.polls()).toHaveLength(i + 2);
    }
    expect(await h.store.getSession(USER.id)).toBeNull();
    const history = await h.store.getHistory(USER.id);
    expect(history).toHaveLength(1);
    const r = history[0];
    expect(r.correctCount).toBe(3);
    expect(r.wrongCount).toBe(2);
    expect(r.percent).toBe(60);
    expect(r.answers.filter((a) => a.correct)).toHaveLength(3);
    const summary = h.last("sendMessage")!;
    expect(summary.payload.text).toContain("60%");
    expect(summary.payload.text).toContain(`${r.score} / ${r.maxScore}`);
    expect(markupData(summary).map((b) => b.callback_data)).toContain(`rw:${r.id}`);
    expect((await h.store.getMistakes(USER.id)).sort()).toEqual(r.answers.filter((a) => !a.correct).map((a) => a.questionId).sort());
  });

  it("takroriy va eskirgan poll_answer e’tiborsiz qoldiriladi", async () => {
    await h.store.setSettings(USER.id, { ...DEFAULT_SETTINGS, count: 5 });
    await h.send(cmd("/quiz"));
    await h.send(answer("poll-1", correctOf(h.polls()[0])));
    await h.send(answer("poll-1", correctOf(h.polls()[0]))); // takroriy
    await h.send(answer("unknown-poll", 0));
    await h.send(answer("poll-2", 0, USER2)); // boshqa foydalanuvchi
    const s = (await h.store.getSession(USER.id)) as BotSession;
    expect(h.polls()).toHaveLength(2);
    expect(s.index).toBe(1);
    expect(s.answers).toHaveLength(1);
  });

  it("“Keyingi” javobsiz bosilsa — xato, poll yopiladi; eskirgan tugma rad etiladi", async () => {
    await h.store.setSettings(USER.id, { ...DEFAULT_SETTINGS, count: 5 });
    await h.send(cmd("/quiz"));
    const data = markupData(h.polls()[0])[0].callback_data;
    await h.send(cb(data));
    expect(h.calls.some((c) => c.method === "stopPoll")).toBe(true);
    expect(h.polls()).toHaveLength(2);
    const s = (await h.store.getSession(USER.id)) as BotSession;
    expect(s.answers).toEqual([null]);

    await h.send(cb(data)); // eskirgan
    expect(h.polls()).toHaveLength(2);
    expect(h.last("answerCallbackQuery")!.payload.text).toBeTruthy();

    // qolganini o'tkazib yuboramiz → hammasi xato
    for (let i = 1; i < 5; i++) await h.send(cb(markupData(h.polls()[i])[0].callback_data));
    const r = (await h.store.getHistory(USER.id))[0];
    expect(r.correctCount).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.answers.every((a) => a.selected === null && !a.correct)).toBe(true);
    expect(await h.store.getMistakes(USER.id)).toHaveLength(5);
  });

  it("xatolardan mashg‘ulot: /mistakes va 🔁 Xatolardan", async () => {
    await h.send(cmd("/mistakes"));
    expect(h.last("sendMessage")!.payload.text).toContain("bo‘sh");

    await h.store.setSettings(USER.id, { ...DEFAULT_SETTINGS, count: 5 });
    await h.send(cmd("/quiz"));
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const right = correctOf(h.polls()[i]);
      await h.send(answer(`poll-${i + 1}`, i < 2 ? (right + 1) % 4 : right));
    }
    const r = (await h.store.getHistory(USER.id))[0];
    for (const a of r.answers) if (!a.correct) ids.push(a.questionId);
    expect(ids).toHaveLength(2);

    await h.send(cb(`rw:${r.id}`));
    let s = (await h.store.getSession(USER.id)) as BotSession;
    expect(s.mode).toBe("mistakes");
    expect(s.questions.map((q) => q.id).sort()).toEqual(ids.sort());

    // ikkalasiga to'g'ri javob → xatolar ro'yxati bo'shaydi
    for (let i = 0; i < 2; i++) await h.send(answer(`poll-${6 + i}`, correctOf(h.polls()[5 + i])));
    expect(await h.store.getMistakes(USER.id)).toEqual([]);

    await h.store.saveResult(USER.id, { ...r, id: "again" });
    await h.send(cmd("/mistakes"));
    s = (await h.store.getSession(USER.id)) as BotSession;
    expect(s.questions).toHaveLength(2);
  });

  it("/stats va /stop", async () => {
    await h.send(cmd("/stats"));
    expect(h.last("sendMessage")!.payload.text).toContain("Hali");
    await h.store.setSettings(USER.id, { ...DEFAULT_SETTINGS, count: 5 });
    await h.send(cmd("/quiz"));
    await h.send(cmd("/stop"));
    expect(await h.store.getSession(USER.id)).toBeNull();
    await h.send(cmd("/quiz"));
    for (let i = 0; i < 5; i++) await h.send(answer(`poll-${i + 2}`, correctOf(h.polls()[i + 1])));
    await h.send(cmd("/stats"));
    const text = String(h.last("sendMessage")!.payload.text);
    expect(text).toContain("100%");
    expect(text).toContain("Kategoriyalar bo‘yicha");
  });
});

describe("bot: guruh", () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it("ikki a’zo ballari, faqat boshlovchi/admin keyingiga o‘tadi, reyting saqlanadi", async () => {
    await h.send(cmd("/quiz@fibotbook_bot 5", USER, GROUP));
    expect(h.polls()).toHaveLength(1);
    expect(h.polls()[0].payload.open_period).toBe(30);
    expect(h.polls()[0].payload.is_anonymous).toBe(false);

    await h.send(cmd("/quiz", USER2, GROUP));
    expect(h.last("sendMessage")!.payload.text).toContain("allaqachon");

    let expectedAli = 0;
    let expectedVali = 0;
    for (let i = 0; i < 5; i++) {
      const s = (await h.store.getSession(GROUP.id)) as BotSession;
      const q = s.questions[i];
      const poll = h.polls()[i];
      const right = correctOf(poll);
      expect(right).toBe(q.answer);
      await h.send(answer(`poll-${i + 1}`, right, USER)); // Ali hammasini topadi
      await h.send(answer(`poll-${i + 1}`, right, USER)); // takroriy — hisobga olinmaydi
      expectedAli += pointsFor(q.difficulty);
      if (i % 2 === 0) expectedVali += pointsFor(q.difficulty);
      await h.send(answer(`poll-${i + 1}`, i % 2 === 0 ? right : (right + 1) % 4, USER2));

      const data = markupData(poll)[0].callback_data;
      if (i === 0) {
        await h.send(cb(data, USER2, GROUP)); // oddiy a'zo — rad etiladi
        expect(h.polls()).toHaveLength(1);
        const ans = h.last("answerCallbackQuery")!;
        expect(ans.payload.show_alert).toBe(true);
        await h.send(cb(data, USER, GROUP)); // boshlovchi
      } else if (i === 1) {
        await h.send(cb(data, ADMIN, GROUP)); // admin
      } else {
        await h.send(cb(data, USER, GROUP));
      }
    }
    expect(h.calls.filter((c) => c.method === "stopPoll")).toHaveLength(5);
    expect(await h.store.getSession(GROUP.id)).toBeNull();
    const final = String(h.last("sendMessage")!.payload.text);
    expect(final).toContain("🥇 Ali");
    expect(final).toContain(`${expectedAli} ball (5 to‘g‘ri)`);
    expect(final).toContain(`Vali — ${expectedVali} ball (3 to‘g‘ri)`);

    const top = await h.store.getGroupTop(GROUP.id, 10);
    expect(top).toEqual([
      { userId: String(USER.id), name: "Ali", score: expectedAli },
      { userId: String(USER2.id), name: "Vali", score: expectedVali },
    ]);
    await h.send(cmd("/top", USER2, GROUP));
    expect(String(h.last("sendMessage")!.payload.text)).toContain(`Ali — ${expectedAli} ball`);
  });

  it("/stop faqat boshlovchi yoki admin; bot qo‘shilganda salom", async () => {
    await h.send(cmd("/quiz", USER, GROUP));
    await h.send(cmd("/stop", USER2, GROUP));
    expect(await h.store.getSession(GROUP.id)).not.toBeNull();
    await h.send(cmd("/stop", ADMIN, GROUP));
    expect(await h.store.getSession(GROUP.id)).toBeNull();

    await h.send({
      my_chat_member: {
        chat: GROUP,
        from: USER,
        date: 0,
        old_chat_member: { status: "left", user: BOT_INFO },
        new_chat_member: { status: "member", user: BOT_INFO },
      },
    } as never);
    expect(String(h.last("sendMessage")!.payload.text)).toContain("/quiz");
  });
});

describe("bot: yordamchilar", () => {
  it("poll matni 300 belgidan oshmaydi", () => {
    const q = toSessionQuestion(makeQuestion({ id: "geo-001", question: "A".repeat(290) + "?" }));
    const text = pollQuestionText(q, 2, 10);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text.startsWith("3/10\n\n")).toBe(true);
    const short = pollQuestionText(toSessionQuestion(makeQuestion({ id: "geo-002", difficulty: "hard" })), 2, 10);
    expect(short.startsWith("3/10 · Geografiya · Qiyin · 3 ball\n\n")).toBe(true);
  });
});

describe("webhook route", () => {
  it("noto‘g‘ri secret → 401", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret";
    const body = JSON.stringify({ update_id: 1 });
    const bad = await POST(
      new Request("http://localhost/api/telegram", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "wrong" },
        body,
      }),
    );
    expect(bad.status).toBe(401);
    const missing = await POST(new Request("http://localhost/api/telegram", { method: "POST", body }));
    expect(missing.status).toBe(401);
    const badJson = await POST(
      new Request("http://localhost/api/telegram", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "s3cret" },
        body: "{not json",
      }),
    );
    expect(badJson.status).toBe(400);
    expect((await GET()).status).toBe(200);
  });
});
