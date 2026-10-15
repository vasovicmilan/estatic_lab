import crypto from "node:crypto";
import activityRepo from "../repositories/user-activity-log.repository.js";
import { normalizeEntityId } from "./audit-log.service.js";
import { redactDeep } from "../utils/audit-redaction.util.js";
import { isLikelyBot } from "../utils/bot-detection.util.js";
import { logError } from "../utils/logger.util.js";

/**
 * Who is behind this request: the web session user, the API (JWT) user, or nobody (guest).
 * Web and API handlers share the same call sites, so both shapes are understood here.
 */
export function resolveActivityUser(req) {
  if (req?.session?.isLoggedIn && req.session.user) return req.session.user;
  return req?.user || null;
}

// Groups the actions of one visit without storing the raw session id (which is a login
// credential): HMAC with a server secret, truncated. A guest never has an email stored.
export function buildSessionKey(req) {
  const sessionId = req?.sessionID;
  if (!sessionId) return null;
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
  return crypto.createHmac("sha256", secret).update(String(sessionId)).digest("hex").slice(0, 24);
}

/**
 * Records one customer/visitor action. Never throws and never blocks the real action's
 * outcome - call it AFTER the action succeeded (or failed with success:false).
 * Bots are skipped. Personal fields in `meta` are redacted by name before writing.
 *
 * @param {object} params
 * @param {object} params.req - Express request (user, session, ip, user agent come from it)
 * @param {string} params.action - SCREAMING_SNAKE_CASE, e.g. "CART_ITEM_ADDED"
 * @param {object} [params.entity] - { type, id }
 * @param {object} [params.meta] - non-personal details
 * @param {object} [params.user] - override of the resolved user (e.g. just-registered account)
 */
export async function recordActivity({ req, action, entity = null, meta = null, user, success = true, errorMessage = null }) {
  try {
    const userAgent = req?.headers?.["user-agent"] || null;
    if (isLikelyBot(userAgent)) return;

    const actor = user === undefined ? resolveActivityUser(req) : user;
    const userId = actor?.id || actor?._id || null;

    await activityRepo.createActivity({
      timestamp: new Date(),
      userId: userId ? normalizeEntityId(userId) : null,
      role: actor?.roleName || actor?.role || (userId ? "user" : "guest"),
      sessionKey: buildSessionKey(req),
      action,
      entity: entity ? { type: entity.type, id: normalizeEntityId(entity.id) } : null,
      meta: meta ? redactDeep(meta) : null,
      ip: req?.ip || null,
      userAgent,
      requestId: req?.requestId || null,
      success,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 300) : null,
    });
  } catch (error) {
    logError("Failed to write user activity log entry", error, { action, entityType: entity?.type });
  }
}

/** Erasure: called next to scrubActorEmail when an account is anonymized/deleted. */
export async function deleteForUser(userId) {
  try {
    await activityRepo.deleteByUserId(userId);
  } catch (error) {
    logError("Failed to delete user activity log", error, { userId });
  }
}

export async function listActivities(args) {
  return activityRepo.findActivities(args);
}

export async function listActionOptions() {
  const actions = await activityRepo.findDistinctActions();
  return actions.sort();
}

export default { resolveActivityUser, buildSessionKey, recordActivity, deleteForUser, listActivities, listActionOptions };
