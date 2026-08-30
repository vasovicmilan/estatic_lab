#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { formatVttTime } from "./lib/subtitle-utils.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const LANGS = ["sr", "en"];

// how long a run's trimmed segment extends past its own last step's timestamp -
// same idea as tutorial.fixture.js's STEP_PAUSE_MS, just applied at the video-clip
// level instead of the caption level, so the cut to the next actor doesn't happen
// mid-breath on the last caption of a run.
const RUN_TAIL_MS = 3000;

async function ffprobeDurationMs(filePath) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe returned an unparseable duration for ${filePath}: "${stdout.trim()}"`);
  return Math.round(seconds * 1000);
}

/**
 * Splits manifest.json (already in true chronological order - it's written in the
 * exact sequence tut.step() calls happened, across BOTH/every actor) into "runs":
 * maximal consecutive stretches of steps belonging to the SAME video. A scenario
 * where one actor's entire part happens before the other's (zakazivanje-termina,
 * kupovina-paketa) produces exactly 2 runs, one per video - concatenating those
 * gives the same result the old label-grouping approach did. A scenario where
 * actors interleave (dostava-velikog-artikla: customer -> admin -> customer again)
 * produces 3+ runs, and THIS is what the old approach got wrong: it grouped by
 * label first, silently collapsing "customer, admin, customer" into "customer,
 * customer, admin" - showing the customer's final confirmation before the admin
 * had even set a price, which never happened in that order in reality.
 */
function splitIntoRuns(manifest) {
  const runs = [];
  for (const step of manifest) {
    const label = step.video || "full-flow";
    const currentRun = runs[runs.length - 1];
    if (currentRun && currentRun.label === label) {
      currentRun.steps.push(step);
    } else {
      runs.push({ label, steps: [step] });
    }
  }
  return runs;
}

/**
 * Merges one scenario's separate per-actor videos into a single
 * videos/<scenario>/merged.webm, preserving the TRUE chronological order of the
 * narrative (see splitIntoRuns) rather than assuming one actor's footage always
 * comes entirely before the other's.
 *
 * Each run becomes one trimmed clip of its source video - [run's first step's
 * offset, run's last step's offset + RUN_TAIL_MS] - and every clip is concatenated
 * in run order via a single ffmpeg -filter_complex (trim+setpts per segment, then
 * concat), one process invocation rather than writing N intermediate files and a
 * separate concat pass.
 */
async function mergeScenario(scenarioId) {
  const scenarioDir = path.join(SCENARIOS_DIR, scenarioId);
  const manifestPath = path.join(scenarioDir, "manifest.json");
  const videosDir = path.join(ROOT, "videos", scenarioId);

  if (!(await fs.pathExists(manifestPath))) {
    console.warn(`  [skip] ${scenarioId}: no manifest.json - run this scenario's spec first`);
    return;
  }
  const manifest = await fs.readJson(manifestPath);
  if (manifest.length === 0 || manifest[0].videoOffsetMs === undefined) {
    console.warn(`  [skip] ${scenarioId}: manifest.json missing or has no videoOffsetMs - re-run this scenario's spec against the current tutorial.fixture.js`);
    return;
  }

  const runs = splitIntoRuns(manifest);
  const distinctLabels = [...new Set(runs.map((r) => r.label))];

  const videoPathByLabel = Object.fromEntries(distinctLabels.map((label) => [label, path.join(videosDir, `${label}.webm`)]));
  const missing = distinctLabels.filter((label) => !fs.existsSync(videoPathByLabel[label]));
  if (missing.length > 0) {
    console.warn(`  [skip] ${scenarioId}: manifest.json references video(s) [${missing.join(", ")}] with no matching .webm file in videos/${scenarioId}/ - run the full scenario (not a partial/manual manifest) first`);
    return;
  }

  // real duration per DISTINCT video (not per run - a video can span multiple
  // runs if actors alternate more than once) - used to clamp a run's trim-end so
  // it never reads past what was actually recorded.
  const durationByLabel = {};
  for (const label of distinctLabels) {
    durationByLabel[label] = await ffprobeDurationMs(videoPathByLabel[label]);
  }

  if (runs.length === 1) {
    // single actor, nothing to interleave - the video already IS the merged video.
    await fs.copy(videoPathByLabel[runs[0].label], path.join(videosDir, "merged.webm"), { overwrite: true });
    console.log(`  [ok] ${scenarioId}: single actor (${runs[0].label}) - copied as merged.webm, nothing to interleave`);
  } else {
    console.log(`  merging ${scenarioId} in true chronological order: ${runs.map((r) => r.label).join(" -> ")}`);

    const inputLabels = distinctLabels; // fixed order for ffmpeg -i args / [N:v] refs
    const inputArgs = inputLabels.flatMap((label) => ["-i", videoPathByLabel[label]]);

    const filterParts = [];
    const segmentNames = [];
    runs.forEach((run, i) => {
      const inputIndex = inputLabels.indexOf(run.label);
      const startMs = run.steps[0].videoOffsetMs;
      const lastStepMs = run.steps[run.steps.length - 1].videoOffsetMs;
      const endMs = Math.min(lastStepMs + RUN_TAIL_MS, durationByLabel[run.label]);
      const startSec = (startMs / 1000).toFixed(3);
      const endSec = (Math.max(endMs, startMs + 500) / 1000).toFixed(3); // guard against a zero/negative-length trim
      const seg = `s${i}`;
      filterParts.push(`[${inputIndex}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS[${seg}]`);
      segmentNames.push(`[${seg}]`);
      run._trimStartMs = startMs; // stashed for the subtitle pass below
      run._trimEndMs = Number(endSec) * 1000;
    });
    filterParts.push(`${segmentNames.join("")}concat=n=${runs.length}:v=1:a=0[outv]`);
    const filter = filterParts.join(";");

    const outPath = path.join(videosDir, "merged.webm");
    await execFileAsync("ffmpeg", ["-y", ...inputArgs, "-filter_complex", filter, "-map", "[outv]", "-c:v", "libvpx", "-b:v", "2M", "-crf", "10", outPath], { maxBuffer: 1024 * 1024 * 64 });
    console.log(`  [ok] videos/${scenarioId}/merged.webm`);
  }

  // --- merged subtitles: each run's steps repositioned onto the CONCATENATED
  // timeline (cumulative duration of every run before it + this step's offset
  // relative to its own run's trim start) - not the old version's per-video
  // cumulative offset, which assumed each video contributed exactly one
  // contiguous block.
  const narrationPath = path.join(scenarioDir, "narration.json");
  const narration = (await fs.pathExists(narrationPath)) ? await fs.readJson(narrationPath) : { steps: {} };

  if (runs.length === 1) {
    // single-actor case never went through the trim loop above, so _trimStartMs
    // wasn't set - the run's own steps already ARE on the merged (=original)
    // timeline unchanged.
    runs[0]._trimStartMs = 0;
    runs[0]._trimEndMs = durationByLabel[runs[0].label];
  }

  for (const lang of LANGS) {
    const lines = ["WEBVTT", ""];
    let cueIndex = 0;
    let cumulativeMs = 0;
    for (const run of runs) {
      const runDurationMs = run._trimEndMs - run._trimStartMs;
      run.steps.forEach((step, i) => {
        const startMs = cumulativeMs + (step.videoOffsetMs - run._trimStartMs);
        const nextStartMs = i + 1 < run.steps.length ? cumulativeMs + (run.steps[i + 1].videoOffsetMs - run._trimStartMs) : cumulativeMs + runDurationMs;
        const endMs = Math.max(startMs + 500, nextStartMs);
        const text = narration.steps?.[step.id]?.[lang] || step.id;
        cueIndex += 1;
        lines.push(String(cueIndex));
        lines.push(`${formatVttTime(startMs)} --> ${formatVttTime(endMs)}`);
        lines.push(text);
        lines.push("");
      });
      cumulativeMs += runDurationMs;
    }
    const outPath = path.join(videosDir, `merged.${lang}.vtt`);
    await fs.writeFile(outPath, lines.join("\n"));
    console.log(`  [ok] videos/${scenarioId}/merged.${lang}.vtt`);
  }
}

async function main() {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await execFileAsync("ffprobe", ["-version"]);
  } catch {
    console.error("ffmpeg/ffprobe not found on PATH - install ffmpeg (e.g. `sudo apt install ffmpeg` on the server, or the equivalent for your OS) before running this script.");
    process.exit(1);
  }

  const entries = await fs.readdir(SCENARIOS_DIR, { withFileTypes: true });
  const scenarioIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const only = process.argv[2];
  const targets = only ? scenarioIds.filter((id) => id === only) : scenarioIds;

  if (targets.length === 0) {
    console.error(only ? `No scenario folder named "${only}" under e2e-tutorials/scenarios/` : "No scenario folders found under e2e-tutorials/scenarios/");
    process.exit(1);
  }

  console.log(`Merging video for: ${targets.join(", ")}`);
  for (const id of targets) {
    await mergeScenario(id);
  }
}

main();

