#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const LANGS = ["sr", "en"];

/**
 * Renders captions PERMANENTLY into the video's pixels via ffmpeg's `subtitles`
 * filter (libass), producing merged.<lang>.burned.webm - unlike the
 * merged.webm + <track> pair build-docs.mjs otherwise embeds, this needs no
 * external .vtt file and no player-side "load subtitle track" step at all: any
 * player just plays it, captions included, because they ARE the video now.
 * Trade-off, and the reason this stays a SEPARATE opt-in script rather than
 * replacing the .vtt-based version outright: burned-in text can't be toggled
 * off, can't be styled/translated by a viewer's own player, and re-encoding
 * through libass costs real time - the .vtt-based version remains the right
 * choice for anyone editing/reviewing in VS Code's Markdown preview, this one
 * is for "hand someone a video file that just works everywhere."
 */
async function burnScenario(scenarioId) {
  const videoDir = path.join(ROOT, "videos", scenarioId);
  const mergedPath = path.join(videoDir, "merged.webm");

  if (!(await fs.pathExists(mergedPath))) {
    console.warn(`  [skip] ${scenarioId}: no merged.webm - run \`npm run tutorials:merge\` first`);
    return;
  }

  for (const lang of LANGS) {
    const vttPath = path.join(videoDir, `merged.${lang}.vtt`);
    if (!(await fs.pathExists(vttPath))) {
      console.warn(`  [skip] ${scenarioId}/${lang}: no merged.${lang}.vtt`);
      continue;
    }

    const outPath = path.join(videoDir, `merged.${lang}.burned.webm`);
    // ffmpeg's subtitles filter parses its argument as a mini filtergraph string,
    // where ":" separates the filter's own options - an absolute path is used (a
    // relative one would be resolved against ffmpeg's CWD, not this script's) and
    // its OWN colons (Windows drive letters, or just present on any OS in the
    // path in principle) have to be escaped so the filter doesn't misparse them
    // as ITS option separators.
    const absoluteVttPath = path.resolve(vttPath).replace(/\\/g, "/").replace(/:/g, "\\:");
    const style = "FontName=DejaVu Sans,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=40";

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", mergedPath, "-vf", `subtitles=${absoluteVttPath}:force_style='${style}'`, "-c:v", "libvpx", "-b:v", "2M", "-crf", "10", outPath],
      { maxBuffer: 1024 * 1024 * 64 }
    );
    console.log(`  [ok] videos/${scenarioId}/merged.${lang}.burned.webm`);
  }
}

async function main() {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    console.error("ffmpeg not found on PATH - install it first (e.g. `sudo apt install ffmpeg`).");
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

  console.log(`Burning subtitles for: ${targets.join(", ")}`);
  for (const id of targets) {
    await burnScenario(id);
  }
}

main();
