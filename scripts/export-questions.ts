// Ishlatish: npm run export -- --format csv|json [--out fayl]
// --out berilmasa exports/questions.<ext> ga yoziladi; --out - bo'lsa stdout ga chiqariladi.
import fs from "node:fs";
import path from "node:path";
import { questionsToCSV, questionsToJSON } from "../src/lib/io";
import { QUESTIONS_DIR, ROOT, listQuestionFiles, parseArgs, readValid } from "./lib";

const { flags } = parseArgs(process.argv.slice(2));
const format = flags.format === undefined || flags.format === true ? "json" : flags.format;
if (format !== "csv" && format !== "json") {
  console.error("Xato: --format csv yoki json bo‘lishi kerak");
  process.exit(1);
}

const questions = listQuestionFiles().flatMap((f) => readValid(path.join(QUESTIONS_DIR, f)));
const out = format === "csv" ? questionsToCSV(questions) : questionsToJSON(questions);

if (flags.out === "-") {
  process.stdout.write(out);
} else {
  const target =
    typeof flags.out === "string" ? path.resolve(flags.out) : path.join(ROOT, "exports", `questions.${format}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out, "utf8");
  console.log(`✓ ${questions.length} ta savol eksport qilindi → ${path.relative(process.cwd(), target) || target}`);
}
