// Minimal in-process TTL cache - a plain Map, not Redis. Fine for a single-
// instance deployment; in PM2 cluster mode (`-i max`, see DEPLOYMENT.md) each
// worker keeps its own copy, so a category edit can take up to `ttlMs` to be
// reflected by workers other than the one the admin's request landed on. That
// tradeoff is deliberate here - see product.service.js/service.service.js's
// attachProductCountsToCategories/attachServiceCountsToCategories, which are
// display-only sidebar counters, not anything transactional.
export function createTtlCache(ttlMs) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    clear() {
      store.clear();
    },
  };
}
