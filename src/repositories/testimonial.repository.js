import Testimonial from "../models/testimonial.model.js";
import { buildTestimonialFilter } from "./filters/testimonial.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createTestimonial(data, { session } = {}) {
  const [testimonial] = await Testimonial.create([data], { session });
  return testimonial;
}

export async function findTestimonialById(id, { session } = {}) {
  return Testimonial.findById(id).session(session || null).lean();
}

export async function findTestimonials({
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "service", select: "name slug" }],
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

// public "what our clients say" widget — approved only, featured first
export async function findApprovedTestimonials({ limit = 10, featuredOnly = false, session } = {}) {
  const filter = { status: "approved" };
  if (featuredOnly) filter.isFeatured = true;
  return Testimonial.find(filter)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(limit)
    .session(session || null)
    .lean();
}

export async function updateTestimonialById(id, updateData, { session } = {}) {
  return Testimonial.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteTestimonialById(id, { session } = {}) {
  return Testimonial.findByIdAndDelete(id, { session }).lean();
}

export async function countTestimonials(filters = {}, { session } = {}) {
  return Testimonial.countDocuments(buildTestimonialFilter(filters)).session(session || null);
}
