import TemporaryOrder from "../models/temporary-order.model.js";
import { buildTemporaryOrderFilter } from "./filters/temporary-order.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createTemporaryOrder(data, { session } = {}) {
  const [order] = await TemporaryOrder.create([data], { session });
  return order;
}

export async function findTemporaryOrderById(id, { session } = {}) {
  return TemporaryOrder.findById(id).session(session || null).lean();
}

export async function findTemporaryOrderByToken(token, { session } = {}) {
  return TemporaryOrder.findOne({ verificationToken: token }).session(session || null).lean();
}

export async function findTemporaryOrders({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildTemporaryOrderFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    TemporaryOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    TemporaryOrder.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// unpaginated on purpose - this feeds the cleanup job that releases stock/coupon
// reservations for checkouts nobody confirmed in time, which runs on a schedule,
// not from a request
export async function findExpiredTemporaryOrders({ session } = {}) {
  return TemporaryOrder.find({ tokenExpiration: { $lt: new Date() } }).session(session || null).lean();
}

export async function deleteTemporaryOrderById(id, { session } = {}) {
  return TemporaryOrder.findByIdAndDelete(id, { session }).lean();
}

export async function countTemporaryOrders(filters = {}, { session } = {}) {
  return TemporaryOrder.countDocuments(buildTemporaryOrderFilter(filters)).session(session || null);
}

export default {
  createTemporaryOrder,
  findTemporaryOrderById,
  findTemporaryOrderByToken,
  findTemporaryOrders,
  findExpiredTemporaryOrders,
  deleteTemporaryOrderById,
  countTemporaryOrders,
};