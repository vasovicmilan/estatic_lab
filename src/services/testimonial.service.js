import eventEmitter from "../events/event.emitter.js";
import * as testimonialRepo from "../repositories/testimonial.repository.js";
import {
  mapTestimonialsForAdminList,
  mapTestimonialForAdminDetail,
  mapTestimonialsForPublic,
} from "../mappers/testimonial.mapper.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const populate = [{ path: "service", select: "name slug" }];

export async function listTestimonials({ filters = {}, limit = 10, page = 1 } = {}) {
  const result = await testimonialRepo.findTestimonials({ limit, page, filters, populateFields: populate });
  return { data: mapTestimonialsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getTestimonialById(testimonialId) {
  if (!testimonialId) validationError("testimonialId");
  const testimonial = await testimonialRepo.findTestimonialById(testimonialId);
  if (!testimonial) notFound("Testimonijal");
  return mapTestimonialForAdminDetail(testimonial);
}

export async function submitTestimonial(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (!data.rating) validationError("rating");
  if (!data.message) validationError("message");
  if (data.rating < 1 || data.rating > 5) badRequest("Ocena mora biti između 1 i 5");

  const created = await testimonialRepo.createTestimonial({
    name: data.name,
    email: data.email || "",
    user: data.userId || null,
    service: data.serviceId || null,
    rating: data.rating,
    message: data.message,
    image: data.image || null,
    status: "pending",
  });

  logInfo("Testimonial submitted", { testimonialId: created._id, name: created.name });
  eventEmitter.emit("testimonial:submitted", { testimonialId: created._id, name: created.name, rating: created.rating });

  return { message: "Hvala na utisku! Biće objavljen nakon provere." };
}

export async function approveTestimonial(testimonialId, { isFeatured = false } = {}) {
  if (!testimonialId) validationError("testimonialId");
  const updated = await testimonialRepo.updateTestimonialById(testimonialId, { status: "approved", isFeatured });
  if (!updated) notFound("Testimonijal");
  logInfo("Testimonial approved", { testimonialId, isFeatured });
  return getTestimonialById(updated._id);
}

export async function rejectTestimonial(testimonialId) {
  if (!testimonialId) validationError("testimonialId");
  const updated = await testimonialRepo.updateTestimonialById(testimonialId, { status: "rejected", isFeatured: false });
  if (!updated) notFound("Testimonijal");
  logInfo("Testimonial rejected", { testimonialId });
  return getTestimonialById(updated._id);
}

export async function deleteTestimonialById(testimonialId) {
  if (!testimonialId) validationError("testimonialId");
  const existing = await testimonialRepo.findTestimonialById(testimonialId);
  if (!existing) notFound("Testimonijal");
  await testimonialRepo.deleteTestimonialById(testimonialId);
  logInfo("Testimonial deleted", { testimonialId });
  return { success: true };
}

export async function getApprovedTestimonials({ limit = 10, featuredOnly = false } = {}) {
  const testimonials = await testimonialRepo.findApprovedTestimonials({ limit, featuredOnly });
  return mapTestimonialsForPublic(testimonials);
}

export default {
  listTestimonials,
  getTestimonialById,
  submitTestimonial,
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonialById,
  getApprovedTestimonials,
};