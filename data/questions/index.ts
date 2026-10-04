// Savol fayllari ro'yxati — YANGI KATEGORIYA FAYLINI FAQAT SHU YERDA RO'YXATDAN O'TKAZING.
// Har bir fayl data/questions/<kategoriya>.json ko'rinishida bo'lishi kerak
// (kategoriya data/categories.json da mavjud bo'lishi shart).
import uzbekistan from "./uzbekistan.json";
import history from "./history.json";
import geography from "./geography.json";
import science from "./science.json";
import literature from "./literature.json";
import art from "./art.json";
import sport from "./sport.json";
import nature from "./nature.json";
import space from "./space.json";
import logic from "./logic.json";

const files: unknown[][] = [
  uzbekistan,
  history,
  geography,
  science,
  literature,
  art,
  sport,
  nature,
  space,
  logic,
];

/** Barcha fayllardagi xom (tekshirilmagan) savollar. Validatsiya src/lib/questions.ts da. */
const rawQuestions: unknown[] = files.flat();

export default rawQuestions;
