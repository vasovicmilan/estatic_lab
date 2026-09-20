import { logError } from "./logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "./pagination.util.js";

/**
 * employee.controller.js and partner.controller.js each define listCommissions
 * and listPayouts twice over - line-for-line identical except which earner key
 * (`employee: id` vs `partner: id`) the list service is called with. Builds
 * that handler once: resolve the caller's own earner id, pull page/limit/status
 * (and, for commissions, sourceType) off the query string, call `listFn`, relay
 * the result.
 */
export function createEarnerListHandler({ logPrefix, actionName, earnerKind, resolveEarnerId, listFn, includeSourceType = false }) {
  return async function (req, res, next) {
    try {
      const earnerId = await resolveEarnerId(req);
      const { page = 1, limit = 10, status, sourceType } = req.query;

      const result = await listFn({
        [earnerKind]: earnerId,
        status: status || undefined,
        ...(includeSourceType ? { sourceType: sourceType || undefined } : {}),
        page: resolvePage(page),
        limit: resolveLimit(limit),
      });

      return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
    } catch (error) {
      logError(`[${logPrefix}/${actionName}] Greška`, error, { userId: req.user.id, query: req.query });
      next(error);
    }
  };
}

export default { createEarnerListHandler };
