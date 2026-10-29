import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * In-app tutorial videos ("Uputstva"). The videos themselves are produced by the
 * e2e-tutorials pipeline (`npm run tutorials:all`), whose last step
 * (e2e-tutorials/scripts/publish-videos.mjs) copies the finished, subtitled files and writes a
 * manifest.json into TUTORIALS_DIR - OUTSIDE src/public on purpose: express.static would serve
 * everything in a public folder to anybody who knows the URL, which defeats a per-role section.
 * Every file is therefore streamed through tutorial.controller.js, which asks this service
 * whether the current visitor may see it.
 *
 * Audiences (who a tutorial is FOR) and who sees them:
 *   public   - everybody, guests included
 *   user     - logged-in users
 *   partner  - partners (isPartner)
 *   employee - employees (isEmployee)
 *   admin    - administrators (permission "access_admin_panel", same rule as adminMiddleware)
 * A logged-in user always also sees "public" + "user"; an administrator sees everything.
 */
export const AUDIENCES = ["public", "user", "partner", "employee", "admin"];
export const DEVICES = ["desktop", "mobile"];
export const LANGS = ["sr", "en"];

export const AUDIENCE_LABELS = {
  public: "Za sve posetioce sajta",
  user: "Za prijavljene korisnike",
  partner: "Za partnere",
  employee: "Za zaposlene",
  admin: "Za administratore",
};

export function getTutorialsDir() {
  return process.env.TUTORIALS_DIR ? path.resolve(process.env.TUTORIALS_DIR) : path.resolve(__dirname, "..", "..", "storage", "tutorials");
}

/** Which audiences this visitor (req.user, or undefined for a guest) is allowed to see. */
export function audiencesForUser(user) {
  const allowed = new Set(["public"]);
  if (!user) return allowed;
  allowed.add("user");
  if (user.isPartner) allowed.add("partner");
  if (user.isEmployee) allowed.add("employee");
  if ((user.permissions || []).includes("access_admin_panel")) AUDIENCES.forEach((a) => allowed.add(a));
  return allowed;
}

export function canView(user, audience) {
  return audiencesForUser(user).has(audience);
}

let cache = { mtimeMs: 0, dir: null, manifest: { items: [] } };

/** manifest.json, re-read only when the file changed (a publish run replaces it atomically). */
export async function loadManifest() {
  const dir = getTutorialsDir();
  const file = path.join(dir, "manifest.json");
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return { items: [] };
  }
  if (cache.dir === dir && cache.mtimeMs === stat.mtimeMs) return cache.manifest;
  try {
    const parsed = await fs.readJson(file);
    cache = { mtimeMs: stat.mtimeMs, dir, manifest: { ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] } };
  } catch {
    return { items: [] };
  }
  return cache.manifest;
}

/** For tests: forget the cached manifest. */
export function resetTutorialCache() {
  cache = { mtimeMs: 0, dir: null, manifest: { items: [] } };
}

function pickText(obj, lang) {
  return (obj && (obj[lang] || obj.sr || obj.en)) || "";
}

/**
 * What the /uputstva page shows: only the tutorials this visitor may see, grouped by audience in
 * the fixed order above. Nothing about tutorials of other audiences leaves this function.
 */
export async function getCatalogForUser(user) {
  const manifest = await loadManifest();
  const allowed = audiencesForUser(user);
  const sections = [];
  for (const audience of AUDIENCES) {
    if (!allowed.has(audience)) continue;
    const items = manifest.items
      .filter((item) => item.audience === audience)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.id).localeCompare(String(b.id)))
      .map((item) => ({
        id: item.id,
        title: { sr: pickText(item.title, "sr"), en: pickText(item.title, "en") },
        intro: { sr: pickText(item.intro, "sr"), en: pickText(item.intro, "en") },
        variants: Object.fromEntries(
          DEVICES.filter((d) => item.variants?.[d]).map((d) => [
            d,
            { durationSec: item.variants[d].durationSec || 0, langs: LANGS.filter((l) => item.variants[d].files?.[l]), hasPoster: Boolean(item.variants[d].poster) },
          ])
        ),
      }))
      .filter((item) => Object.keys(item.variants).length > 0);
    if (items.length > 0) sections.push({ audience, label: AUDIENCE_LABELS[audience], items });
  }
  return { sections, total: sections.reduce((n, s) => n + s.items.length, 0) };
}

/**
 * Resolves one requested file to an absolute path, or null. id/device/lang/kind come from the URL and
 * are NEVER used to build a path - they only select an entry of the manifest, whose relative
 * file name is then checked to stay inside TUTORIALS_DIR (defense in depth).
 * Returns { absPath, contentType, audience } so the caller can check access.
 */
export async function resolveFile({ id, device, lang, kind }) {
  if (!DEVICES.includes(device)) return null;
  if (kind === "video" && !LANGS.includes(lang)) return null;
  const manifest = await loadManifest();
  const item = manifest.items.find((i) => i.id === id);
  const variant = item?.variants?.[device];
  if (!variant) return null;

  const relative = kind === "video" ? variant.files?.[lang] : variant.poster;
  if (!relative || typeof relative !== "string") return null;

  const dir = getTutorialsDir();
  const absPath = path.resolve(dir, relative);
  if (absPath !== dir && !absPath.startsWith(dir + path.sep)) return null;
  if (!(await fs.pathExists(absPath))) return null;

  return { absPath, contentType: kind === "video" ? "video/mp4" : "image/jpeg", audience: item.audience };
}
