import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const COMMON_PATH = path.join(ROOT, "common-narration.json");

/**
 * Scenario ids ending in "-mobilni" are the phone recordings (see README, "Mobilni
 * tutorijali"). Used to pick the phone wording of shared narration.
 */
export function deviceOf(scenarioId) {
  return scenarioId.endsWith("-mobilni") ? "mobile" : "desktop";
}

// Verbs that differ between a mouse and a finger. A narration text writes the token,
// this module swaps in the right wording for the scenario's device. Only these exact
// tokens are replaced - any other "{...}" in a text is left untouched.
const TOKENS = {
  desktop: {
    "{klikcemo}": "klikćemo",
    "{kliknemo}": "kliknemo",
    "{Kliknemo}": "Kliknemo",
    "{klik}": "klik",
    "{klikne}": "klikne",
    "{clicks}": "clicks",
    "{click}": "click",
    "{clicking}": "clicking",
    "{Click}": "Click",
  },
  mobile: {
    "{klikcemo}": "dodirujemo",
    "{kliknemo}": "dodirnemo",
    "{Kliknemo}": "Dodirnemo",
    "{klik}": "dodir",
    "{klikne}": "dodirne",
    "{clicks}": "taps",
    "{click}": "tap",
    "{clicking}": "tapping",
    "{Click}": "Tap",
  },
};

function applyTokens(value, device) {
  if (typeof value === "string") {
    let out = value;
    for (const [token, replacement] of Object.entries(TOKENS[device])) out = out.split(token).join(replacement);
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => applyTokens(v, device));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyTokens(v, device)]));
  }
  return value;
}

/**
 * Reads one scenario's narration.json and resolves, in this order:
 *   1. `"extends": "<other-scenario-id>"` - the phone scenario of a flow only needs
 *      its own title/intro (and any step whose wording really differs); every other
 *      step is inherited from the desktop scenario, so the prose is written once.
 *   2. `steps.<id>.mobile` - an optional phone-only override of that step's
 *      heading/sr/en, applied when the scenario id ends in "-mobilni".
 *   3. e2e-tutorials/common-narration.json - fallback text for the navigation steps
 *      that every scenario shares (open the burger menu, click "Usluge", ...), used
 *      only for ids the scenario itself does not define.
 *   4. {klikcemo}/{click}-style tokens swapped for click vs tap wording.
 *
 * Returns null when the scenario has no narration.json at all. Existing scenarios
 * (no extends, no tokens, no mobile overrides) come back unchanged, apart from
 * gaining the common fallback steps they never defined.
 */
export async function loadNarration(scenarioId, { scenariosDir = SCENARIOS_DIR } = {}) {
  if (!(await fs.pathExists(path.join(scenariosDir, scenarioId, "narration.json")))) return null;
  const merged = await loadNarrationRaw(scenarioId, scenariosDir, []);

  const device = deviceOf(scenarioId);
  const common = (await fs.pathExists(COMMON_PATH)) ? (await fs.readJson(COMMON_PATH)).steps || {} : {};
  const steps = { ...common, ...(merged.steps || {}) };

  const resolved = {};
  for (const [id, entry] of Object.entries(steps)) {
    const { mobile, ...rest } = entry;
    resolved[id] = device === "mobile" && mobile ? { ...rest, ...mobile, heading: { ...(rest.heading || {}), ...(mobile.heading || {}) } } : rest;
  }

  return applyTokens({ ...merged, steps: resolved }, device);
}

// Same as loadNarration's file + extends handling, but without the common fallback,
// device overrides or tokens - those are applied once, on the final merged result, so
// a phone scenario's `extends` chain resolves its mobile overrides with ITS device.
async function loadNarrationRaw(scenarioId, scenariosDir, seen) {
  if (seen.includes(scenarioId)) throw new Error(`narration "extends" cycle: ${[...seen, scenarioId].join(" -> ")}`);
  const file = path.join(scenariosDir, scenarioId, "narration.json");
  if (!(await fs.pathExists(file))) throw new Error(`narration extends "${scenarioId}", but ${file} does not exist`);
  const own = await fs.readJson(file);
  if (!own.extends) return own;
  const base = await loadNarrationRaw(own.extends, scenariosDir, [...seen, scenarioId]);
  return { ...base, ...own, title: own.title || base.title, intro: own.intro || base.intro, steps: { ...(base.steps || {}), ...(own.steps || {}) } };
}
