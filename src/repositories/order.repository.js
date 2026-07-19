import Order from "../models/order.model.js";
import { buildOrderFilter } from "./filters/order.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

const DEFAULT_POPULATE = [
  { path: "user", select: "firstName lastName email phone" },
  { path: "coupon", select: "code" },
];

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createOrder(data, { session } = {}) {
  const [order] = await Order.create([data], { session });
  return order;
}

export async function findOrderById(id, { populateFields = DEFAULT_POPULATE, session } = {}) {
  let query = Order.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

// lets a guest look up/cancel their own order from the confirmation email without
// needing to log in
export async function findOrderByCancelToken(token, { populateFields = DEFAULT_POPULATE, session } = {}) {
  let query = Order.findOne({ cancelToken: token }).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findOrders({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = DEFAULT_POPULATE,
  session,
} = {}) {
  const filter = buildOrderFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    Order.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function findOrdersByUser(userId, options = {}) {
  const { populateFields, session, ...rest } = options;
  return findOrders({
    ...rest,
    filters: { ...(rest.filters || {}), user: userId },
    populateFields: populateFields || [{ path: "coupon", select: "code" }],
    session,
  });
}

export async function updateOrderById(id, updateData, { session } = {}) {
  return Order.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function countOrders(filters = {}, { session } = {}) {
  return Order.countDocuments(buildOrderFilter(filters)).session(session || null);
}

export default {
  createOrder,
  findOrderById,
  findOrderByCancelToken,
  findOrders,
  findOrdersByUser,
  updateOrderById,
  countOrders,
};