import Testimonial from "../models/testimonial.model.js";
import { buildTestimonialFilter } from "./filters/testimonial.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

// shared populate set - every read path (admin list/detail, public widget) needs
// the same three relations resolved, or the mapper has nothing to work with:
// service/package for "usluga"/"paket" name+slug, user for the "registered
// customer" badge + avatar fallback. Previously only `service` was populated,
// and only on the admin list - package, user, and the public-facing reads
// never got it, so those fields silently rendered empty everywhere else.
const TESTIMONIAL_POPULATE = [
  { path: "service", select: "name slug" },
  { path: "package", select: "name slug" },
  { path: "product", select: "name slug" },
  { path: "user", select: "firstName lastName avatar" },
];

export async function createTestimonial(data, { session } = {}) {
  const [testimonial] = await Testimonial.create([data], { session });
  return testimonial;
}

export async function findTestimonialById(id, { session } = {}) {
  let query = Testimonial.findById(id).session(session || null);
  for (const field of TESTIMONIAL_POPULATE) query = query.populate(field);
  return query.lean();
}

export async function findTestimonials({
  limit = 20,
  page = 1,
  filters = {},
  populateFields = TESTIMONIAL_POPULATE,
  session,
} = {}) {
  const filter = buildTestimonialFilter(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Testimonial.find(filter)
    .sort({ isFeatured: -1, createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);

  const [data, total] = await Promise.all([
    query.lean(),
    Testimonial.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// public "what our clients say" widget - approved only, featured first
export async function findApprovedTestimonials({ limit = 10, featuredOnly = false, service = null, package: pkg = null, product = null, session } = {}) {
  const filter = { status: "approved" };
  if (featuredOnly) filter.isFeatured = true;
  if (service) filter.service = service;
  if (pkg) filter.package = pkg;
  if (product) filter.product = product;

  let query = Testimonial.find(filter)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(limit)
    .session(session || null);
  for (const field of TESTIMONIAL_POPULATE) query = query.populate(field);

  return query.lean();
}

export async function updateTestimonialById(id, updateData, { session } = {}) {
  return Testimonial.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteTestimonialById(id, { session } = {}) {
  return Testimonial.findByIdAndDelete(id, { session }).lean();
}

export async function countTestimonials(filters = {}, { session } = {}) {
  return Testimonial.countDocuments(buildTestimonialFilter(filters)).session(session || null);
}

export default {
  createTestimonial,
  findTestimonialById,
  findTestimonials,
  findApprovedTestimonials,
  updateTestimonialById,
  deleteTestimonialById,
  countTestimonials,
};