import Package from "../models/package.model.js";
import { buildPackageFilter } from "./filters/package.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createPackage(data, { session } = {}) {
  const [pkg] = await Package.create([data], { session });
  return pkg;
}

export async function findPackageById(id, { populateFields = [], session } = {}) {
  let query = Package.findById(id).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findPackageBySlug(slug, { populateFields = [], session } = {}) {
  let query = Package.findOne({ slug }).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findPackages({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "items.service", select: "name slug" }],
  session,
} = {}) {
  const filter = buildPackageFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Package.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);

  const [data, total] = await Promise.all([
    query.lean(),
    Package.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updatePackageById(id, updateData, { session } = {}) {
  return Package.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deletePackageById(id, { session } = {}) {
  return Package.findByIdAndDelete(id, { session }).lean();
}

export async function countPackages(filters = {}, { session } = {}) {
  return Package.countDocuments(buildPackageFilter(filters)).session(session || null);
}