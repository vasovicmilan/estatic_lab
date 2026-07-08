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

// used by consumeSession() — needs a real (non-lean) doc so item.sessionsUsed can be
// mutated in place before saving the whole items[] array back
export async function findPackagePurchaseDocById(id, { session } = {}) {
  return PackagePurchase.findById(id).session(session || null);
}

export async function findPurchasesByUser(userId, { populateFields = [], session } = {}) {
  let query = PackagePurchase.find({ user: userId }).sort({ purchasedAt: -1 }).session(session || null);
  populateFields.forEach((p) => (query = query.populate(p)));
  return query.lean();
}

// candidates for auto-selection / eligibility display — filtered further in the
// service layer (status/expiry/remaining-sessions), this just narrows by service
export async function findActivePurchasesForUserAndService(userId, serviceId, { session } = {}) {
  return PackagePurchase.find({
    user: userId,
    status: "active",
    "items.service": serviceId,
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

  let query = PackagePurchase.find(filter).sort({ purchasedAt: -1 }).skip(skip).limit(resolvedLimit).session(session || null);
  populateFields.forEach((p) => (query = query.populate(p)));

  const [data, total] = await Promise.all([query.lean(), PackagePurchase.countDocuments(filter).session(session || null)]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export default {
  createPackagePurchase,
  findPackagePurchaseById,
  findPackagePurchaseDocById,
  findPurchasesByUser,
  findActivePurchasesForUserAndService,
  updatePackagePurchaseById,
  findPackagePurchases,
};