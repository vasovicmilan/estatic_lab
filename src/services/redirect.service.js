import redirectRepo from "../repositories/redirect.repository.js";
import { validationError } from "../utils/error.util.js";
import { createTtlCache } from "../utils/ttl-cache.util.js";

// This lookup sits on the hot path of every genuinely-unmatched request
// (see notFoundMiddleware below) - crawler scanners alone generate thousands
// of these a day (see the earlier /read-document, /wp-json, etc. probes in
// the access logs). A short cache keeps that from becoming one extra Mongo
// round-trip per bot hit; a redirect being added/edited can take up to this
// long to take effect, which is an acceptable tradeoff for an admin-driven,
// infrequent edit.
const cache = createTtlCache(60 * 1000);

export async function resolveRedirect(sourcePath) {
  const cached = cache.get(sourcePath);
  if (cached !== undefined) return cached;

  const redirect = await redirectRepo.findBySourcePath(sourcePath);
  cache.set(sourcePath, redirect || null);
  return redirect || null;
}

export async function listRedirects() {
  return redirectRepo.findAllRedirects();
}

export async function saveRedirect({ sourcePath, type, target, note }) {
  if (!sourcePath) validationError("sourcePath");
  if (!["redirect", "gone"].includes(type)) validationError("type");
  if (type === "redirect" && !target) validationError("target");

  // normalize the same way req.path arrives - leading slash, no trailing
  // slash (except root), no query string
  const normalizedSource = `/${sourcePath.replace(/^\/+|\/+$/g, "")}`;

  const saved = await redirectRepo.upsertRedirect({
    sourcePath: normalizedSource,
    type,
    target: type === "redirect" ? target : null,
    note: note || "",
  });
  cache.clear();
  return saved;
}

export async function deleteRedirect(sourcePath) {
  const deleted = await redirectRepo.deleteBySourcePath(sourcePath);
  cache.clear();
  return deleted;
}

export default { resolveRedirect, listRedirects, saveRedirect, deleteRedirect };
