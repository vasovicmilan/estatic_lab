import Lead from "../models/lead.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createLead(data) {
  const [lead] = await Lead.create([data]);
  return lead;
}

export async function findLeadById(id) {
  return Lead.findById(id).populate("coupon", "usedCount maxUses validUntil isActive").populate("wheel", "name slug").lean();
}

// "jedno vrtenje po osobi" važi po točku
export async function findLeadByEmailOrPhoneHash(email, phoneHash, wheelId) {
  return Lead.findOne({ wheel: wheelId, $or: [{ email }, { "phone.hash": phoneHash }] }).lean();
}

// kontakti iz doba pre više točkova (bez polja wheel) -> podrazumevani točak
export async function assignOrphanLeadsToWheel(wheelId) {
  return Lead.collection.updateMany({ wheel: { $exists: false } }, { $set: { wheel: wheelId } });
}

export async function countByWheel() {
  const rows = await Lead.aggregate([{ $group: { _id: "$wheel", count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function deleteLeadById(id) {
  return Lead.findByIdAndDelete(id).lean();
}

function buildLeadFilter({ search = "", segment = null, source = null, wheel = null } = {}) {
  const filter = {};
  if (search) {
    const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ firstName: rx }, { email: rx }, { couponCode: rx }, { source: rx }];
  }
  if (segment) filter.segment = segment;
  if (source) filter.source = source;
  if (wheel) filter.wheel = wheel;
  return filter;
}

export async function findLeads({ search = "", limit = 20, page = 1, filters = {}, sort = { createdAt: -1, _id: -1 } } = {}) {
  const filter = buildLeadFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);
  const [data, total] = await Promise.all([
    Lead.find(filter).populate("coupon", "usedCount").populate("wheel", "name slug").sort(sort).skip(skip).limit(resolvedLimit).lean(),
    Lead.countDocuments(filter),
  ]);
  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// everything matching the filter, for the CSV export (no pagination)
export async function findAllLeadsForExport(filters = {}) {
  return Lead.find(buildLeadFilter(filters)).populate("coupon", "usedCount").populate("wheel", "name slug").sort({ createdAt: -1 }).lean();
}

export async function findLeadsByCouponIds(couponIds = []) {
  if (!couponIds.length) return [];
  return Lead.find({ coupon: { $in: couponIds } }, { coupon: 1, firstName: 1, lastName: 1, email: 1 }).lean();
}

export async function allCouponIds() {
  return Lead.distinct("coupon");
}

/**
 * Emails of wheel contacts matching a campaign audience: any of `sources` (empty = any source),
 * and - with `onlyUnusedCoupon` - only those whose coupon has not been used. Lead emails are
 * stored lower-cased, same as newsletter subscribers', so the result can be matched directly.
 */
export async function findEmailsByAudience({ sources = [], onlyUnusedCoupon = false } = {}) {
  const match = {};
  if (sources.length) match.source = { $in: sources };

  if (!onlyUnusedCoupon) return Lead.distinct("email", match);

  const rows = await Lead.aggregate([
    { $match: match },
    { $lookup: { from: "coupons", localField: "coupon", foreignField: "_id", as: "couponDoc" } },
    { $match: { $or: [{ couponDoc: { $size: 0 } }, { "couponDoc.0.usedCount": { $in: [0, null] } }, { "couponDoc.0.usedCount": { $exists: false } }] } },
    { $group: { _id: "$email" } },
  ]);
  return rows.map((row) => row._id);
}

export async function distinctSources() {
  return Lead.distinct("source");
}

export default { createLead, findLeadById, findLeadByEmailOrPhoneHash, deleteLeadById, findLeads, findAllLeadsForExport, distinctSources, findEmailsByAudience, findLeadsByCouponIds, allCouponIds, assignOrphanLeadsToWheel, countByWheel };
