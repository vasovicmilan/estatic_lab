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

// used at booking time to pull just the chosen variant snapshot + validate it's active -
// `resources` is included here (not just projected on the outer service.service.js query)
// because bookAppointment/availability.service.js need it directly off this result to
// resolve resource capacity, without a second round-trip to fetch the full service
export async function findServicePackageVariant(serviceId, servicePackageId, { session } = {}) {
  const service = await Service.findOne(
    { _id: serviceId, "packages._id": servicePackageId },
    { "packages.$": 1, name: 1, employees: 1, resources: 1 }
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
    .sort({ highlight: -1, createdAt: -1, _id: -1 })
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
  return Service.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteServiceById(id, { session } = {}) {
  return Service.findByIdAndDelete(id, { session }).lean();
}

export async function countServices(filters = {}, { session } = {}) {
  return Service.countDocuments(buildServiceFilter(filters)).session(session || null);
}

// Reverse lookup for the admin post-edit form's "Povezano: X usluga" summary -
// Post doesn't hold its own list of related services (it links out through
// free-form content blocks instead), so counting the other direction is the
// only way to show "this many services point back at this post".
export async function countServicesReferencingPost(postId, { session } = {}) {
  return Service.countDocuments({ relatedPosts: postId }).session(session || null);
}

// Called when a Category is deleted - Service.categories[] is current taxonomy
// assignment, not a promise to anyone, so it's safe to auto-clean rather than
// block the Category deletion on it.
export async function pullCategoryFromAllServices(categoryId, { session } = {}) {
  return Service.updateMany({ categories: categoryId }, { $pull: { categories: categoryId } }, { session });
}

// Called when a Tag is deleted - Service.tags[] is current taxonomy assignment,
// always safe to auto-clean.
export async function pullTagFromAllServices(tagId, { session } = {}) {
  return Service.updateMany({ tags: tagId }, { $pull: { tags: tagId } }, { session });
}

export async function findActiveSlugsForSitemap() {
  return Service.find({ isActive: true }, { slug: 1, updatedAt: 1 }).lean();
}

// Called when a Product is deleted - Service.relatedProducts[] is current
// merchandising config on this service ("preparation used in this treatment"), not
// a promise to anyone, safe to auto-clean the same way the other pull* helpers are.
export async function pullProductFromAllServices(productId, { session } = {}) {
  return Service.updateMany({ relatedProducts: productId }, { $pull: { relatedProducts: productId } }, { session });
}

export default {
  createService,
  findServiceById,
  findServiceBySlug,
  findServicePackageVariant,
  findServices,
  updateServiceById,
  deleteServiceById,
  countServices,
  countServicesReferencingPost,
  pullCategoryFromAllServices,
  pullTagFromAllServices,
  pullProductFromAllServices,
  findActiveSlugsForSitemap,
}