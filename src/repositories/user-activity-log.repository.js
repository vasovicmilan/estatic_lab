import mongoose from "mongoose";
import UserActivityLog from "../models/user-activity-log.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const toStoredId = (value) => (OBJECT_ID_PATTERN.test(String(value)) ? new mongoose.Types.ObjectId(String(value)) : String(value));

export async function createActivity(data) {
  return UserActivityLog.create(data);
}

function buildListQuery(filters = {}) {
  const query = {};
  if (filters.userId) query.userId = toStoredId(filters.userId);
  if (filters.role) query.role = filters.role;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query["entity.type"] = filters.entityType;
  if (filters.entityId) query["entity.id"] = toStoredId(filters.entityId);
  if (filters.success !== undefined && filters.success !== null) query.success = filters.success;
  if (filters.dateFrom || filters.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
    if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
  }
  // free search: action name or IP address
  if (filters.search) {
    const regex = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ action: regex }, { ip: regex }];
  }
  return query;
}

export async function findActivities({ filters = {}, limit = 25, page = 1 } = {}) {
  const query = buildListQuery(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;

  const [data, total] = await Promise.all([
    UserActivityLog.find(query).sort({ timestamp: sortDirection }).skip(skip).limit(resolvedLimit).lean(),
    UserActivityLog.countDocuments(query),
  ]);
  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// raw query access for the merged per-user timeline (see user-history.service.js)
export async function findByQuery(query, { limit }) {
  return UserActivityLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();
}

export async function countByQuery(query) {
  return UserActivityLog.countDocuments(query);
}

export async function findDistinctActions() {
  return UserActivityLog.distinct("action");
}

export async function deleteByUserId(userId) {
  return UserActivityLog.deleteMany({ userId: toStoredId(userId) });
}

/**
 * Most frequent targets of one action since a date, e.g. which products get added to
 * carts most. `groupField` is the stored path to group by ("$entity.id", "$meta.serviceId").
 * uniqueActors counts distinct logged-in users plus distinct guest visits.
 */
export async function topByAction({ action, groupField, since, entityType = null, limit = 10 }) {
  const match = { action, success: true, timestamp: { $gte: since } };
  if (entityType) match["entity.type"] = entityType;
  match[groupField.replace(/^\$/, "")] = { $nin: [null, ""] };

  const rows = await UserActivityLog.aggregate([
    { $match: match },
    { $group: { _id: groupField, count: { $sum: 1 }, actors: { $addToSet: { $ifNull: ["$userId", "$sessionKey"] } } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ id: row._id, count: row.count, uniqueActors: row.actors.filter(Boolean).length }));
}

export async function countByAction({ since }) {
  const rows = await UserActivityLog.aggregate([
    { $match: { timestamp: { $gte: since } } },
    { $group: { _id: "$action", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({ action: row._id, count: row.count }));
}

export default { findRelatedEntityIds, findNamesByIds, createActivity, findActivities, findByQuery, countByQuery, findDistinctActions, deleteByUserId, topByAction, countByAction };

// ---- records that belong to one user (used to build the merged history) ----
const RELATED_CAP = 500;

/**
 * Ids of everything tied to this user, grouped by entity type, so entries about those
 * records (an admin confirming the user's appointment, a guest session confirming their
 * order by email link) show up in the user's history without a subjectUserId field.
 */
export async function findRelatedEntityIds(userId) {
  const id = toStoredId(userId);
  const ids = (docs) => docs.map((d) => d._id);
  const find = (modelName, filter) => mongoose.model(modelName).find(filter).select("_id").limit(RELATED_CAP).lean();

  const [orders, temporaryOrders, appointments, purchases, employees, partners] = await Promise.all([
    find("Order", { user: id }),
    find("TemporaryOrder", { user: id }),
    find("Appointment", { user: id }),
    find("PackagePurchase", { user: id }),
    find("Employee", { userId: id }),
    find("Partner", { userId: id }),
  ]);

  const employeeIds = ids(employees);
  const partnerIds = ids(partners);
  const payouts =
    employeeIds.length || partnerIds.length
      ? await find("PayoutRequest", { $or: [{ employee: { $in: employeeIds } }, { partner: { $in: partnerIds } }] })
      : [];

  return {
    User: [id],
    Order: ids(orders),
    TemporaryOrder: ids(temporaryOrders),
    Appointment: ids(appointments),
    PackagePurchase: ids(purchases),
    Employee: employeeIds,
    Partner: partnerIds,
    PayoutRequest: ids(payouts),
  };
}

/** { Product: {id: count}, ... } helper for resolving names of top entities */
export async function findNamesByIds(modelName, idList) {
  if (!idList.length) return new Map();
  const valid = idList.filter((v) => OBJECT_ID_PATTERN.test(String(v)));
  const docs = await mongoose.model(modelName).find({ _id: { $in: valid } }).select("name").lean();
  return new Map(docs.map((d) => [String(d._id), d.name]));
}
