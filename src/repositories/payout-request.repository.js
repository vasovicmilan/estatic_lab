import { Types } from "mongoose";
import PayoutRequest from "../models/payout-request.model.js";
import { buildPayoutRequestFilter } from "./filters/payout-request.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createPayoutRequest(data, { session } = {}) {
  const [request] = await PayoutRequest.create([data], { session });
  return request;
}

export async function findPayoutRequestById(id, { session } = {}) {
  return PayoutRequest.findById(id)
    .populate({ path: "employee", populate: { path: "userId", select: "firstName lastName email" } })
    .populate({ path: "partner", populate: { path: "userId", select: "firstName lastName email" } })
    .session(session || null)
    .lean();
}

export async function findPayoutRequests({ limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildPayoutRequestFilter(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    PayoutRequest.find(filter)
      .populate({ path: "employee", populate: { path: "userId", select: "firstName lastName email" } })
      .populate({ path: "partner", populate: { path: "userId", select: "firstName lastName email" } })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    PayoutRequest.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// sum of amounts already requested/approved but not yet paid or rejected - needed
// so a new request can't be made against money that's already spoken for by an
// earlier pending request
export async function sumPendingRequestedAmount({ employee = null, partner = null }, { session } = {}) {
  const match = { status: { $in: ["requested", "approved"] } };
  if (employee) match.employee = new Types.ObjectId(employee);
  if (partner) match.partner = new Types.ObjectId(partner);

  const [result] = await PayoutRequest.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]).session(
    session || null
  );
  return result?.total || 0;
}

export async function sumPaidAmount({ employee = null, partner = null }, { session } = {}) {
  const match = { status: "paid" };
  if (employee) match.employee = new Types.ObjectId(employee);
  if (partner) match.partner = new Types.ObjectId(partner);

  const [result] = await PayoutRequest.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]).session(
    session || null
  );
  return result?.total || 0;
}

export async function updatePayoutRequestById(id, updateData, { session } = {}) {
  return PayoutRequest.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

// Used by employee.service.js's deleteEmployeeById - PayoutRequest.employee has no
// name snapshot, so it must block deletion rather than silently orphan a payout
// record with no readable "who this was paid to" left.
export async function countPayoutRequests(filters = {}, { session } = {}) {
  return PayoutRequest.countDocuments(buildPayoutRequestFilter(filters)).session(session || null);
}

export default {
  createPayoutRequest,
  findPayoutRequestById,
  findPayoutRequests,
  sumPendingRequestedAmount,
  sumPaidAmount,
  updatePayoutRequestById,
  countPayoutRequests,
};