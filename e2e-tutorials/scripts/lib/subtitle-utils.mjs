/**
 * Groups a scenario's manifest.json steps by which video recording they belong
 * to (`step.video`, defaulting to "full-flow" for older manifests written before
 * that field existed), preserving each group's internal step order. The order
 * the DISTINCT labels are first encountered in is the scenario's real
 * chronological/narrative order (manifest.json is written in the exact order
 * tut.step() calls happened) - merge-video.mjs relies on that fact to decide
 * which video comes first when concatenating, rather than needing separate
 * per-scenario configuration for it.
 *
 * Returns a Map so insertion order (= first-appearance order) is preserved;
 * `[...map.keys()]` gives the label order, `map.get(label)` gives that video's
 * steps in step order.
 */
export function groupStepsByVideo(manifest) {
  const byVideo = new Map();
  for (const step of manifest) {
    const label = step.video || "full-flow";
    if (!byVideo.has(label)) byVideo.set(label, []);
    byVideo.get(label).push(step);
  }
  return byVideo;
}

export function formatVttTime(ms) {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const msRem = clamped % 1000;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(msRem, 3)}`;
}
