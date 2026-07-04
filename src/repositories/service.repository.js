import Service from "../models/service.model.js";
import { buildServiceFilter } from "./filters/service.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createService(data, { session } = {}) {
  const [service] = await Service.create([data], { session });
  return service;
}

export async function findServiceById(id, { populateFields = [], session } = {}) {
  let query = Service.findById(id).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findServiceBySlug(slug, { populateFields = [], session } = {}) {
  let query = Service.findOne({ slug }).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

// used at booking time to pull just the chosen variant snapshot + validate it's active
export async function findServicePackageVariant(serviceId, servicePackageId, { session } = {}) {
  const service = await Service.findOne(
    { _id: serviceId, "packages._id": servicePackageId },
    { "packages.$": 1, name: 1, employees: 1 }
  )
    .session(session || null)
    .lean();
  if (!service?.packages?.length) return null;
  return { service, variant: service.packages[0] };
}

export async function findServices({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [
    { path: "categories", select: "name slug" },
    { path: "tags", select: "name slug" },
  ],
  session,
} = {}) {
  const filter = buildServiceFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Service.find(filter)
    .sort({ highlight: -1, createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);

  const [data, total] = await Promise.all([
    query.lean(),
    Service.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateServiceById(id, updateData, { session } = {}) {
  return Service.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteServiceById(id, { session } = {}) {
  return Service.findByIdAndDelete(id, { session }).lean();
}

export async function countServices(filters = {}, { session } = {}) {
  return Service.countDocuments(buildServiceFilter(filters)).session(session || null);
}
