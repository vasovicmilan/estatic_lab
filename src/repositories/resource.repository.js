import Resource from "../models/resource.model.js";
import { buildResourceFilter } from "./filters/resource.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createResource(data, { session } = {}) {
  const [resource] = await Resource.create([data], { session });
  return resource;
}

export async function findResourceById(id, { session } = {}) {
  return Resource.findById(id).session(session || null).lean();
}

export async function findResources({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildResourceFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Resource.find(filter).sort({ name: 1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    Resource.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// full list for the admin select dropdown on the Service form - deliberately
// includes inactive resources so an admin can still see/reassign what a
// service currently points to even if that resource was since deactivated
export async function findAllResources({ session } = {}) {
  return Resource.find({}).sort({ name: 1, _id: -1 }).session(session || null).lean();
}

export async function updateResourceById(id, updateData, { session } = {}) {
  return Resource.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteResourceById(id, { session } = {}) {
  return Resource.findByIdAndDelete(id, { session }).lean();
}

export async function countResources(filters = {}, { session } = {}) {
  return Resource.countDocuments(buildResourceFilter(filters)).session(session || null);
}

export default {
  createResource,
  findResourceById,
  findResources,
  findAllResources,
  updateResourceById,
  deleteResourceById,
  countResources,
};