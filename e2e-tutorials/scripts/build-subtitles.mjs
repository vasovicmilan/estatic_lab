#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { groupStepsByVideo, formatVttTime } from "./lib/subtitle-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const LANGS = ["sr", "en"];

// How long the LAST cue in a given video lingers on screen - there's no "next
// step" timestamp to end it at, so this is a plain guess rather than measured
// against the video's real total duration (that would mean shelling out to
// ffprobe here, an extra dependency this script doesn't otherwise need).
// merge-video.mjs, which already needs ffmpeg for the actual video work, DOES
// know each video's real duration and uses that instead of this guess.
const TAIL_MS = 3000;


/**
 * Turns one scenario's manifest.json (each step now carries `video` - which
 * recording it belongs to, "full-flow" / "admin-flow" / etc. - and
 * `videoOffsetMs` - milliseconds into THAT recording when the step's end-state
 * was reached, both written by tutorial.fixture.js's tut.step()) plus
 * narration.json's per-step text into one WebVTT file per video per language.
 *
 * Grouped by `video` label, not flattened into one timeline - a scenario with a
 * second actor (admin) has a SEPARATE recording with its own start time (see
 * newRecordedContext), so its steps' offsets are only meaningful against that
 * video, never against the main page's.
 */
async function buildScenario(scenarioId) {
  const scenarioDir = path.join(SCENARIOS_DIR, scenarioId);
  const manifestPath = path.join(scenarioDir, "manifest.json");
  const narrationPath = path.join(scenarioDir, "narration.json");

  if (!(await fs.pathExists(manifestPath)) || !(await fs.pathExists(narrationPath))) {
    console.warn(`  [skip] ${scenarioId}: missing manifest.json or narration.json - run this scenario's spec first`);
    return;
  }

  const manifest = await fs.readJson(manifestPath);
  const narration = await fs.readJson(narrationPath);

  if (manifest.length === 0) {
    console.warn(`  [skip] ${scenarioId}: empty manifest.json`);
    return;
  }
  if (manifest[0].videoOffsetMs === undefined) {
    console.warn(`  [skip] ${scenarioId}: manifest.json has no videoOffsetMs - re-run this scenario's spec against the current tutorial.fixture.js to regenerate it`);
    return;
  }

  const byVideo = groupStepsByVideo(manifest);

  const videosDir = path.join(ROOT, "videos", scenarioId);
  await fs.ensureDir(videosDir);

  for (const [label, steps] of byVideo) {
    for (const lang of LANGS) {
      const lines = ["WEBVTT", ""];
      steps.forEach((step, i) => {
        const startMs = step.videoOffsetMs ?? 0;
        const nextStartMs = i + 1 < steps.length ? steps[i + 1].videoOffsetMs : startMs + TAIL_MS;
        const endMs = Math.max(startMs + 500, nextStartMs); // guards against a zero/negative-length cue if two steps somehow land on the same ms
        const text = narration.steps?.[step.id]?.[lang] || step.id;
        lines.push(String(i + 1));
        lines.push(`${formatVttTime(startMs)} --> ${formatVttTime(endMs)}`);
        lines.push(text);
        lines.push("");
      });

      const outPath = path.join(videosDir, `${label}.${lang}.vtt`);
      await fs.writeFile(outPath, lines.join("\n"));
      console.log(`  [ok] videos/${scenarioId}/${label}.${lang}.vtt`);
    }
  }
}

async function main() {
  const entries = await fs.readdir(SCENARIOS_DIR, { withFileTypes: true });
  const scenarioIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const only = process.argv[2];
  const targets = only ? scenarioIds.filter((id) => id === only) : scenarioIds;

  if (targets.length === 0) {
    console.error(only ? `No scenario folder named "${only}" under e2e-tutorials/scenarios/` : "No scenario folders found under e2e-tutorials/scenarios/");
    process.exit(1);
  }

  console.log(`Building subtitles for: ${targets.join(", ")}`);
  for (const id of targets) {
    await buildScenario(id);
  }
}

main();
