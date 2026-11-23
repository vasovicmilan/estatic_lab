import Material from "../models/material.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function createMaterial(data) {
  const [material] = await Material.create([data]);
  return material;
}

export async function findMaterialById(id) {
  return Material.findById(id).lean();
}

export async function findMaterialBySlug(slug) {
  return Material.findOne({ slug: String(slug || "").toLowerCase() }).lean();
}

export async function materialSlugExists(slug) {
  return !!(await Material.exists({ slug }));
}

export async function findMaterials({ search = "", limit = 20, page = 1, filters = {}, sort = { createdAt: -1, _id: -1 } } = {}) {
  const filter = {};
  if (search) filter.$or = [{ title: { $regex: escapeRegex(search), $options: "i" } }, { slug: { $regex: escapeRegex(search), $options: "i" } }];
  if (filters.isActive === true || filters.isActive === false) filter.isActive = filters.isActive;

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);
  const [data, total] = await Promise.all([
    Material.find(filter).sort(sort).skip(skip).limit(resolvedLimit).lean(),
    Material.countDocuments(filter),
  ]);
  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// what the campaign editor's "file" block offers in its dropdown
export async function findActiveMaterialOptions() {
  return Material.find({ isActive: true }, { title: 1, slug: 1 }).sort({ title: 1 }).lean();
}

export async function updateMaterialById(id, data) {
  return Material.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
}

export async function deleteMaterialById(id) {
  return Material.findByIdAndDelete(id).lean();
}

export async function incrementViewCount(id) {
  return Material.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
}

export async function incrementDownloadCount(id) {
  return Material.updateOne({ _id: id }, { $inc: { downloadCount: 1 } });
}

export default {
  createMaterial,
  findMaterialById,
  findMaterialBySlug,
  materialSlugExists,
  findMaterials,
  findActiveMaterialOptions,
  updateMaterialById,
  deleteMaterialById,
  incrementViewCount,
  incrementDownloadCount,
};
