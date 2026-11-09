import Lead from "../models/lead.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createLead(data) {
  const [lead] = await Lead.create([data]);
  return lead;
}

export async function findLeadById(id) {
  return Lead.findById(id).populate("coupon", "usedCount maxUses validUntil isActive").lean();
}

export async function findLeadByEmailOrPhoneHash(email, phoneHash) {
  return Lead.findOne({ $or: [{ email }, { "phone.hash": phoneHash }] }).lean();
}

export async function deleteLeadById(id) {
  return Lead.findByIdAndDelete(id).lean();
}

function buildLeadFilter({ search = "", segment = null, source = null } = {}) {
  const filter = {};
  if (search) {
    const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ firstName: rx }, { email: rx }, { couponCode: rx }, { source: rx }];
  }
  if (segment) filter.segment = segment;
  if (source) filter.source = source;
  return filter;
}

export async function findLeads({ search = "", limit = 20, page = 1, filters = {}, sort = { createdAt: -1, _id: -1 } } = {}) {
  const filter = buildLeadFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);
  const [data, total] = await Promise.all([
    Lead.find(filter).populate("coupon", "usedCount").sort(sort).skip(skip).limit(resolvedLimit).lean(),
    Lead.countDocuments(filter),
  ]);
  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// everything matching the filter, for the CSV export (no pagination)
export async function findAllLeadsForExport(filters = {}) {
  return Lead.find(buildLeadFilter(filters)).populate("coupon", "usedCount").sort({ createdAt: -1 }).lean();
}

export async function distinctSources() {
  return Lead.distinct("source");
}

export default { createLead, findLeadById, findLeadByEmailOrPhoneHash, deleteLeadById, findLeads, findAllLeadsForExport, distinctSources };
