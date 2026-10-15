import activityRepo from "../repositories/user-activity-log.repository.js";
import auditRepo from "../repositories/audit-log.repository.js";
import { resolveLimit, resolvePage } from "../utils/pagination.util.js";
import { isUserVisibleAction, USER_VISIBLE_ACTIONS } from "../utils/activity-labels.util.js";

const RELATED_TYPES = ["Order", "TemporaryOrder", "Appointment", "PackagePurchase", "Employee", "Partner", "PayoutRequest"];

function relatedClauses(related) {
  return RELATED_TYPES.filter((type) => related[type]?.length).map((type) => ({ "entity.type": type, "entity.id": { $in: related[type] } }));
}

function fromAudit(row) {
  return {
    source: "audit",
    id: String(row._id),
    timestamp: row.timestamp,
    action: row.action,
    actor: row.actor || null,
    entity: row.entity || null,
    changes: row.changes || null,
    meta: null,
    success: row.success !== false,
    errorMessage: row.errorMessage || null,
    ip: row.ip || null,
  };
}

function fromActivity(row) {
  return {
    source: "activity",
    id: String(row._id),
    timestamp: row.timestamp,
    action: row.action,
    actor: { id: row.userId || null, email: null, role: row.role || null },
    entity: row.entity || null,
    changes: null,
    meta: row.meta || null,
    success: row.success !== false,
    errorMessage: row.errorMessage || null,
    ip: row.ip || null,
  };
}

/**
 * One chronological history for one user, merged from the admin audit trail and the
 * customer activity log. Entries are tied to the user three ways: they performed it,
 * it is about their account, or it is about a record that belongs to them (order,
 * appointment, package purchase, employee/partner profile, payout).
 *
 * Paging a merge of two collections: take the newest `page * limit` from each source,
 * sort, then slice the requested page - exact, and cheap for the sizes involved.
 */
export async function getAdminUserHistory(userId, { page = 1, limit = 25 } = {}) {
  const resolvedLimit = resolveLimit(limit);
  const resolvedPage = resolvePage(page);
  const window = resolvedPage * resolvedLimit;

  const related = await activityRepo.findRelatedEntityIds(userId);
  const clauses = relatedClauses(related);
  const actorId = related.User[0];

  const auditQuery = { $or: [{ "actor.id": actorId }, { "entity.type": "User", "entity.id": actorId }, ...clauses] };
  const activityQuery = { $or: [{ userId: actorId }, ...clauses] };

  const [auditRows, activityRows, auditTotal, activityTotal] = await Promise.all([
    auditRepo.findByQuery(auditQuery, { limit: window }),
    activityRepo.findByQuery(activityQuery, { limit: window }),
    auditRepo.countByQuery(auditQuery),
    activityRepo.countByQuery(activityQuery),
  ]);

  const merged = [...auditRows.map(fromAudit), ...activityRows.map(fromActivity)].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const start = (resolvedPage - 1) * resolvedLimit;
  const total = auditTotal + activityTotal;
  return {
    data: merged.slice(start, start + resolvedLimit),
    total,
    page: resolvedPage,
    limit: resolvedLimit,
    totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
  };
}

/**
 * What the customer sees of their own history: only allow-listed actions, only things
 * they did themselves (their own audit entries and their own activity, plus actions
 * taken on their behalf through an emailed link), never `changes`, never another
 * person's email, never admin-side entries.
 */
export async function getOwnHistory(userId, { page = 1, limit = 20 } = {}) {
  const resolvedLimit = resolveLimit(limit);
  const resolvedPage = resolvePage(page);
  const window = resolvedPage * resolvedLimit;

  const related = await activityRepo.findRelatedEntityIds(userId);
  const clauses = relatedClauses(related);
  const actorId = related.User[0];
  const allowed = Object.keys(USER_VISIBLE_ACTIONS);

  const auditQuery = { "actor.id": actorId, action: { $in: allowed } };
  const activityQuery = { $or: [{ userId: actorId }, ...clauses], action: { $in: allowed } };

  const [auditRows, activityRows, auditTotal, activityTotal] = await Promise.all([
    auditRepo.findByQuery(auditQuery, { limit: window }),
    activityRepo.findByQuery(activityQuery, { limit: window }),
    auditRepo.countByQuery(auditQuery),
    activityRepo.countByQuery(activityQuery),
  ]);

  const merged = [...auditRows.map(fromAudit), ...activityRows.map(fromActivity)]
    .filter((item) => isUserVisibleAction(item.action))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const start = (resolvedPage - 1) * resolvedLimit;
  const total = auditTotal + activityTotal;
  return {
    data: merged.slice(start, start + resolvedLimit),
    total,
    page: resolvedPage,
    limit: resolvedLimit,
    totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
  };
}

/** Interest summary for the admin activity page: what visitors reach for most. */
export async function getInterestSummary({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [products, services, actionCounts] = await Promise.all([
    activityRepo.topByAction({ action: "CART_ITEM_ADDED", groupField: "$entity.id", entityType: "Product", since, limit: 10 }),
    activityRepo.topByAction({ action: "BOOKING_CREATED", groupField: "$meta.serviceId", since, limit: 10 }),
    activityRepo.countByAction({ since }),
  ]);
  const [productNames, serviceNames] = await Promise.all([
    activityRepo.findNamesByIds("Product", products.map((p) => p.id)),
    activityRepo.findNamesByIds("Service", services.map((s) => s.id)),
  ]);
  return {
    days,
    products: products.map((p) => ({ ...p, name: productNames.get(String(p.id)) || "(obrisan proizvod)" })),
    services: services.map((s) => ({ ...s, name: serviceNames.get(String(s.id)) || "(obrisana usluga)" })),
    actionCounts,
  };
}

export default { getAdminUserHistory, getOwnHistory, getInterestSummary };
