import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* Fixtures: har bir testda konsol xatolari / gidratsiya ogohlantirishlari yo'qligini tekshiramiz */
/* ------------------------------------------------------------------ */

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (msg.type() === "error" || /hydrat/i.test(text)) errors.push(`[console.${msg.type()}] ${text}`);
      });
      page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
      await use(errors);
      expect(errors, "konsolda xato bo'lmasligi kerak").toEqual([]);
    },
    { auto: true },
  ],
});

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const ACTIVE_KEY = "zakovat:v1:active";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const POINTS: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

type SessionQ = { id: string; answer: number; difficulty: string; options: string[]; question: string };

async function activeQuestions(page: Page): Promise<SessionQ[]> {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), ACTIVE_KEY);
  expect(raw, "faol mashg'ulot sessionStorage'da bo'lishi kerak").not.toBeNull();
  return (JSON.parse(raw!) as { questions: SessionQ[] }).questions;
}

/** Segmented / radio guruhida yorliqni bosadi. */
async function pick(page: Page, group: RegExp, label: string) {
  await page
    .getByRole("group", { name: group })
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click();
}

async function startQuiz(page: Page, opts: { count?: 5 | 10 | 20; timer?: 0 | 15 | 30 } = {}) {
  const { count = 5, timer = 0 } = opts;
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Mashg‘ulotni boshlash/ })).toBeEnabled();
  await pick(page, /^Savollar soni/, String(count));
  await pick(page, /^Taymer/, timer === 0 ? "O‘chiq" : `${timer} s`);
  await page.getByRole("button", { name: /Mashg‘ulotni boshlash/ }).click();
  await expect(page).toHaveURL(/\/quiz$/);
  await expect(page.getByText(`Savol 1 / ${count}`)).toBeVisible();
}

const options = (page: Page) => page.getByRole("group", { name: "Javob variantlari" }).getByRole("button");
const nextButton = (page: Page) => page.getByRole("button", { name: /Keyingi savol|Natijani ko‘rish/ });

/** pattern[i] = true -> to'g'ri javob, false -> noto'g'ri. Natija sahifasigacha yuradi. */
async function playSession(page: Page, pattern: boolean[]) {
  const qs = await activeQuestions(page);
  expect(qs).toHaveLength(pattern.length);
  for (let i = 0; i < pattern.length; i++) {
    await expect(page.getByText(`Savol ${i + 1} / ${pattern.length}`)).toBeVisible();
    const q = qs[i];
    await expect(page.getByRole("heading", { level: 2, name: q.question })).toBeVisible();
    const choice = pattern[i] ? q.answer : (q.answer + 1) % 4;
    await options(page).nth(choice).click();
    await nextButton(page).click();
  }
  await expect(page).toHaveURL(/\/result\?id=/);
  return qs;
}

function tile(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");
}

async function expectNoHorizontalOverflow(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, `gorizontal skroll: ${page.url()}`).toBeLessThanOrEqual(cw);
}

