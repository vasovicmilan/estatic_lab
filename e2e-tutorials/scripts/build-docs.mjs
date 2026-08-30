#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const LANGS = ["sr", "en"];

/** "admin-potvrdjuje-termin" -> "Admin potvrdjuje termin" - a readable fallback
 * heading derived purely from the step id (kebab-case, ASCII-only since these ids
 * are also filenames), independent of language and independent of narration
 * prose content/punctuation. */
function idToHeading(id) {
  const words = id.split("-");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

/** Relative path from a markdown file's directory to an absolute target path,
 * always with forward slashes - markdown/HTML links need "/" even on a Windows
 * checkout, and `path.relative` returns "\\" there by default. */
function relativeLink(fromDir, toAbsolutePath) {
  return path.relative(fromDir, toAbsolutePath).split(path.sep).join("/");
}

/**
 * Turns one scenario's manifest.json (produced by tutorial.fixture.js at test
 * run time - the ordered list of {id, screenshot}) plus its hand-written
 * narration.json (title/intro/per-step text) into one markdown file per
 * language. Deliberately two separate inputs rather than one merged file:
 * manifest.json is machine-generated and safe to overwrite every run;
 * narration.json is hand-written prose that must never be touched by a test
 * run, only by a person editing the scenario's explanation.
 *
 * A step id present in manifest.json but missing from narration.json still
 * gets a heading and its screenshot (using the raw id as a fallback heading) -
 * loud and visible in the generated doc, rather than silently dropping that
 * step, so a scenario whose steps changed without narration.json being updated
 * to match is obvious on the next build rather than hidden.
 */
async function buildScenario(scenarioId) {
  const scenarioDir = path.join(SCENARIOS_DIR, scenarioId);
  const manifestPath = path.join(scenarioDir, "manifest.json");
  const narrationPath = path.join(scenarioDir, "narration.json");

  if (!(await fs.pathExists(manifestPath))) {
    console.warn(`  [skip] ${scenarioId}: no manifest.json - run this scenario's spec first (see README.md)`);
    return;
  }
  if (!(await fs.pathExists(narrationPath))) {
    console.warn(`  [skip] ${scenarioId}: no narration.json`);
    return;
  }

  const manifest = await fs.readJson(manifestPath);
  const narration = await fs.readJson(narrationPath);

  if (manifest.length === 0) {
    console.warn(`  [warn] ${scenarioId}: empty manifest.json (scenario likely failed before any tut.step() completed) - skipping`);
    return;
  }

  for (const lang of LANGS) {
    const title = narration.title?.[lang] || scenarioId;
    const intro = narration.intro?.[lang] || "";

    const outDir = path.join(ROOT, "generated", lang);
    await fs.ensureDir(outDir);

    const lines = [`# ${title}`, "", intro, ""];

    // Video(s), if this scenario recorded any (see e2e-tutorials/scripts/tutorial.fixture.js's
    // context override + newRecordedContext). Priority order:
    //   1. merged.<lang>.burned.webm (scripts/burn-subtitles.mjs) - captions are
    //      permanently part of the video's pixels, so this needs NO <track>, no
    //      external .vtt, and no "load subtitle track" step in any player - the
    //      whole reason this exists is a real workflow complaint (having to
    //      manually load the .vtt sidecar file in a media player every single
    //      time). One burned file per language, so the SR doc embeds the SR-burned
    //      video and the EN doc embeds the EN-burned one - never the same file in
    //      both.
    //   2. merged.webm (+ merged.<lang>.vtt) (scripts/merge-video.mjs) - one
    //      continuous video with a toggleable, editable subtitle track - the
    //      right choice for VS Code's Markdown preview where <track> works fine
    //      and re-encoding per language via burn-subtitles.mjs would be wasted
    //      effort.
    //   3. Per-actor video files listed separately (full-flow.webm,
    //      admin-flow.webm, ...) - fallback if merge-video.mjs hasn't run yet.
    // Not every scenario will have any of these (a run against an older
    // tutorial.fixture.js, or a scenario that failed before context.close() ran)
    // - silently omitted rather than a broken embed.
    const videoDir = path.join(ROOT, "videos", scenarioId);
    const burnedPath = path.join(videoDir, `merged.${lang}.burned.webm`);
    const mergedPath = path.join(videoDir, "merged.webm");
    if (await fs.pathExists(burnedPath)) {
      const relPath = relativeLink(outDir, burnedPath);
      lines.push(`<video src="${relPath}" controls width="720"></video>`);
      lines.push("");
      lines.push(`_titl je zapečen u video - ne treba spoljni .vtt fajl_`);
      lines.push("");
    } else if (await fs.pathExists(mergedPath)) {
      const relPath = relativeLink(outDir, mergedPath);
      lines.push(`<video src="${relPath}" controls width="720">`);
      const vttPath = path.join(videoDir, `merged.${lang}.vtt`);
      if (await fs.pathExists(vttPath)) {
        lines.push(`  <track kind="subtitles" src="${relativeLink(outDir, vttPath)}" srclang="${lang}" label="${lang === "sr" ? "Srpski" : "English"}" default>`);
      }
      lines.push(`</video>`);
      lines.push("");
    } else if (await fs.pathExists(videoDir)) {
      const videoFiles = (await fs.readdir(videoDir)).filter((f) => f.endsWith(".webm")).sort();
      for (const videoFile of videoFiles) {
        const label = path.basename(videoFile, ".webm");
        const relPath = relativeLink(outDir, path.join(videoDir, videoFile));
        lines.push(`<video src="${relPath}" controls width="720">`);

        // <track> for this language's subtitles, if scripts/build-subtitles.mjs
        // has been run - it reads manifest.json's videoOffsetMs (written by
        // tutorial.fixture.js's tut.step()) to time each cue.
        const vttPath = path.join(videoDir, `${label}.${lang}.vtt`);
        if (await fs.pathExists(vttPath)) {
          const vttRelPath = relativeLink(outDir, vttPath);
          lines.push(`  <track kind="subtitles" src="${vttRelPath}" srclang="${lang}" label="${lang === "sr" ? "Srpski" : "English"}" default>`);
        }

        lines.push(`</video>`);
        lines.push("");
        lines.push(`_${label}_`);
        lines.push("");
      }
    }

    manifest.forEach((step, index) => {
      const stepText = narration.steps?.[step.id]?.[lang];
      // Heading: an explicit narration.steps.<id>.heading.<lang> wins (step ids
      // are written in Serbian, so the English doc would otherwise show Serbian
      // headings like "Registracija i prijava" with English body text under
      // them) - falls back to a heading derived from the step id itself, never
      // from slicing stepText at the first "." (narration prose routinely
      // contains abbreviations like "npr."/"tj." that aren't sentence ends, so a
      // naive split(".")[0] truncates mid-thought - caught by this script's own
      // dry-run against a hand-built manifest before this fix).
      const heading = narration.steps?.[step.id]?.heading?.[lang] || idToHeading(step.id);
      lines.push(`## ${index + 1}. ${heading}`);
      lines.push("");
      if (stepText) {
        lines.push(stepText);
        lines.push("");
      } else {
        const missingNote = lang === "sr" ? `_(nedostaje tekst za korak "${step.id}" u narration.json)_` : `_(missing narration for step "${step.id}" in narration.json)_`;
        lines.push(missingNote);
        lines.push("");
      }
      lines.push(`![${step.id}](${relativeLink(outDir, path.join(ROOT, step.screenshot))})`);
      lines.push("");
    });

    const outPath = path.join(outDir, `${scenarioId}.md`);
    await fs.writeFile(outPath, lines.join("\n"));
    console.log(`  [ok] generated/${lang}/${scenarioId}.md`);
  }
}

async function main() {
  const entries = await fs.readdir(SCENARIOS_DIR, { withFileTypes: true });
  const scenarioIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const only = process.argv[2]; // optional: build-docs.mjs <scenario-id> to build just one
  const targets = only ? scenarioIds.filter((id) => id === only) : scenarioIds;

  if (targets.length === 0) {
    console.error(only ? `No scenario folder named "${only}" under e2e-tutorials/scenarios/` : "No scenario folders found under e2e-tutorials/scenarios/");
    process.exit(1);
  }

  console.log(`Building docs for: ${targets.join(", ")}`);
  for (const id of targets) {
    await buildScenario(id);
  }
}

main();
