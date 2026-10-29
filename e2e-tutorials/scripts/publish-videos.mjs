#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { loadNarration } from "./lib/narration.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPO = path.resolve(ROOT, "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const VIDEOS_DIR = path.join(ROOT, "videos");
const LANGS = ["sr", "en"];
const AUDIENCES = ["public", "user", "partner", "employee", "admin"];

/**
 * Last step of the pipeline: copies ONLY the finished videos (captions burned into the pixels,
 * merged.<lang>.burned.mp4) into the folder the app serves through role-checked routes
 * (/uputstva - see src/services/tutorial-video.service.js), plus a poster frame and a
 * manifest.json. The folder is deliberately outside src/public (express.static would hand every
 * file to anyone who knows the URL). Default: <repo>/storage/tutorials, override with
 * TUTORIALS_DIR (same variable the app reads) or --out <dir>.
 *
 * Safe to re-run: files are written next to the final name and renamed into place, the manifest
 * is replaced last and atomically, and tutorials that no longer exist are removed (--keep-stale
 * to leave them). A scenario whose video is missing is skipped with a warning, it never produces
 * a half entry.
 */
const args = process.argv.slice(2);
const outArgIdx = args.indexOf("--out");
const OUT_DIR = path.resolve(outArgIdx >= 0 ? args[outArgIdx + 1] : process.env.TUTORIALS_DIR || path.join(REPO, "storage", "tutorials"));
const KEEP_STALE = args.includes("--keep-stale");

async function durationSec(file) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const s = Number.parseFloat(stdout.trim());
  return Number.isFinite(s) ? Math.round(s) : 0;
}

async function makePoster(videoFile, posterFile, atSec) {
  const tmp = `${posterFile}.tmp.jpg`;
  await execFileAsync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(atSec), "-i", videoFile, "-frames:v", "1", "-vf", "scale='min(640,iw)':-2", "-q:v", "4", tmp]);
  await fs.move(tmp, posterFile, { overwrite: true });
}

async function copyAtomic(src, dest) {
  const tmp = `${dest}.tmp`;
  await fs.copy(src, tmp, { overwrite: true });
  await fs.move(tmp, dest, { overwrite: true });
}

async function publishVariant(baseId, scenarioId, device) {
  const dir = path.join(VIDEOS_DIR, scenarioId);
  const files = {};
  let firstVideo = null;
  for (const lang of LANGS) {
    const src = path.join(dir, `merged.${lang}.burned.mp4`);
    if (!(await fs.pathExists(src))) continue;
    const rel = `${baseId}/${device}.${lang}.mp4`;
    await copyAtomic(src, path.join(OUT_DIR, rel));
    files[lang] = rel;
    firstVideo ||= src;
  }
  if (!firstVideo) return null;

  const dur = await durationSec(firstVideo);
  const posterRel = `${baseId}/${device}.jpg`;
  let poster = null;
  try {
    await makePoster(firstVideo, path.join(OUT_DIR, posterRel), Math.min(2, Math.max(0, dur / 4)));
    poster = posterRel;
  } catch (e) {
    console.warn(`  [warn] ${scenarioId}: poster not created (${e.message.split("\n")[0]})`);
  }
  return { durationSec: dur, files, poster };
}

async function main() {
  const audience = (await fs.readJson(path.join(ROOT, "audience.json"))).scenarios || {};
  const dirs = (await fs.readdir(SCENARIOS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const baseIds = [...new Set(dirs.map((d) => d.replace(/-mobilni$/, "")))];
  const order = Object.keys(audience);
  baseIds.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });

  await fs.ensureDir(OUT_DIR);
  const items = [];

  for (const baseId of baseIds) {
    const variants = {};
    const desktop = await publishVariant(baseId, baseId, "desktop");
    if (desktop) variants.desktop = desktop;
    if (dirs.includes(`${baseId}-mobilni`)) {
      const mobile = await publishVariant(baseId, `${baseId}-mobilni`, "mobile");
      if (mobile) variants.mobile = mobile;
    }
    if (Object.keys(variants).length === 0) {
      console.warn(`  [skip] ${baseId}: no merged.<lang>.burned.mp4 (run the burn step first)`);
      continue;
    }

    let who = audience[baseId];
    if (!AUDIENCES.includes(who)) {
      console.warn(`  [warn] ${baseId}: not listed in audience.json (or invalid) - published as "admin" (visible to administrators only)`);
      who = "admin";
    }
    const narration = await loadNarration(baseId).catch(() => ({}));
    items.push({
      id: baseId,
      audience: who,
      order: items.length + 1,
      title: { sr: narration.title?.sr || baseId, en: narration.title?.en || narration.title?.sr || baseId },
      intro: { sr: narration.intro?.sr || "", en: narration.intro?.en || narration.intro?.sr || "" },
      variants,
    });
    console.log(`  [ok] ${baseId} (${who}): ${Object.keys(variants).join(" + ")}`);
  }

  if (!KEEP_STALE) {
    const keep = new Set(items.map((i) => i.id));
    for (const entry of await fs.readdir(OUT_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && !keep.has(entry.name)) {
        await fs.remove(path.join(OUT_DIR, entry.name));
        console.log(`  [removed] ${entry.name} (no longer a scenario)`);
      }
    }
  }

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  await fs.writeJson(`${manifestPath}.tmp`, { generatedAt: new Date().toISOString(), items }, { spaces: 2 });
  await fs.move(`${manifestPath}.tmp`, manifestPath, { overwrite: true });

  const perAudience = AUDIENCES.map((a) => `${a}: ${items.filter((i) => i.audience === a).length}`).join(", ");
  console.log(`Published ${items.length} tutorial(s) to ${OUT_DIR}\n  ${perAudience}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
