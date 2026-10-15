import mongoose from "mongoose";
import AuditLog from "../models/audit-log.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

// ids are stored as ObjectId when they are real document ids (see normalizeEntityId in
// audit-log.service.js), so filters must cast the same way or a string id never matches
const toStoredId = (value) => (/^[a-f\d]{24}$/i.test(String(value)) ? new mongoose.Types.ObjectId(String(value)) : String(value));

export async function createAuditLog(data) {
  return AuditLog.create(data);
}

export async function findAuditLogs({ filters = {}, limit = 25, page = 1 } = {}) {
  const query = {};
  if (filters.actorId) query["actor.id"] = toStoredId(filters.actorId);
  if (filters.actorRole) query["actor.role"] = filters.actorRole;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query["entity.type"] = filters.entityType;
  if (filters.entityId) query["entity.id"] = toStoredId(filters.entityId);
  if (filters.success !== undefined && filters.success !== null) query.success = filters.success;
  if (filters.dateFrom || filters.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
    if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
  }
  // slobodna pretraga - poklapa email aktera ili naziv akcije (case-insensitive),
  // dovoljno za "sta je taj i taj radio" bez potrebe da se zna tacan naziv akcije
  if (filters.search) {
    const regex = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ "actor.email": regex }, { action: regex }];
  }

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;

  const [data, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: sortDirection }).skip(skip).limit(resolvedLimit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function scrubActorEmail(userId) {
  return AuditLog.updateMany({ "actor.id": toStoredId(userId) }, { $set: { "actor.email": null } });
}

// raw query access for the merged per-user timeline (see user-history.service.js)
export async function findByQuery(query, { limit }) {
  return AuditLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();
}

export async function countByQuery(query) {
  return AuditLog.countDocuments(query);
}

export async function findAuditLogById(id) {
  return AuditLog.findById(id).lean();
}

// every distinct action string currently in use - powers the admin filter
// dropdown without needing to hardcode the list as new actions get instrumented
export async function findDistinctActions() {
  return AuditLog.distinct("action");
}

export default { createAuditLog, scrubActorEmail, findByQuery, countByQuery, findAuditLogs, findAuditLogById, findDistinctActions };