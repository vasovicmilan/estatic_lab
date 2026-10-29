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
 * filter (libass), producing merged.<lang>.burned.mp4 (H.264) - unlike the
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
async function probeSize(file) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]);
  const [width, height] = stdout.trim().split("x").map(Number);
  return { width, height };
}

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

    const outPath = path.join(videoDir, `merged.${lang}.burned.mp4`);
    // ffmpeg's subtitles filter parses its argument as a mini filtergraph string,
    // where ":" separates the filter's own options - an absolute path is used (a
    // relative one would be resolved against ffmpeg's CWD, not this script's) and
    // its OWN colons (Windows drive letters, or just present on any OS in the
    // path in principle) have to be escaped so the filter doesn't misparse them
    // as ITS option separators.
    const absoluteVttPath = path.resolve(vttPath).replace(/\\/g, "/").replace(/:/g, "\\:");
    // Landscape (desktop) keeps the original look. Portrait (phone) videos are
    // upscaled 2x first. libass sizes force_style values in "script units" - for
    // converted .vtt that is a 288-unit-tall canvas (PlayResX follows the aspect
    // ratio) - NOT pixels, so the same "22" that suits a 1080p frame would be
    // about 13% of a 1688px-tall phone frame, i.e. huge. Values below are
    // therefore converted from the wanted pixel size: font PHONE_FONT_RATIO of the frame
    // width, thin outline, side margins so long sentences wrap into a few short
    // lines, and they sit in a black strip under the phone screen.
    const { width: vw, height: vh } = await probeSize(mergedPath);
    const portrait = vh > vw;
    let vf;
    if (portrait) {
      const w = vw * 2;
      const h = vh * 2;
      // captions live in a black strip added BELOW the phone screen, so they never
      // cover the page or its fixed bottom navigation bar
      const fontPx = w * PHONE_FONT_RATIO;
      // the strip is as tall as the LONGEST caption of this video needs (a long sentence at
      // this size wraps to ~10 short lines), never less than 30% / more than 42% of the phone
      // frame height. A caption still taller than the strip grows upward over the page bottom
      // rather than getting cut off.
      const vttText = await fs.readFile(vttPath, "utf8");
      const longest = Math.max(0, ...vttText.split(/\r?\n\r?\n/).map((cue) => cue.split(/\r?\n/).filter((l) => l && !l.includes("-->") && !/^\d+$/.test(l) && l !== "WEBVTT").join(" ").length));
      const charsPerLine = (w * 0.84) / (fontPx * 0.6); // DejaVu Sans averages ~0.6 em per character
      const neededLines = Math.ceil((longest / charsPerLine) * 1.15) + 1;
      const needed = neededLines * fontPx * 1.2 + h * 0.04;
      const strip = Math.round(Math.min(h * 0.42, Math.max(h * 0.3, needed)) / 2) * 2; // even: x264 needs even dimensions
      const fullH = h + strip;
      const unit = 288 / fullH; // pixels -> script units
      const fontSize = (fontPx * unit).toFixed(2);
      const outline = (3 * unit).toFixed(2);
      const playResX = Math.round(288 * (w / fullH));
      const sideMargin = Math.round(w * 0.08 * (playResX / w));
      const marginV = Math.round(strip * 0.12 * unit);
      const style = `FontName=DejaVu Sans,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=${outline},Shadow=0,Alignment=2,MarginL=${sideMargin},MarginR=${sideMargin},MarginV=${marginV}`;
      vf = `scale=${w}:${h}:flags=lanczos,pad=${w}:${fullH}:0:0:black,subtitles=${absoluteVttPath}:force_style='${style}'`;
    } else {
      const style = "FontName=DejaVu Sans,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=40";
      vf = `subtitles=${absoluteVttPath}:force_style='${style}'`;
    }

    // H.264 + yuv420p + faststart (moov atom at the front): plays in every browser incl. iOS
    // Safari, starts before the whole file is downloaded and supports seeking over HTTP Range -
    // exactly what the in-app tutorial section (src/routes/web/tutorial.routes.js) needs.
    // Also several times faster to encode than the VP8 the recorder produces. fps=30 forces a
    // CONSTANT frame rate: the recorder writes a variable-rate stream, and re-encoding it as-is
    // duplicates/drops frames unevenly, which shows up as stutter on phone videos.
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", mergedPath, "-vf", `${vf},fps=30`, "-c:v", "libx264", "-preset", X264_PRESET, "-crf", X264_CRF,
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", outPath],
      { maxBuffer: 1024 * 1024 * 64 }
    );
    console.log(`  [ok] videos/${scenarioId}/merged.${lang}.burned.mp4`);
  }
}

// Phone caption size as a share of the frame width. 0.045 and then 0.058 were still too small, the very first
// version (a raw 22 script units) far too large - this sits between. Tune only this.
// Override for a quick experiment: E2E_TUTORIAL_PHONE_FONT=0.08 npm run tutorials:burn
// x264 quality/speed. crf 22 is visually clean for screen recordings; a slower preset only makes
// files a little smaller. Override: E2E_TUTORIAL_X264_PRESET=medium E2E_TUTORIAL_X264_CRF=20
const X264_PRESET = process.env.E2E_TUTORIAL_X264_PRESET || "veryfast";
const X264_CRF = String(process.env.E2E_TUTORIAL_X264_CRF || 22);
const PHONE_FONT_RATIO = Number(process.env.E2E_TUTORIAL_PHONE_FONT || 0.07);

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
