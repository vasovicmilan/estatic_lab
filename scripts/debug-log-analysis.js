import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeDay } from "../src/utils/log-analysis.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, "..", "logs");

const IS_PROD = process.env.NODE_ENV === "production";
const baseFileName = (name) => (IS_PROD ? name : `${name}-dev`);

const dateStr = process.argv[2];
if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  console.error('Usage: node scripts/debug-log-analysis.js YYYY-MM-DD');
  console.error('Example: node scripts/debug-log-analysis.js 2026-07-19');
  process.exit(1);
}

console.log(`NODE_ENV=${process.env.NODE_ENV || "(not set)"} -> looking for "${baseFileName("app")}.*" / "${baseFileName("http")}.*" files`);
console.log(`Logs directory: ${LOGS_DIR}`);
console.log(`Directory exists: ${fs.existsSync(LOGS_DIR)}`);

if (fs.existsSync(LOGS_DIR)) {
  const allFiles = fs.readdirSync(LOGS_DIR);
  console.log(`\nAll files in logs directory (${allFiles.length}):`);
  allFiles.forEach((f) => console.log(`  ${f}`));

  const appPrefix = `${baseFileName("app")}.${dateStr}.`;
  const httpPrefix = `${baseFileName("http")}.${dateStr}.`;
  const matchingApp = allFiles.filter((f) => f.startsWith(appPrefix));
  const matchingHttp = allFiles.filter((f) => f.startsWith(httpPrefix));

  console.log(`\nFiles matching "${appPrefix}*" (app/error logs for ${dateStr}): ${matchingApp.length}`);
  matchingApp.forEach((f) => console.log(`  ${f}`));
  console.log(`\nFiles matching "${httpPrefix}*" (http logs for ${dateStr}): ${matchingHttp.length}`);
  matchingHttp.forEach((f) => console.log(`  ${f}`));

  // sample a few raw lines from any matching http file so you can eyeball the
  // actual format being written, in case it doesn't match what the parser expects
  if (matchingHttp.length > 0) {
    const sample = fs.readFileSync(path.join(LOGS_DIR, matchingHttp[0]), "utf8").split("\n").filter(Boolean).slice(0, 3);
    console.log(`\nFirst few lines of ${matchingHttp[0]}:`);
    sample.forEach((line) => console.log(`  ${line}`));
  }
}

console.log(`\n--- analyzeDay("${dateStr}") result ---`);
console.log(JSON.stringify(analyzeDay(dateStr), null, 2));