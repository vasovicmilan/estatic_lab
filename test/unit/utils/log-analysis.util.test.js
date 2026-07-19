import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeDay, getRawLogTextForDate } from "../../../src/utils/log-analysis.util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, "..", "..", "..", "logs");
// NODE_ENV=test (see .env.test) means the logger writes the "-dev" suffixed
// filenames - has to match exactly what analyzeDay is actually looking for
const IS_PROD = process.env.NODE_ENV === "production";
const baseFileName = (name) => (IS_PROD ? name : `${name}-dev`);

const TEST_DATE = "2099-01-01"; // far enough in the future to never collide with real logs

function writeLogFile(kind, lines) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const filePath = path.join(LOGS_DIR, `${baseFileName(kind)}.${TEST_DATE}.1.log`);
  fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return filePath;
}

function cleanupTestLogFiles() {
  if (!fs.existsSync(LOGS_DIR)) return;
  for (const f of fs.readdirSync(LOGS_DIR)) {
    if (f.includes(TEST_DATE)) fs.unlinkSync(path.join(LOGS_DIR, f));
  }
}

describe("log-analysis.util", () => {
  beforeEach(cleanupTestLogFiles);
  afterEach(cleanupTestLogFiles);

  describe("analyzeDay", () => {
    it("returns all-zero results when no log files exist for the date", () => {
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.requests.total, 0);
      assert.equal(result.logs.errorCount, 0);
      assert.deepEqual(result.topErrors, []);
    });

    it("counts info/warn/error lines from the app log by level", () => {
      writeLogFile("app", [
        { level: "info", time: new Date().toISOString(), msg: "Server running" },
        { level: "warn", time: new Date().toISOString(), msg: "Something questionable" },
        { level: "error", time: new Date().toISOString(), msg: "Something broke" },
        { level: "error", time: new Date().toISOString(), msg: "Something broke" },
      ]);

      const result = analyzeDay(TEST_DATE);
      assert.equal(result.logs.infoCount, 1);
      assert.equal(result.logs.warnCount, 1);
      assert.equal(result.logs.errorCount, 2);
    });

    it("groups identical error messages together in topErrors with a count", () => {
      writeLogFile("app", [
        { level: "error", time: new Date().toISOString(), msg: "DB timeout" },
        { level: "error", time: new Date().toISOString(), msg: "DB timeout" },
        { level: "error", time: new Date().toISOString(), msg: "Different error" },
      ]);

      const result = analyzeDay(TEST_DATE);
      const dbTimeout = result.topErrors.find((e) => e.label === "DB timeout");
      assert.equal(dbTimeout.count, 2);
    });

    it("prefers error.message over msg when both are present (pino error-serializer shape)", () => {
      writeLogFile("app", [{ level: "error", time: new Date().toISOString(), msg: "Unhandled error [abc]", error: { message: "Real underlying message" } }]);
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.topErrors[0].label, "Real underlying message");
    });

    it("parses http log lines and buckets by status class", () => {
      const iso = new Date().toISOString();
      writeLogFile("http", [
        { level: "info", time: iso, type: "http", msg: `[${iso}] GET /prodavnica 200 1234 - 12.3 ms - 1.2.3.4 - "Mozilla/5.0"` },
        { level: "info", time: iso, type: "http", msg: `[${iso}] GET /admin 302 50 - 5.0 ms - 1.2.3.4 - "Mozilla/5.0"` },
        { level: "info", time: iso, type: "http", msg: `[${iso}] GET /nepostojeca 404 200 - 2.0 ms - 5.6.7.8 - "curl/8"` },
        { level: "info", time: iso, type: "http", msg: `[${iso}] GET /crash 500 100 - 1.0 ms - 5.6.7.8 - "curl/8"` },
      ]);

      const result = analyzeDay(TEST_DATE);
      assert.equal(result.requests.total, 4);
      assert.equal(result.requests.byStatusClass["2xx"], 1);
      assert.equal(result.requests.byStatusClass["3xx"], 1);
      assert.equal(result.requests.byStatusClass["4xx"], 1);
      assert.equal(result.requests.byStatusClass["5xx"], 1);
    });

    it("counts unique IPs, not total requests", () => {
      const iso = new Date().toISOString();
      writeLogFile("http", [
        { level: "info", time: iso, msg: `[${iso}] GET / 200 100 - 1.0 ms - 1.1.1.1 - "UA"` },
        { level: "info", time: iso, msg: `[${iso}] GET /a 200 100 - 1.0 ms - 1.1.1.1 - "UA"` },
        { level: "info", time: iso, msg: `[${iso}] GET /b 200 100 - 1.0 ms - 2.2.2.2 - "UA"` },
      ]);
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.requests.uniqueIPs, 2);
    });

    it("ranks topUrls by request count, most-hit first", () => {
      const iso = new Date().toISOString();
      writeLogFile("http", [
        { level: "info", time: iso, msg: `[${iso}] GET /prodavnica 200 1 - 1 ms - 1.1.1.1 - "UA"` },
        { level: "info", time: iso, msg: `[${iso}] GET /prodavnica 200 1 - 1 ms - 1.1.1.1 - "UA"` },
        { level: "info", time: iso, msg: `[${iso}] GET / 200 1 - 1 ms - 1.1.1.1 - "UA"` },
      ]);
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.topUrls[0].label, "GET /prodavnica");
      assert.equal(result.topUrls[0].count, 2);
    });

    it("collects 4xx/5xx into topErrorUrls but not 2xx/3xx", () => {
      const iso = new Date().toISOString();
      writeLogFile("http", [
        { level: "info", time: iso, msg: `[${iso}] GET /ok 200 1 - 1 ms - 1.1.1.1 - "UA"` },
        { level: "info", time: iso, msg: `[${iso}] GET /missing 404 1 - 1 ms - 1.1.1.1 - "UA"` },
      ]);
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.topErrorUrls.length, 1);
      assert.equal(result.topErrorUrls[0].label, "404 GET /missing");
    });

    it("skips malformed/unparseable lines instead of throwing", () => {
      const filePath = writeLogFile("app", [{ level: "info", time: new Date().toISOString(), msg: "valid line" }]);
      fs.appendFileSync(filePath, "not valid json at all\n");

      // should not throw
      const result = analyzeDay(TEST_DATE);
      assert.equal(result.logs.infoCount, 1, "the one valid line should still be counted");
    });
  });

  describe("getRawLogTextForDate", () => {
    it("includes the raw content of matching files verbatim", () => {
      writeLogFile("app", [{ level: "info", time: new Date().toISOString(), msg: "unique-marker-xyz" }]);
      const text = getRawLogTextForDate(TEST_DATE);
      assert.match(text, /unique-marker-xyz/);
    });

    it("notes when no files were found for a section instead of silently omitting it", () => {
      const text = getRawLogTextForDate(TEST_DATE);
      assert.match(text, /no files found/);
    });
  });
});