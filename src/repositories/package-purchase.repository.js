import { Types } from "mongoose";
import PackagePurchase from "../models/package-purchase.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createPackagePurchase(data, { session } = {}) {
  const [purchase] = await PackagePurchase.create([data], { session });
  return purchase;
}

export async function findPackagePurchaseById(id, { populateFields = [], session } = {}) {
  let query = PackagePurchase.findById(id).session(session || null);
  populateFields.forEach((p) => (query = query.populate(p)));
  return query.lean();
}

// used by reserveSession/releaseSession/commitSession - needs a real (non-lean) doc
// so item counters can be mutated in place before saving the whole items[] array back
export async function findPackagePurchaseDocById(id, { session } = {}) {
  return PackagePurchase.findById(id).session(session || null);
}

export async function findPurchasesByUser(userId, { populateFields = [], session } = {}) {
  let query = PackagePurchase.find({ user: userId }).sort({ purchasedAt: -1, _id: -1 }).session(session || null);
  populateFields.forEach((p) => (query = query.populate(p)));
  return query.lean();
}

// candidates for auto-selection / eligibility display - scoped to the exact variant
// (servicePackageId), not just the parent service. Filtered further in the service
// layer (status/expiry/remaining-sessions).
export async function findActivePurchasesForUserAndVariant(userId, servicePackageId, { session } = {}) {
  return PackagePurchase.find({
    user: userId,
    status: "active",
    "items.servicePackageId": servicePackageId,
  })
    .session(session || null)
    .lean();
}

export async function updatePackagePurchaseById(id, updateData, { session } = {}) {
  return PackagePurchase.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function findPackagePurchases({ filters = {}, limit = 20, page = 1, populateFields = [], session } = {}) {
  const filter = {};
  if (filters.userId) filter.user = filters.userId;
  if (filters.status) filter.status = filters.status;

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = PackagePurchase.find(filter).sort({ purchasedAt: -1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null);
  populateFields.forEach((p) => (query = query.populate(p)));

  const [data, total] = await Promise.all([query.lean(), PackagePurchase.countDocuments(filter).session(session || null)]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function deletePackagePurchaseById(id, { session } = {}) {
  return PackagePurchase.findByIdAndDelete(id, { session }).lean();
}

// Used by package.service.js/service.service.js to block deletion of a Package or
// Service that's already been sold - deleting either out from under a live purchase
// would leave items[].package/items[].service as a dangling ObjectId with no way to
// resolve what the customer actually bought.
export async function countPackagePurchases(filters = {}, { session } = {}) {
  const filter = {};
  if (filters.package) filter.package = filters.package;
  if (filters.service) filter["items.service"] = filters.service;
  if (filters.status) filter.status = filters.status;
  return PackagePurchase.countDocuments(filter).session(session || null);
}

// Used by service.service.js's deleteServiceById - a real customer holding unused
// sessions for this exact service (status: active, sessionsUsed + sessionsReserved
// still below sessionsTotal) is a live commitment, not history, so it has to block
// the deletion outright. This can't be expressed as a plain filter since it compares
// two fields within the same items[] subdocument - hence the aggregation.
export async function countActivePurchasesWithOutstandingSessionsForService(serviceId, { session } = {}) {
  const serviceObjectId = new Types.ObjectId(serviceId);
  const result = await PackagePurchase.aggregate([
    { $match: { status: "active", "items.service": serviceObjectId } },
    { $unwind: "$items" },
    {
      $match: {
        "items.service": serviceObjectId,
        $expr: { $lt: [{ $add: ["$items.sessionsUsed", "$items.sessionsReserved"] }, "$items.sessionsTotal"] },
      },
    },
    { $count: "count" },
  ]).session(session || null);
  return result[0]?.count || 0;
}

export default {
  createPackagePurchase,
  findPackagePurchaseById,
  findPackagePurchaseDocById,
  findPurchasesByUser,
  findActivePurchasesForUserAndVariant,
  updatePackagePurchaseById,
  findPackagePurchases,
  deletePackagePurchaseById,
  countPackagePurchases,
  countActivePurchasesWithOutstandingSessionsForService,
};