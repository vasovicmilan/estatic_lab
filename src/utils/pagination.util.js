const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Clamp whatever limit was requested into a sane range, so no list endpoint can be made
 * to return (or count) an unbounded number of documents.
 */
export function resolveLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export function resolvePage(page) {
  const parsed = parseInt(page, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

export function resolveSkip(page, limit) {
  return (resolvePage(page) - 1) * resolveLimit(limit);
}

export function buildPaginationMeta({ total, page, limit }) {
  const resolvedLimit = resolveLimit(limit);
  const resolvedPage = resolvePage(page);
  return {
    total,
    page: resolvedPage,
    limit: resolvedLimit,
    totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
  };
}

/**
 * Relays the pagination fields a paginated repository/service result already
 * carries (`{ data, page, limit, total, totalPages }`) into the `meta` object
 * every list controller sends back. Deliberately does NOT recompute totalPages
 * itself (unlike buildPaginationMeta, which is for building meta from a raw
 * `{total, page, limit}` when nothing has computed totalPages yet) - the
 * repository layer already ran buildPaginationMeta once to produce `result`,
 * so redoing it here would just be trusting the same math twice for no
 * benefit. Was copy-pasted as a local `paginationMeta(result)` (or inlined
 * outright) in every api/v1 controller - centralized here so there's one
 * definition of "what a list endpoint's meta object looks like".
 */
export function pickPaginationMeta(result) {
  return { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages };
}
