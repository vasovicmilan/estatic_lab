import BusinessPartner from "../models/business-partner.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createBusinessPartner(data, { session } = {}) {
  const [partner] = await BusinessPartner.create([data], { session });
  return partner;
}

export async function findBusinessPartnerById(id, { session } = {}) {
  return BusinessPartner.findById(id).session(session || null).lean();
}

export async function findBusinessPartnerBySlug(slug, { session } = {}) {
  return BusinessPartner.findOne({ slug }).session(session || null).lean();
}

export async function findBusinessPartners({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = { ...filters };
  if (search) filter.name = { $regex: search, $options: "i" };

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    BusinessPartner.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    BusinessPartner.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// unpaginated - used by the public /saradnici list page, which shows every
// active partner on one page (no realistic scenario yet where Milan has enough
// of these to need pagination there)
export async function findActiveBusinessPartners({ session } = {}) {
  return BusinessPartner.find({ isActive: true }).sort({ createdAt: -1 }).session(session || null).lean();
}

export async function updateBusinessPartnerById(id, updateData, { session } = {}) {
  return BusinessPartner.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteBusinessPartnerById(id, { session } = {}) {
  return BusinessPartner.findByIdAndDelete(id, { session }).lean();
}

export async function findActiveSlugsForSitemap({ session } = {}) {
  return BusinessPartner.find({ isActive: true }, { slug: 1, updatedAt: 1 }).session(session || null).lean();
}

export default {
  createBusinessPartner,
  findBusinessPartnerById,
  findBusinessPartnerBySlug,
  findBusinessPartners,
  findActiveBusinessPartners,
  findActiveSlugsForSitemap,
  updateBusinessPartnerById,
  deleteBusinessPartnerById,
};
