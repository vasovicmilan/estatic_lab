const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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