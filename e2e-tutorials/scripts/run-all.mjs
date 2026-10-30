#!/usr/bin/env node
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

/**
 * One command for the whole tutorial pipeline:
 *
 *   1. record      playwright (every scenario, desktop + phone)          -> screenshots, videos, manifest
 *   2. subtitles   per-actor .vtt files
 *   3. merge       actors joined into one video + merged.<lang>.vtt
 *   4. burn        captions burned into the pixels (H.264 .mp4)
 *   5. docs        generated/<lang>/<id>.md
 *   6. publish     finished videos -> storage/tutorials (+ manifest) for the in-app /uputstva
 *
 * Usage:
 *   npm run tutorials:all                      everything
 *   npm run tutorials:all -- --only kupovina   record only scenarios whose name matches (regex), then finish
 *   npm run tutorials:all -- --scenario isplata-zaposlenom-mobilni --scenario radno-vreme-zaposlenog-mobilni
 *                                              EXACT scenario folder names (repeatable): only those are recorded and
 *                                              processed, everything already published stays as it is. Use this for new scenarios.
 *   npm run tutorials:all -- --skip-record     steps 2-6 only (videos already recorded)
 *
 * A failing scenario does NOT stop the pipeline: the remaining steps still run for everything that
 * did record, and the run ends with a list of failed scenarios and exit code 1. A failing step 2-6
 * stops immediately (those are bugs in the pipeline, not in one scenario).
 */
const args = process.argv.slice(2);
const SKIP_RECORD = args.includes("--skip-record");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const SCENARIOS = args.flatMap((a, i) => (a === "--scenario" && args[i + 1] ? [args[i + 1]] : []));

const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : m ? `${m} min ${String(r).padStart(2, "0")} s` : `${r} s`;
};

function run(cmd, cmdArgs, { allowFail = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: REPO, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  }).then((code) => {
    if (code !== 0 && !allowFail) throw new Error(`${cmd} ${cmdArgs.join(" ")} exited with code ${code}`);
    return code;
  });
}

async function preflight() {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    try {
      await execFileAsync(tool, ["-version"]);
    } catch {
      throw new Error(`${tool} not found in PATH - install ffmpeg first (the merge/burn/publish steps need it)`);
    }
  }
}

const timings = [];
async function phase(name, fn) {
  const t0 = Date.now();
  console.log(`\n=== ${name} ===`);
  try {
    return await fn();
  } finally {
    timings.push([name, Date.now() - t0]);
    console.log(`=== ${name}: ${fmt(Date.now() - t0)} ===`);
  }
}

async function main() {
  const start = Date.now();
  await preflight();
  let recordCode = 0;

  if (!SKIP_RECORD) {
    recordCode = await phase("1/6 record (Playwright)", () =>
      run(
        "npx",
        [
          "playwright", "test", "--config=playwright.tutorials.config.js",
          // a path filter (regex on the file path) selects exact scenario folders
          ...(SCENARIOS.length ? SCENARIOS.map((n) => `scenarios/${n}/`) : ONLY ? ["--grep", ONLY] : []),
        ],
        { allowFail: true }
      )
    );
  }

  const node = process.execPath;
  const script = (f) => path.join("e2e-tutorials", "scripts", f);
  // the four per-scenario scripts take ONE exact scenario folder name (or none = all)
  let targets = [undefined];
  if (SCENARIOS.length) {
    for (const n of SCENARIOS) {
      if (!(await fs.pathExists(path.join(REPO, "e2e-tutorials", "scenarios", n)))) throw new Error(`--scenario "${n}": no such folder in e2e-tutorials/scenarios`);
    }
    targets = SCENARIOS;
  } else if (ONLY) {
    const re = new RegExp(ONLY, "i");
    const names = (await fs.readdir(path.join(REPO, "e2e-tutorials", "scenarios"), { withFileTypes: true })).filter((d) => d.isDirectory() && re.test(d.name)).map((d) => d.name);
    if (names.length === 0) throw new Error(`--only "${ONLY}" matches no scenario folder`);
    targets = names;
  }
  const each = (file) => async () => {
    for (const t of targets) await run(node, [script(file), ...(t ? [t] : [])]);
  };
  await phase("2/6 subtitles", each("build-subtitles.mjs"));
  await phase("3/6 merge", each("merge-video.mjs"));
  await phase("4/6 burn captions", each("burn-subtitles.mjs"));
  await phase("5/6 docs", each("build-docs.mjs"));
  await phase("6/6 publish to /uputstva", () => run(node, [script("publish-videos.mjs"), ...(ONLY || SCENARIOS.length ? ["--keep-stale"] : [])]));

  console.log("\n--- Summary ---");
  for (const [name, ms] of timings) console.log(`  ${name.padEnd(28)} ${fmt(ms)}`);
  console.log(`  ${"TOTAL".padEnd(28)} ${fmt(Date.now() - start)}`);
  if (recordCode !== 0) {
    console.log("\nSome scenarios FAILED while recording (see the Playwright report above). Everything that recorded was still processed and published.");
    console.log("Re-run only the failed ones with: npm run tutorials:all -- --only \"<name>\"");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\nPipeline stopped: ${e.message}`);
  process.exit(1);
});
