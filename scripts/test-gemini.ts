/**
 * Smoke-test Google Generative AI (same models as chat).
 * Run: npm run test:gemini
 * Loads GEMINI_API_KEY from process.env or project root `.env` (simple parser).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadDotEnvFromProjectRoot } from "./load-dot-env";

loadDotEnvFromProjectRoot();

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
