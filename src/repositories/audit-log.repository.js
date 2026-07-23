import AuditLog from "../models/audit-log.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createAuditLog(data) {
  return AuditLog.create(data);
}

export async function findAuditLogs({ filters = {}, limit = 25, page = 1 } = {}) {
  const query = {};
  if (filters.actorId) query["actor.id"] = filters.actorId;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query["entity.type"] = filters.entityType;
  if (filters.entityId) query["entity.id"] = filters.entityId;
  if (filters.success !== undefined && filters.success !== null) query.success = filters.success;
  if (filters.dateFrom || filters.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
    if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
  }

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(resolvedLimit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function findAuditLogById(id) {
  return AuditLog.findById(id).lean();
}

// every distinct action string currently in use - powers the admin filter
// dropdown without needing to hardcode the list as new actions get instrumented
export async function findDistinctActions() {
  return AuditLog.distinct("action");
}

export default { createAuditLog, findAuditLogs, findAuditLogById, findDistinctActions };