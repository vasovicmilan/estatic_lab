import { Types } from "mongoose";
import CommissionEntry from "../models/commission-entry.model.js";
import { buildCommissionEntryFilter } from "./filters/commission-entry.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createCommissionEntry(data, { session } = {}) {
  const [entry] = await CommissionEntry.create([data], { session });
  return entry;
}

export async function findCommissionEntryById(id, { session } = {}) {
  return CommissionEntry.findById(id).session(session || null).lean();
}

// used by the grace-period cron - every pending order-sourced entry, so it can
// decide per-entry whether the order is now past its return window
export async function findPendingOrderCommissions({ session } = {}) {
  return CommissionEntry.find({ sourceType: "order", status: "pending" })
    .populate("order")
    .session(session || null)
    .lean();
}

// used when one specific order reaches a terminal state (e.g. "completed") and
// its commission needs to be resolved immediately, rather than waiting for the
// cron's next sweep to find it via the broader scan above
export async function findPendingCommissionByOrder(orderId, { session } = {}) {
  return CommissionEntry.findOne({ sourceType: "order", order: orderId, status: "pending" })
    .session(session || null)
    .lean();
}

// used when a package purchase gets cancelled after its commission was already
// recorded (package-purchase commissions go straight to "earned" at creation,
// unlike orders which sit "pending" first) - finds the earned entry so it can
// be reversed rather than silently leaving the partner paid for a cancelled sale
export async function findEarnedCommissionByPackagePurchase(packagePurchaseId, { session } = {}) {
  return CommissionEntry.findOne({ sourceType: "package_purchase", packagePurchase: packagePurchaseId, status: "earned" })
    .session(session || null)
    .lean();
}

export async function findCommissionEntries({ limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildCommissionEntryFilter(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    CommissionEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    CommissionEntry.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// the derived, payable balance for one earner - sum of everything actually
// earned, nothing pending or reversed. This is deliberately computed here rather
// than ever being stored, so there's no drift risk (see payout-request.model.js).
export async function sumEarnedAmount({ employee = null, partner = null }, { session } = {}) {
  const match = { status: "earned" };
  if (employee) match.employee = new Types.ObjectId(employee);
  if (partner) match.partner = new Types.ObjectId(partner);

  const [result] = await CommissionEntry.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]).session(
    session || null
  );
  return result?.total || 0;
}

export async function updateCommissionEntryById(id, updateData, { session } = {}) {
  return CommissionEntry.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

// Used by employee.service.js's deleteEmployeeById - CommissionEntry.employee has no
// name snapshot, so it must block deletion rather than silently orphan a paid-out
// record with no readable "who earned this" left.
export async function countCommissionEntries(filters = {}, { session } = {}) {
  return CommissionEntry.countDocuments(buildCommissionEntryFilter(filters)).session(session || null);
}

export default {
  createCommissionEntry,
  findCommissionEntryById,
  findPendingOrderCommissions,
  findPendingCommissionByOrder,
  findEarnedCommissionByPackagePurchase,
  findCommissionEntries,
  sumEarnedAmount,
  updateCommissionEntryById,
  countCommissionEntries,
};