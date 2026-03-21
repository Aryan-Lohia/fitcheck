/**
 * Smoke-test Google Generative AI (same models as chat).
 * Run: npm run test:gemini
 * Loads GEMINI_API_KEY from process.env or project root `.env` (simple parser).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

function loadDotEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv();

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.error("GEMINI_API_KEY is missing (set in .env or environment).");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(key);

  console.log("--- gemini-2.5-flash-lite ---");
  const lite = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const liteRes = await lite.generateContent(
    'Reply with JSON only: {"status":"ok","model":"lite"}',
  );
  const liteText = liteRes.response.text();
  console.log(liteText?.slice(0, 400) ?? "(empty)");

  console.log("\n--- gemini-2.5-flash ---");
  const flash = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const flashRes = await flash.generateContent(
    'Reply with JSON only: {"status":"ok","model":"flash"}',
  );
  const flashText = flashRes.response.text();
  console.log(flashText?.slice(0, 400) ?? "(empty)");

  console.log("\nGemini API OK.");
}

main().catch((err) => {
  console.error("Gemini test failed:", err);
  process.exit(1);
});
