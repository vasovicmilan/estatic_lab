import auditLogRepo from "../repositories/audit-log.repository.js";
import { logError } from "../utils/logger.util.js";

/**
 * Records one audit entry. Never throws - a failure here must not break the
 * real action it's describing. Call this AFTER the real action has actually
 * succeeded (or failed), passing success/errorMessage accordingly - never
 * before, since an audit entry claiming something happened when it didn't
 * (or vice versa) is worse than no entry at all.
 *
 * @param {object} params
 * @param {object} params.actor - { id, email, role } - use req.session.user shape,
 *   or null fields for an unauthenticated/system-triggered action
 * @param {string} params.action - SCREAMING_SNAKE_CASE, e.g. "PRODUCT_UPDATED"
 * @param {object} [params.entity] - { type, id } - the record the action was about
 * @param {object} [params.changes] - per-field { old, new } pairs, see computeChanges
 * @param {object} [params.req] - the Express request, used to pull ip/userAgent/requestId
 *   automatically - pass this instead of ip/userAgent/requestId individually when available
 * @param {boolean} [params.success=true]
 * @param {string} [params.errorMessage]
 */
export async function recordAuditLog({
  actor,
  action,
  entity = null,
  changes = null,
  req = null,
  ip = null,
  userAgent = null,
  requestId = null,
  success = true,
  errorMessage = null,
}) {
  try {
    await auditLogRepo.createAuditLog({
      timestamp: new Date(),
      actor: {
        id: actor?.id || null,
        email: actor?.email || null,
        role: actor?.roleName || actor?.role || null,
      },
      action,
      entity: entity ? { type: entity.type, id: entity.id } : null,
      changes,
      ip: req?.ip || ip,
      userAgent: req?.headers?.["user-agent"] || userAgent,
      requestId: req?.requestId || requestId,
      success,
      errorMessage,
    });
  } catch (error) {
    // deliberately swallowed beyond logging - see the function comment above
    logError("Failed to write audit log entry", error, { action, entityType: entity?.type, entityId: entity?.id });
  }
}

/**
 * Compares specific tracked fields between an old and new object, returning
 * only the ones that actually changed as { field: { old, new } } pairs.
 * Fields not listed in `trackedFields` are ignored entirely - e.g. updatedAt
 * always changes and isn't meaningful to record. Returns null (not {}) when
 * nothing tracked actually changed, so callers can skip writing a pointless
 * "nothing changed" audit entry.
 */
export function computeChanges(oldObj, newObj, trackedFields) {
  const changes = {};
  for (const field of trackedFields) {
    const oldValue = oldObj?.[field] ?? null;
    const newValue = newObj?.[field] ?? null;
    const changed =
      oldValue instanceof Date || newValue instanceof Date
        ? new Date(oldValue).getTime() !== new Date(newValue).getTime()
        : JSON.stringify(oldValue) !== JSON.stringify(newValue);
    if (changed) {
      changes[field] = { old: oldValue, new: newValue };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function listAuditLogs({ filters = {}, limit = 25, page = 1 } = {}) {
  return auditLogRepo.findAuditLogs({ filters, limit, page });
}

export async function getAuditLogById(id) {
  return auditLogRepo.findAuditLogById(id);
}

export async function listDistinctActions() {
  return auditLogRepo.findDistinctActions();
}

export default { recordAuditLog, computeChanges, listAuditLogs, getAuditLogById, listDistinctActions };