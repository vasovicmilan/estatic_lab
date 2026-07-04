import Expert from "../models/expert.model.js";
import { buildExpertFilter } from "./filters/expert.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createExpert(data, { session } = {}) {
  const [expert] = await Expert.create([data], { session });
  return expert;
}

export async function findExpertById(id, { session } = {}) {
  return Expert.findById(id).session(session || null).lean();
}

export async function findExpertBySlug(slug, { session } = {}) {
  return Expert.findOne({ slug }).session(session || null).lean();
}

export async function findExperts({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "services", select: "name slug" }],
  session,
} = {}) {
  const filter = buildExpertFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Expert.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);

  const [data, total] = await Promise.all([
    query.lean(),
    Expert.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// public "our experts" listing — active only, ordered for display, no pagination noise
export async function findActiveExperts({ session } = {}) {
  return Expert.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).session(session || null).lean();
}

export async function updateExpertById(id, updateData, { session } = {}) {
  return Expert.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteExpertById(id, { session } = {}) {
  return Expert.findByIdAndDelete(id, { session }).lean();
}

export async function countExperts(filters = {}, { session } = {}) {
  return Expert.countDocuments(buildExpertFilter(filters)).session(session || null);
}

export default {
  createExpert,
  findExpertById,
  findExpertBySlug,
  findExperts,
  findActiveExperts,
  updateExpertById,
  deleteExpertById,
  countExperts,
}