async function shot(page: Page, name: string, projectName: string, theme: string) {
  // Animatsiyalar tugashi uchun bir oz kutamiz
  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${projectName}-${theme}-${name}.png`),
    fullPage: true,
  });
}

/* ------------------------------------------------------------------ */
/* (a) Home + sozlamalar saqlanishi */
/* ------------------------------------------------------------------ */

test("home: kategoriyalar, qiyinlik, son, taymer; sozlamalar reloaddan keyin saqlanadi", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Zakovatga tayyorlaning" })).toBeVisible();

  const cats = page.getByRole("group", { name: "Kategoriyalar" });
  for (const name of ["Hammasi", "O‘zbekiston", "Tarix", "Geografiya", "Fan va texnologiya", "Adabiyot", "San’at", "Sport", "Tabiat", "Koinot", "Mantiq"]) {
    await expect(cats.getByRole("checkbox", { name: new RegExp(`^${name}`) })).toBeAttached();
  }
  await expect(cats.getByRole("checkbox", { name: /^Hammasi/ })).toBeChecked();

  const diff = page.getByRole("group", { name: /^Qiyinlik/ });
  for (const n of ["Aralash", "Oson", "O‘rta", "Qiyin"]) await expect(diff.getByRole("radio", { name: n })).toBeAttached();
  const count = page.getByRole("group", { name: /^Savollar soni/ });
  for (const n of ["5", "10", "20"]) await expect(count.getByRole("radio", { name: n, exact: true })).toBeAttached();
  const timer = page.getByRole("group", { name: /^Taymer/ });
  for (const n of ["O‘chiq", "15 s", "30 s"]) await expect(timer.getByRole("radio", { name: n })).toBeAttached();

  // Defaults
  await expect(diff.getByRole("radio", { name: "Aralash" })).toBeChecked();
  await expect(count.getByRole("radio", { name: "10", exact: true })).toBeChecked();
  await expect(timer.getByRole("radio", { name: "O‘chiq" })).toBeChecked();

  // O'zgartirish
  await cats.locator("label").filter({ hasText: /^Geografiya/ }).click();
  await cats.locator("label").filter({ hasText: /^Sport/ }).click();
  await pick(page, /^Qiyinlik/, "Oson");
  await pick(page, /^Savollar soni/, "20");
  await pick(page, /^Taymer/, "30 s");

  await expect(cats.getByRole("checkbox", { name: /^Hammasi/ })).not.toBeChecked();
  const available = await page.locator("#available-count").textContent();

  await page.reload();
  await expect(cats.getByRole("checkbox", { name: /^Geografiya/ })).toBeChecked();
  await expect(cats.getByRole("checkbox", { name: /^Sport/ })).toBeChecked();
  await expect(cats.getByRole("checkbox", { name: /^Tarix/ })).not.toBeChecked();
  await expect(cats.getByRole("checkbox", { name: /^Hammasi/ })).not.toBeChecked();
  await expect(diff.getByRole("radio", { name: "Oson" })).toBeChecked();
  await expect(count.getByRole("radio", { name: "20", exact: true })).toBeChecked();
  await expect(timer.getByRole("radio", { name: "30 s" })).toBeChecked();
  await expect(page.locator("#available-count")).toHaveText(available!);

  // "Hammasi" qaytaradi
  await cats.locator("label").filter({ hasText: /^Hammasi/ }).click();
  await expect(cats.getByRole("checkbox", { name: /^Hammasi/ })).toBeChecked();
  await expect(cats.getByRole("checkbox", { name: /^Geografiya/ })).not.toBeChecked();
});

/* ------------------------------------------------------------------ */
/* (b)(c)(d) To'liq mashg'ulot, natija, xatolar, qayta ochilmaslik */
/* ------------------------------------------------------------------ */

test("5 savollik mashg‘ulot: javob holatlari, natija, xatolar va qayta boshlanmaslik", async ({ page }) => {
  await startQuiz(page, { count: 5 });
  const qs = await activeQuestions(page);
  expect(new Set(qs.map((q) => q.id)).size).toBe(5);

  // 1-savol: noto'g'ri javob — holatlarni batafsil tekshiramiz
  const q0 = qs[0];
  const wrongIdx = (q0.answer + 1) % 4;
  await expect(options(page)).toHaveCount(4);
  for (let i = 0; i < 4; i++) await expect(options(page).nth(i)).toBeEnabled();
  await expect(page.locator("#explanation-title")).toHaveCount(0);
  await options(page).nth(wrongIdx).click();

  await expect(page.locator("#explanation-title")).toHaveText("Noto‘g‘ri");
  await expect(page.getByText("To‘g‘ri javob:")).toBeVisible();
  await expect(page.getByText(/^Manba:/)).toBeVisible();
  for (let i = 0; i < 4; i++) await expect(options(page).nth(i)).toBeDisabled();
  await expect(options(page).nth(wrongIdx)).toContainText("Noto‘g‘ri · Sizning javobingiz");
  await expect(options(page).nth(q0.answer)).toContainText("To‘g‘ri javob");
  await expect(nextButton(page)).toHaveText(/Keyingi savol/);
  await expect(nextButton(page)).toBeFocused();
  // Ikkinchi bosish hech narsani o'zgartirmaydi
  await options(page).nth(q0.answer).click({ force: true });
  await expect(page.locator("#explanation-title")).toHaveText("Noto‘g‘ri");

  await nextButton(page).click();
  await expect(page.getByText("Savol 2 / 5")).toBeVisible();
  await expect(page.locator("#explanation-title")).toHaveCount(0);

  // 2-savol: to'g'ri
  await options(page).nth(qs[1].answer).click();
  await expect(page.locator("#explanation-title")).toHaveText("To‘g‘ri!");
  await expect(options(page).nth(qs[1].answer)).toContainText("To‘g‘ri · Sizning javobingiz");
  await nextButton(page).click();

  // 3: to'g'ri, 4: noto'g'ri, 5: to'g'ri
  const pattern = [false, true, true, false, true];
  for (let i = 2; i < 5; i++) {
    await expect(page.getByText(`Savol ${i + 1} / 5`)).toBeVisible();
    await options(page).nth(pattern[i] ? qs[i].answer : (qs[i].answer + 1) % 4).click();
    if (i === 4) await expect(nextButton(page)).toHaveText(/Natijani ko‘rish/);
    await nextButton(page).click();
  }

  // Natija
  await expect(page).toHaveURL(/\/result\?id=/);
  const correct = pattern.filter(Boolean).length;
  const wrong = 5 - correct;
  await expect(tile(page, "Savollar")).toHaveText("5");
  await expect(tile(page, "To‘g‘ri")).toHaveText(String(correct));
  await expect(tile(page, "Noto‘g‘ri")).toHaveText(String(wrong));
  const percent = Math.round((correct / 5) * 100);
  await expect(page.locator("#result-heading")).toContainText(`${percent}%`);

  const expectedMax = qs.reduce((s, q) => s + POINTS[q.difficulty], 0);
  const expectedScore = qs.reduce((s, q, i) => s + (pattern[i] ? POINTS[q.difficulty] : 0), 0);
  const scoreText = await page.getByText(/^\d+ \/ \d+$/).first().textContent();
  const [score, max] = scoreText!.split("/").map((s) => Number(s.trim()));
  expect(score).toBe(expectedScore);
  expect(max).toBe(expectedMax);
  expect(score).toBeLessThanOrEqual(max);

  // (c) Xatolar ro'yxati
  await expect(page.getByRole("heading", { name: `Xatolar ustida ishlash (${wrong})` })).toBeVisible();
  const items = page.locator("section[aria-labelledby='mistakes-heading'] ol > li");
  await expect(items).toHaveCount(wrong);
  const wrongQs = qs.filter((_, i) => !pattern[i]);
  for (const q of wrongQs) {
    const li = items.filter({ hasText: q.question });
    await expect(li).toHaveCount(1);
    await expect(li).toContainText(q.options[(q.answer + 1) % 4]); // foydalanuvchi javobi
    await expect(li).toContainText(q.options[q.answer]); // to'g'ri javob
  }

  // (d) /quiz ga qaytish mashg'ulotni qayta boshlamaydi
  const resultUrl = page.url();
  await page.goto("/quiz");
  await expect(page.getByText("Bu mashg‘ulot yakunlangan")).toBeVisible();
  await expect(options(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Natijani ko‘rish" }).click();
  await expect(page).toHaveURL(resultUrl);
  await page.goBack();
  await expect(page.getByText("Bu mashg‘ulot yakunlangan")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(resultUrl);

  // History: bitta yozuv
  const histRaw = await page.evaluate(() => localStorage.getItem("zakovat:v1:history"));
  expect(JSON.parse(histRaw!)).toHaveLength(1);

  // (c) Faqat xatolardan yangi mashg'ulot
  await page.getByRole("button", { name: "Faqat xatolardan yangi mashg‘ulot" }).click();
  await expect(page).toHaveURL(/\/quiz$/);
  await expect(page.getByText(`Savol 1 / ${wrong}`)).toBeVisible();
  await expect(page.getByText("Xatolar ustida ishlash")).toBeVisible();
  const retryQs = await activeQuestions(page);
  expect(retryQs.map((q) => q.id).sort()).toEqual(wrongQs.map((q) => q.id).sort());

  // Xatolar mashg'ulotini to'g'ri yakunlash -> 100%
  await playSession(page, retryQs.map(() => true));
  await expect(page.locator("#result-heading")).toContainText("100%");
  await expect(page.getByText("Barcha savollarga to‘g‘ri javob berdingiz.")).toBeVisible();
  // Xatolar puli bo'shadi
  const mistakes = await page.evaluate(() => localStorage.getItem("zakovat:v1:mistakes"));
  expect(JSON.parse(mistakes!)).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* (e) Taymer */
/* ------------------------------------------------------------------ */

test("taymer 15 s: vaqt tugashi avtomatik ochadi va xato hisoblanadi", async ({ page }) => {
  await page.clock.install();
  await startQuiz(page, { count: 5, timer: 15 });
  const qs = await activeQuestions(page);

  const timer = page.getByRole("timer");
  await expect(timer).toHaveText("15 s");
  await page.clock.runFor(5_000);
  await expect(timer).toHaveText(/^1[01] s$/);
  await page.clock.runFor(11_000);

  await expect(page.locator("#explanation-title")).toHaveText("Vaqt tugadi");
  await expect(timer).toHaveText("0 s");
  for (let i = 0; i < 4; i++) await expect(options(page).nth(i)).toBeDisabled();
  await expect(options(page).nth(qs[0].answer)).toContainText("To‘g‘ri javob");
  // Ochilgandan keyin vaqt ketaversa ham hech narsa o'zgarmaydi
  await page.clock.runFor(20_000);
  await expect(page.getByText("Savol 1 / 5")).toBeVisible();

  await nextButton(page).click();
  await expect(timer).toHaveText("15 s");
  // Qolganlariga to'g'ri javob
  for (let i = 1; i < 5; i++) {
    await expect(page.getByText(`Savol ${i + 1} / 5`)).toBeVisible();
    await options(page).nth(qs[i].answer).click();
    await nextButton(page).click();
  }
  await expect(page).toHaveURL(/\/result\?id=/);
  await expect(tile(page, "To‘g‘ri")).toHaveText("4");
  await expect(tile(page, "Noto‘g‘ri")).toHaveText("1");
  await expect(page.locator("#result-heading")).toContainText("80%");
  const li = page.locator("section[aria-labelledby='mistakes-heading'] ol > li");
  await expect(li).toHaveCount(1);
  await expect(li).toContainText("Javob berilmadi");
});

/* ------------------------------------------------------------------ */
/* (f) Tarix */
/* ------------------------------------------------------------------ */

test("tarix: sessiyalar ro‘yxati va tozalash", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByText("Hali mashg‘ulot o‘tkazilmagan")).toBeVisible();

  await startQuiz(page, { count: 5 });
  await playSession(page, [true, false, true, true, true]);
  await startQuiz(page, { count: 5 });
  await playSession(page, [true, true, true, true, true]);

  await page.getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Tarix" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tarix" })).toBeVisible();
  await expect(tile(page, "Mashg‘ulotlar")).toHaveText("2");
  await expect(tile(page, "O‘rtacha natija")).toHaveText("90%");
  const rows = page.locator("section[aria-labelledby='sessions'] ul > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("100%"); // yangi -> eski
  await expect(rows.nth(1)).toContainText("80%");
  await expect(page.getByRole("button", { name: /Barcha xatolarni takrorlash \(1\)/ })).toBeVisible();

  // Ochish
  await rows.nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/\/result\?id=/);
  await expect(page.locator("#result-heading")).toContainText("80%");
  await page.goBack();

  // Tozalash (confirm)
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Tarixni tozalash" }).click();
  await expect(page.getByText("Hali mashg‘ulot o‘tkazilmagan")).toBeVisible();
  await expect(rows).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("zakovat:v1:history"))).toBeNull();

  // Bekor qilinganda tozalanmaydi
  await startQuiz(page, { count: 5 });
  await playSession(page, [true, true, true, true, true]);
  await page.goto("/history");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Tarixni tozalash" }).click();
  await expect(rows).toHaveCount(1);
});

/* ------------------------------------------------------------------ */
/* (g) Savollar bazasi */
/* ------------------------------------------------------------------ */

const CSV_HEADER = "id,question,optionA,optionB,optionC,optionD,answer,explanation,category,difficulty,source,status,asOf";
const IMPORT_QUESTION = "E2E test: Qaysi shahar Zarafshon vodiysida joylashgan?";
const CSV = [
  CSV_HEADER,
  `geo-999,"${IMPORT_QUESTION}",Samarqand,Nukus,Termiz,Urganch,A,"Samarqand Zarafshon vodiysida joylashgan shahar.",geography,easy,"https://example.com/e2e",verified,`,
  `geo-998,"Noto‘g‘ri qator: javob harfi yo‘q bo‘lgan savol?",Bir,Ikki,Uch,To‘rt,E,"Bu qator xato bo‘lishi kerak.",geography,easy,Manba,,`,
].join("\n");

test("savollar bazasi: statistika, CSV import (xatolar bilan), import mashg‘ulotga kirmaydi, eksport", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1, name: "Savollar bazasi" })).toBeVisible();

  // Statistika: qatorlar yig'indisi = jami, va home'dagi "Hammasi" soni bilan mos
  const table = page.getByRole("table");
  const bodyRows = table.locator("tbody tr");
  await expect(bodyRows).toHaveCount(10);
  const totals = await bodyRows.locator("td:last-child").allTextContents();
  const sum = totals.reduce((s, t) => s + Number(t), 0);
  expect(sum).toBeGreaterThan(0);
  const grandText = await table.locator("tfoot td:last-child").textContent();
  expect(Number(grandText)).toBe(sum);
  await expect(page.getByText(/^Jami:/)).toContainText(String(sum));
  // har qatorda qiyinliklar yig'indisi = jami
  for (let i = 0; i < 10; i++) {
    const cells = (await bodyRows.nth(i).locator("td").allTextContents()).map(Number);
    expect(cells[0] + cells[1] + cells[2]).toBe(cells[3]);
  }

  // Import
  await expect(page.locator("#pending-heading")).toContainText("(0)");
  await page.locator("input[type=file]").setInputFiles({
    name: "e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf-8"),
  });
  await expect(page.getByText("Tanlangan: e2e.csv")).toBeVisible();
  await expect(page.getByText(/Yaroqli savollar:/)).toContainText("Yaroqli savollar: 1");
  await expect(page.getByText(/Yaroqli savollar:/)).toContainText("Xatoli qatorlar: 1");
  const errItem = page.locator("ul.max-h-60 li");
  await expect(errItem).toHaveCount(1);
  await expect(errItem).toContainText("3-qator");
  await expect(errItem).toContainText("answer A, B, C yoki D");
  // Qator raqami ikki marta takrorlanmasligi kerak
  expect((await errItem.textContent())!.match(/3-qator/g)).toHaveLength(1);

  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("1 ta savol “Tekshiruvda” holatida saqlandi.")).toBeVisible();
  await expect(page.locator("#pending-heading")).toContainText("(1)");
  await page.getByText("Ro‘yxatni ko‘rsatish").click();
  await expect(page.getByText(IMPORT_QUESTION)).toBeVisible();
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem("zakovat:v1:imported")))!);
  expect(stored).toHaveLength(1);
  expect(stored[0].status).toBe("pending"); // CSV'da "verified" bo'lsa ham

  // Statistika o'zgarmadi
  await page.reload();
  expect(Number(await table.locator("tfoot td:last-child").textContent())).toBe(sum);
  await expect(page.locator("#pending-heading")).toContainText("(1)");

  // Import qilingan savol mashg'ulotlarga kirmaydi: Geografiya + Oson bo'yicha barcha savollar
  await page.goto("/");
  const cats = page.getByRole("group", { name: "Kategoriyalar" });
  await cats.locator("label").filter({ hasText: /^Geografiya/ }).click();
  await pick(page, /^Qiyinlik/, "Oson");
  await pick(page, /^Savollar soni/, "20");
  const homeGeoEasy = Number((await cats.locator("label").filter({ hasText: /^Geografiya/ }).locator(".tabular-nums").textContent())!.replace(/\D/g, ""));
  await expect(page.locator("#available-count")).toContainText(`Mavjud savollar: ${homeGeoEasy}`);
  await page.getByRole("button", { name: /Mashg‘ulotni boshlash/ }).click();
  await expect(page).toHaveURL(/\/quiz$/);
  const ids = (await activeQuestions(page)).map((q) => q.id);
  expect(ids).toHaveLength(Math.min(20, homeGeoEasy));
  expect(ids).not.toContain("geo-999");
  expect(ids.every((id) => id.startsWith("geo-"))).toBe(true);

  // Eksport JSON
  await page.goto("/library");
  const verifiedCard = page.locator("div").filter({ has: page.getByRole("heading", { name: "Tasdiqlangan baza" }) }).last();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    verifiedCard.getByRole("button", { name: "JSON eksport" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("zakovat-verified.json");
  const exported = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));
  expect(exported).toHaveLength(sum);
  expect(exported.every((q: { status: string }) => q.status === "verified")).toBe(true);

  const pendingCard = page.locator("div").filter({ has: page.getByRole("heading", { name: "Tekshiruvdagi savollar" }) }).last();
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    pendingCard.getByRole("button", { name: "CSV eksport" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toBe("zakovat-pending.csv");
  const csvText = fs.readFileSync((await csvDownload.path())!, "utf-8");
  expect(csvText.split("\n")[0]).toBe(CSV_HEADER);
  expect(csvText).toContain("geo-999");

  // Importni tozalash
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Tozalash" }).click();
  await expect(page.locator("#pending-heading")).toContainText("(0)");
  await expect(pendingCard.getByRole("button", { name: "JSON eksport" })).toBeDisabled();
});

test("savollar bazasi: noto‘g‘ri fayl turi va buzilgan JSON", async ({ page }) => {
  await page.goto("/library");
  const input = page.locator("input[type=file]");
  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("salom") });
  await expect(page.getByText("Faqat .json yoki .csv fayllarni yuklash mumkin.")).toHaveAttribute("role", "alert");
  await input.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{oops") });
  await expect(page.getByText(/Yaroqli savollar:/)).toContainText("Yaroqli savollar: 0");
  await expect(page.locator("ul.max-h-60 li")).toContainText("JSON o‘qib bo‘lmadi");
  await expect(page.locator("ul.max-h-60 li")).not.toContainText("0-qator");
  await expect(page.getByRole("button", { name: "Saqlash" })).toBeDisabled();
});

/* ------------------------------------------------------------------ */
/* (h) Mavzu */
/* ------------------------------------------------------------------ */

test("mavzu tugmasi html.dark klassini almashtiradi va saqlaydi", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);
  const toggle = page.getByRole("button", { name: /^Mavzu:/ });
  await expect(toggle).toHaveAccessibleName(/Tizim/);

  await toggle.click(); // system -> light
  await expect(toggle).toHaveAccessibleName(/^Mavzu: Yorug‘/);
  await expect(html).not.toHaveClass(/\bdark\b/);

  await toggle.click(); // light -> dark
  await expect(toggle).toHaveAccessibleName(/^Mavzu: Qorong‘i/);
  await expect(html).toHaveClass(/\bdark\b/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(12, 12, 12)");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.goto("/library");
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: /^Mavzu:/ }).click(); // dark -> system (light)
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/\bdark\b/);
});

/* ------------------------------------------------------------------ */
/* (i) Klaviatura */
/* ------------------------------------------------------------------ */

test("klaviatura: 1/A tanlaydi, Enter va → keyingisiga o‘tadi", async ({ page }) => {
  await startQuiz(page, { count: 5 });
  const qs = await activeQuestions(page);

  await page.keyboard.press("1");
  await expect(page.locator("#explanation-title")).toBeVisible();
  await expect(page.locator("#explanation-title")).toHaveText(qs[0].answer === 0 ? "To‘g‘ri!" : "Noto‘g‘ri");
  // Ochilgandan keyin raqam tugmalari javobni o'zgartirmaydi
  await page.keyboard.press("2");
  await expect(page.locator("#explanation-title")).toHaveText(qs[0].answer === 0 ? "To‘g‘ri!" : "Noto‘g‘ri");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Savol 2 / 5")).toBeVisible();
  await expect(page.locator("#explanation-title")).toHaveCount(0);

  // Enter javobsiz holatda hech narsa qilmaydi
  await page.keyboard.press("Enter");
  await expect(page.getByText("Savol 2 / 5")).toBeVisible();
  await expect(page.locator("#explanation-title")).toHaveCount(0);

  await page.keyboard.press("A");
  await expect(page.locator("#explanation-title")).toHaveText(qs[1].answer === 0 ? "To‘g‘ri!" : "Noto‘g‘ri");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Savol 3 / 5")).toBeVisible();

  await page.keyboard.press("d");
  await expect(page.locator("#explanation-title")).toHaveText(qs[2].answer === 3 ? "To‘g‘ri!" : "Noto‘g‘ri");
  // Fokus boshqa joyda bo'lsa ham Enter keyingisiga o'tadi (ikki marta emas)
  await page.locator("h2").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Savol 4 / 5")).toBeVisible();

  await page.keyboard.press("4");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Savol 5 / 5")).toBeVisible();
  await page.keyboard.press("c");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/result\?id=/);
  await expect(tile(page, "Savollar")).toHaveText("5");
});

/* ------------------------------------------------------------------ */
/* (j) Gorizontal overflow + skrinshotlar (light/dark) */
/* ------------------------------------------------------------------ */

for (const theme of ["light", "dark"] as const) {
  test(`sahifalar: overflow yo‘q, skrinshotlar (${theme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    const project = testInfo.project.name;

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
    await expectNoHorizontalOverflow(page);
    await shot(page, "home", project, theme);

    await startQuiz(page, { count: 5, timer: 30 });
    await expectNoHorizontalOverflow(page);
    await shot(page, "quiz", project, theme);
    const qs = await activeQuestions(page);
    await options(page).nth((qs[0].answer + 1) % 4).click();
    await expect(page.locator("#explanation-title")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, "quiz-revealed", project, theme);
    await nextButton(page).click();
    for (let i = 1; i < 5; i++) {
      await options(page).nth(i % 2 ? qs[i].answer : (qs[i].answer + 1) % 4).click();
      await nextButton(page).click();
    }
    await expect(page).toHaveURL(/\/result\?id=/);
    await expect(page.locator("#result-heading")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, "result", project, theme);

    await page.goto("/quiz");
    await expect(page.getByText("Bu mashg‘ulot yakunlangan")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Mashg‘ulotlar", level: 2 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, "history", project, theme);

    await page.goto("/library");
    await expect(page.getByRole("table")).toBeVisible();
    await page.locator("input[type=file]").setInputFiles({
      name: "e2e.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV, "utf-8"),
    });
    await expect(page.getByText(/Yaroqli savollar:/)).toBeVisible();
    await page.getByText("CSV ustunlari formati").click();
    await expectNoHorizontalOverflow(page);
    await shot(page, "library", project, theme);

    await page.goto("/result?id=missing");
    await expect(page.getByText("Natija topilmadi")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
