import Partner from "../models/partner.model.js";
import { buildPartnerFilter } from "./filters/partner.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createPartner(data, { session } = {}) {
  const [partner] = await Partner.create([data], { session });
  return partner;
}

export async function findPartnerById(id, { populateFields = [], session } = {}) {
  let query = Partner.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findPartnerByUserId(userId, { populateFields = [], session } = {}) {
  let query = Partner.findOne({ userId }).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findPartners({
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "userId", select: "firstName lastName email phone" }],
  session,
} = {}) {
  const filter = buildPartnerFilter(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Partner.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    Partner.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updatePartnerById(id, updateData, { session } = {}) {
  return Partner.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deletePartnerById(id, { session } = {}) {
  return Partner.findByIdAndDelete(id, { session }).lean();
}

export async function countPartners(filters = {}, { session } = {}) {
  return Partner.countDocuments(buildPartnerFilter(filters)).session(session || null);
}

export default {
  createPartner,
  findPartnerById,
  findPartnerByUserId,
  findPartners,
  updatePartnerById,
  deletePartnerById,
  countPartners,
};