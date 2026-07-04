import Tag from "../models/tag.model.js";
import { buildTagFilter } from "./filters/tag.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createTag(data, { session } = {}) {
  const [tag] = await Tag.create([data], { session });
  return tag;
}

export async function findTagById(id, { session } = {}) {
  return Tag.findById(id).session(session || null).lean();
}

export async function findTagBySlug(slug, domain, { session } = {}) {
  return Tag.findOne({ slug, domain }).session(session || null).lean();
}

export async function findTags({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildTagFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Tag.find(filter).sort({ name: 1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    Tag.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function findAllTagsByDomain(domain, { onlyActive = true, session } = {}) {
  const filter = { domain };
  if (onlyActive) filter.isActive = true;
  return Tag.find(filter).sort({ name: 1 }).session(session || null).lean();
}

export async function updateTagById(id, updateData, { session } = {}) {
  return Tag.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteTagById(id, { session } = {}) {
  return Tag.findByIdAndDelete(id, { session }).lean();
}

export async function countTags(filters = {}, { session } = {}) {
  return Tag.countDocuments(buildTagFilter(filters)).session(session || null);
}