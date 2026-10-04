# Zakovat mashg‘ulot

Zakovat viktorinasiga 4 variantli savollar orqali tayyorlanish ilovasi (Next.js 16, TypeScript, Tailwind CSS v4). Akkaunt talab qilinmaydi — tarix brauzerda saqlanadi.

## Ishga tushirish
```bash
npm install
npm run dev        # http://localhost:3000
```

## Buyruqlar
| Buyruq | Vazifasi |
|---|---|
| `npm run validate` | Savollar bazasini tekshirish (sxema, dublikatlar, statistika) |
| `npm run import -- fayl.csv` | JSON/CSV dan savol qo‘shish (`status: pending` bilan; `--status verified` ixtiyoriy) |
| `npm run export -- --format csv` | Bazani `exports/` ga eksport qilish |
| `npm test` | Unit testlar (vitest) |
| `npm run e2e` | Brauzer testlari (Playwright) |

## Savollar bazasi
- `data/questions/<kategoriya>.json` — har kategoriya alohida fayl.
- Mashg‘ulotga faqat `"status": "verified"` savollar kiradi.
- Yangi kategoriya: `data/categories.json` ga qator + JSON fayl + `data/questions/index.ts` ga import.
- CSV ustunlari: `id,question,optionA,optionB,optionC,optionD,answer,explanation,category,difficulty,source,status,asOf` (`answer` — A–D).
