// Barcha bot matnlari — o'zbek lotin (o‘/g‘ uchun U+2018, tutuq belgisi uchun U+2019).
import { categoryName } from "@/lib/categories";
import { DIFFICULTY_LABELS } from "@/lib/schema";
import type { DifficultyFilter, QuizSettings, SessionResult } from "@/lib/types";

export const WEB_URL = "https://zakovat-mashgulot.vercel.app";

/** HTML parse_mode uchun xavfsiz matn. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function difficultyLabel(d: DifficultyFilter): string {
  return d === "mixed" ? "Aralash" : DIFFICULTY_LABELS[d];
}

export function timerLabel(t: number): string {
  return t > 0 ? `${t} s` : "O‘chiq";
}

export function settingsSummary(s: QuizSettings): string {
  const cats = s.categories.length === 0 ? "Hammasi" : s.categories.map(categoryName).join(", ");
  return [
    `📚 Kategoriyalar: ${cats}`,
    `🎚 Qiyinlik: ${difficultyLabel(s.difficulty)}`,
    `🔢 Savollar soni: ${s.count}`,
    `⏱ Taymer: ${timerLabel(s.timer)}`,
  ].join("\n");
}

export const T = {
  welcome: (name: string) =>
    `Assalomu alaykum, ${esc(name)}!\n\n` +
    `Men <b>Zakovat mashg‘uloti</b> botiman. Savollar Telegram viktorinasi ko‘rinishida keladi: javobni tanlang — to‘g‘ri javob va izoh darhol ko‘rinadi.\n\n` +
    `Quyidagi menyudan tanlang:`,
  menu: "Asosiy menyu:",
  help:
    `<b>Qanday ishlaydi</b>\n` +
    `▶️ Mashg‘ulot — sozlamalaringiz bo‘yicha savollar. Javob bergach keyingisi o‘zi keladi.\n` +
    `⏭ Keyingi — javob bermasdan o‘tkazish (xato hisoblanadi).\n` +
    `🔁 Xatolarim — xato qilingan savollarni qayta ishlash.\n\n` +
    `<b>Buyruqlar</b>\n` +
    `/quiz — mashg‘ulotni boshlash\n` +
    `/settings — sozlamalar\n` +
    `/stats — natijalarim\n` +
    `/mistakes — xatolar ustida ishlash\n` +
    `/stop — joriy mashg‘ulotni to‘xtatish\n\n` +
    `<b>Guruhda</b>: botni guruhga qo‘shing va /quiz (yoki /quiz 20) yozing. /top — guruh reytingi.\n\n` +
    `Veb-versiya: ${WEB_URL}`,
  groupHelp:
    `<b>Guruhda o‘yin</b>\n` +
    `/quiz — o‘yinni boshlash (10 savol), /quiz 5 yoki /quiz 20 ham bo‘ladi.\n` +
    `Har savolga hamma javob beradi; to‘g‘ri javob uchun qiyinlikka qarab 1/2/3 ball.\n` +
    `⏭ Keyingi savol — faqat boshlovchi yoki adminlar bosadi.\n` +
    `/top — guruhning umumiy reytingi\n` +
    `/stop — o‘yinni to‘xtatish (boshlovchi yoki admin)\n\n` +
    `Shaxsiy mashg‘ulot uchun menga to‘g‘ridan-to‘g‘ri yozing.`,
  groupIntro:
    `Salom! Men Zakovat savollari bilan guruh o‘yinini o‘tkazaman.\n` +
    `Boshlash uchun /quiz yozing, qo‘llanma — /help.`,
  settingsTitle: (s: QuizSettings, available: number) =>
    `<b>⚙️ Sozlamalar</b>\n\n${esc(settingsSummary(s))}\n\nMos savollar: ${available} ta\n\n` +
    `Kategoriyalarni belgilang (bir nechtasini tanlash mumkin), so‘ng qiyinlik, son va taymerni tanlang.`,
  settingsSaved: "Sozlamalar saqlandi.",
  noQuestions: "Bu sozlamalar bo‘yicha savol topilmadi. /settings orqali kategoriya yoki qiyinlikni o‘zgartiring.",
  fewQuestions: (n: number, want: number) => `Diqqat: mos savollar ${want} ta emas, faqat ${n} ta. Shularni beraman.`,
  sessionStart: (n: number, s: QuizSettings, mistakes: boolean) =>
    (mistakes ? `🔁 Xatolar ustida ishlash: ${n} ta savol.` : `▶️ Mashg‘ulot boshlandi: ${n} ta savol.`) +
    (s.timer > 0 ? ` Har savolga ${s.timer} soniya.` : "") +
    `\nJavob bermasdan o‘tish uchun «⏭ Keyingi» tugmasini bosing.`,
  next: "⏭ Keyingi",
  nextGroup: "⏭ Keyingi savol",
  finishGroupBtn: "🏁 Yakunlash",
  stale: "Bu savol allaqachon o‘tib ketgan.",
  noSession: "Faol mashg‘ulot yo‘q.",
  stopped: "Mashg‘ulot to‘xtatildi. Yangi mashg‘ulot — /quiz",
  noMistakes: "Xatolar ro‘yxati bo‘sh. Ajoyib! 🎉",
  result: (r: SessionResult) =>
    `🏁 <b>Mashg‘ulot yakunlandi!</b>\n\n` +
    `✅ To‘g‘ri: ${r.correctCount}\n` +
    `❌ Xato: ${r.wrongCount}\n` +
    `📈 Natija: ${r.percent}%\n` +
    `⭐ Ball: ${r.score} / ${r.maxScore}`,
  againBtn: "▶️ Yana",
  fromMistakesBtn: "🔁 Xatolardan",
  menuBtn: "🏠 Menyu",
  statsEmpty: "Hali mashg‘ulot o‘tkazmadingiz. /quiz bilan boshlang!",
  statsTitle: (sessions: number, avg: number, correct: number, total: number) =>
    `<b>📊 Natijalarim</b> (so‘nggi ${sessions} ta mashg‘ulot)\n\n` +
    `Mashg‘ulotlar: ${sessions}\n` +
    `O‘rtacha natija: ${avg}%\n` +
    `To‘g‘ri javoblar: ${correct} / ${total}`,
  statsCategoryHeader: "\n<b>Kategoriyalar bo‘yicha:</b>",
  groupOnly: "Bu buyruq faqat guruhda ishlaydi.",
  privateOnly: "Bu buyruq shaxsiy chatda ishlaydi — menga to‘g‘ridan-to‘g‘ri yozing.",
  groupAlreadyRunning: "O‘yin allaqachon ketmoqda. To‘xtatish uchun /stop.",
  groupStart: (n: number, timer: number, host: string) =>
    `🎯 <b>Zakovat o‘yini boshlandi!</b>\n\n` +
    `${n} ta savol, har biriga ${timer} soniya. To‘g‘ri javob: oson — 1, o‘rta — 2, qiyin — 3 ball.\n` +
    `Keyingi savolga boshlovchi (${esc(host)}) yoki adminlar o‘tkazadi.`,
  onlyHost: "Faqat boshlovchi yoki guruh adminlari keyingi savolga o‘tkaza oladi.",
  onlyHostStop: "O‘yinni faqat boshlovchi yoki guruh adminlari to‘xtata oladi.",
  groupStopped: "O‘yin to‘xtatildi.",
  groupNoGame: "Hozir o‘yin yo‘q. Boshlash — /quiz",
  groupFinishTitle: "🏆 <b>O‘yin yakunlandi!</b>",
  groupStoppedTitle: "⏹ <b>O‘yin to‘xtatildi.</b> Joriy holat:",
  groupNobody: "Hech kim javob bermadi.",
  groupTopTitle: "🏆 <b>Guruhning umumiy reytingi</b>",
  groupTopEmpty: "Reyting hali bo‘sh. /quiz bilan o‘yin boshlang!",
  error: "Xatolik yuz berdi, birozdan so‘ng qayta urinib ko‘ring.",
} as const;

const MEDALS = ["🥇", "🥈", "🥉"];

export function rankLine(i: number, name: string, score: number, correct?: number): string {
  const place = MEDALS[i] ?? `${i + 1}.`;
  return `${place} ${esc(name)} — ${score} ball` + (correct !== undefined ? ` (${correct} to‘g‘ri)` : "");
}
