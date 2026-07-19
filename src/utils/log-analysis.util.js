import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, "..", "..", "logs");

// Must match logger.config.js's own naming exactly: app.log/error.log/http.log in
// production, app-dev.log/etc. otherwise. This file previously always searched for
// the production-style name regardless of NODE_ENV - if the running server process
// wasn't actually started with NODE_ENV=production (e.g. PM2 launched directly on
// src/server.js instead of through the npm "start" script), the logger would be
// writing app-dev.<date>.*.log while this searched for app.<date>.*.log, guaranteeing
// zero matches on every single report regardless of how much real traffic/errors
// there actually was.
const IS_PROD = process.env.NODE_ENV === "production";
const baseFileName = (name) => (IS_PROD ? name : `${name}-dev`);

// logger.config.js's custom formatters.level() writes the string label
// ("info"/"warn"/"error"), not pino's default numeric level - match that.
const LEVEL_INFO = "info";
const LEVEL_WARN = "warn";
const LEVEL_ERROR = "error";

// production morgan format from morgan.config.js:
// '[:date[iso]] :method :url :status :res[content-length] - :response-time ms - :remote-addr - ":user-agent"'
const HTTP_LINE_RE =
  /^\[([^\]]+)\]\s+(\S+)\s+(\S+)\s+(\d{3})\s+(\S+)\s+-\s+([\d.]+)\s+ms\s+-\s+(\S+)\s+-\s+"(.*)"$/;

function findLogFiles(baseName, dateStr) {
  if (!fs.existsSync(LOGS_DIR)) return [];
  const prefix = `${baseName}.${dateStr}.`;
  return fs
    .readdirSync(LOGS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".log"))
    .map((f) => path.join(LOGS_DIR, f));
}

function readJsonLines(filePath) {
  const lines = [];
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return lines;
  }

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      // malformed/partial line (e.g. process was mid-write) - skip it, one bad
      // line shouldn't sink the whole day's report
    }
  }
  return lines;
}

function bucketStatus(status) {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500) return "5xx";
  return null;
}

function topN(countMap, n = 10) {
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * Analyzes a single calendar day's rotated log files and returns the aggregate shape
 * LogSummary stores. Returns 0/empty fields if no log files exist for that day (e.g.
 * the app wasn't running, or logs were already cleaned up past retention).
 */
/**
 * Raw, human-readable text of every app/error/http log line for a given day,
 * concatenated in one file - a backup/audit trail attached to the daily report email,
 * independent of the aggregated LogSummary in the database. Not parsed or filtered -
 * exactly what was written that day, so it's useful even if analyzeDay's own parsing
 * logic has a bug or misses something.
 */
export function getRawLogTextForDate(dateStr) {
  const sections = [
    { label: "APP/ERROR LOG", baseName: baseFileName("app") },
    { label: "HTTP LOG", baseName: baseFileName("http") },
  ];

  const parts = [`Raw logs for ${dateStr}\n${"=".repeat(40)}`];
  for (const { label, baseName } of sections) {
    const files = findLogFiles(baseName, dateStr);
    parts.push(`\n--- ${label} (${files.length} file(s)) ---\n`);
    if (files.length === 0) {
      parts.push("(no files found for this date)\n");
      continue;
    }
    for (const file of files) {
      try {
        parts.push(fs.readFileSync(file, "utf8"));
      } catch (error) {
        parts.push(`(failed to read ${file}: ${error.message})\n`);
      }
    }
  }
  return parts.join("\n");
}

export function analyzeDay(dateStr) {
  const appLines = findLogFiles(baseFileName("app"), dateStr).flatMap(readJsonLines);
  const httpLines = findLogFiles(baseFileName("http"), dateStr).flatMap(readJsonLines);

  let infoCount = 0;
  let warnCount = 0;
  let errorCount = 0;
  const errorCounts = new Map();

  for (const entry of appLines) {
    if (entry.level === LEVEL_ERROR) {
      errorCount += 1;
      const label = entry.error?.message || entry.msg || "Nepoznata greška";
      increment(errorCounts, label);
    } else if (entry.level === LEVEL_WARN) {
      warnCount += 1;
    } else if (entry.level === LEVEL_INFO) {
      infoCount += 1;
    }
  }

  let total = 0;
  const byStatusClass = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  const ips = new Set();
  const urlCounts = new Map();
  const errorUrlCounts = new Map();

  for (const entry of httpLines) {
    const match = HTTP_LINE_RE.exec(entry.msg || "");
    if (!match) continue;

    const [, , method, url, statusStr, , , ip] = match;
    const status = parseInt(statusStr, 10);
    const statusClass = bucketStatus(status);
    if (!statusClass) continue;

    total += 1;
    byStatusClass[statusClass] += 1;
    if (ip && ip !== "-") ips.add(ip);

    const urlKey = `${method} ${url}`;
    increment(urlCounts, urlKey);
    if (statusClass === "4xx" || statusClass === "5xx") {
      increment(errorUrlCounts, `${status} ${urlKey}`);
    }
  }

  return {
    requests: {
      total,
      byStatusClass,
      uniqueIPs: ips.size,
    },
    logs: { infoCount, warnCount, errorCount },
    topErrors: topN(errorCounts),
    topUrls: topN(urlCounts),
    topErrorUrls: topN(errorUrlCounts),
  };
}

export default { analyzeDay };