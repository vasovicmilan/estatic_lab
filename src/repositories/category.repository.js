import Category from "../models/category.model.js";
import { buildCategoryFilter } from "./filters/category.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createCategory(data, { session } = {}) {
  const [category] = await Category.create([data], { session });
  return category;
}

export async function findCategoryById(id, { session } = {}) {
  return Category.findById(id).session(session || null).lean();
}

export async function findCategoryBySlug(slug, domain, { session } = {}) {
  return Category.findOne({ slug, domain }).session(session || null).lean();
}

export async function findCategories({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  session,
} = {}) {
  const filter = buildCategoryFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Category.find(filter)
      .sort({ "meta.priority": -1, name: 1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    Category.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function findAllCategoriesByDomain(domain, { onlyActive = true, session } = {}) {
  const filter = { domain };
  if (onlyActive) filter["meta.isActive"] = true;
  return Category.find(filter).sort({ "meta.priority": -1, name: 1 }).session(session || null).lean();
}

export async function updateCategoryById(id, updateData, { session } = {}) {
  return Category.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteCategoryById(id, { session } = {}) {
  return Category.findByIdAndDelete(id, { session }).lean();
}

export async function countCategories(filters = {}, { session } = {}) {
  return Category.countDocuments(buildCategoryFilter(filters)).session(session || null);
}