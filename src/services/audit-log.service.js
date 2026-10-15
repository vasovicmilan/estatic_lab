import mongoose from "mongoose";
import auditLogRepo from "../repositories/audit-log.repository.js";
import { logError } from "../utils/logger.util.js";
import { redactChanges, isRedactionExempt } from "../utils/audit-redaction.util.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Real document ids (24-hex strings or ObjectIds) are stored as ObjectId so they keep
 * matching older entries and `entity.id` filters; anything else (e.g. the "singleton"
 * id of SiteSettings/SiteContent) is kept as a plain string instead of failing a cast.
 */
export function normalizeEntityId(id) {
  if (id === null || id === undefined || id === "") return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const asString = String(id);
  return OBJECT_ID_PATTERN.test(asString) ? new mongoose.Types.ObjectId(asString) : asString;
}

/**
 * `changes` is always per-field { old, new }. A few callers used { before, after } or
 * { after } (site settings working hours/closed dates, site content) - the admin list
 * only understands { old, new }, so those shapes are rewritten here, at the one place
 * every entry passes through.
 */
export function normalizeChanges(changes) {
  if (!changes || typeof changes !== "object") return changes ?? null;
  const out = {};
  for (const [field, value] of Object.entries(changes)) {
    const isPair = value && typeof value === "object" && !Array.isArray(value);
    if (isPair && ("old" in value || "new" in value)) {
      out[field] = value;
    } else if (isPair && ("before" in value || "after" in value)) {
      out[field] = { old: value.before ?? null, new: value.after ?? null };
    } else {
      out[field] = { old: null, new: value ?? null };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

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
      entity: entity ? { type: entity.type, id: normalizeEntityId(entity.id) } : null,
      // personal/encrypted values never reach the trail - see audit-redaction.util.js
      changes: isRedactionExempt(entity?.type) ? normalizeChanges(changes) : redactChanges(normalizeChanges(changes)),
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

/**
 * Before/after for a name/phone profile edit. The plain values are compared here, but
 * recordAuditLog hides them before writing (firstName/lastName/telefon are all on the
 * redaction list), so the trail only says which of them changed.
 */
export function computeProfileChanges(existing, updated) {
  return computeChanges(existing, updated, ["firstName", "lastName", "telefon"]);
}

/**
 * Removes the stored email from every entry written BY this user. Called when an
 * account is anonymized/deleted, so the 2-year audit trail doesn't keep the very
 * address that was just erased. The entries themselves (and actor.id) stay.
 */
export async function scrubActorEmail(userId) {
  try {
    await auditLogRepo.scrubActorEmail(userId);
  } catch (error) {
    logError("Failed to scrub actor email from audit log", error, { userId });
  }
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

export default { recordAuditLog, computeChanges, computeProfileChanges, scrubActorEmail, normalizeEntityId, normalizeChanges, listAuditLogs, getAuditLogById, listDistinctActions };