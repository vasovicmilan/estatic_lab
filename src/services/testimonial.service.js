import eventEmitter from "../events/event.emitter.js";
import testimonialRepo from "../repositories/testimonial.repository.js";
import serviceService from "./service.service.js";
import packageService from "./package.service.js";
import productService from "./product.service.js";
import {
  mapTestimonialsForAdminList,
  mapTestimonialForAdminDetail,
  mapTestimonialsForPublic,
} from "../mappers/testimonial.mapper.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

// Snapshot of the consent copy shown on testimonial-form.ejs at submit time -
// bump this if the wording of the consent checkbox label materially changes,
// so existing consent records still tell you what someone actually agreed to.
const CONSENT_TEXT_VERSION = "v1-2026-09";

export async function listTestimonials({ filters = {}, limit = 10, page = 1 } = {}) {
  const result = await testimonialRepo.findTestimonials({ limit, page, filters });
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

  const consentGiven = data.consentGiven === "on" || data.consentGiven === true || data.consentGiven === "true";
  if (!consentGiven) badRequest("Saglasnost za objavljivanje je obavezna");

  const created = await testimonialRepo.createTestimonial({
    name: data.name,
    email: data.email || "",
    user: data.userId || null,
    service: data.service || null,
    package: data.package || null,
    product: data.product || null,
    rating: data.rating,
    message: data.message,
    image: data.image || null,
    status: "pending",
    consentGiven: true,
    consent: {
      givenAt: new Date(),
      ipAddress: data.consentIpAddress || null,
      textVersion: CONSENT_TEXT_VERSION,
    },
  });

  logInfo("Testimonial submitted", { testimonialId: created._id, name: created.name });

  let subject = null;
  try {
    if (data.service) {
      const service = await serviceService.getServiceById(data.service);
      subject = service?.naziv || null;
    } else if (data.package) {
      const pkg = await packageService.getPackageById(data.package);
      subject = pkg?.naziv || null;
    } else if (data.product) {
      const product = await productService.getProductById(data.product);
      subject = product?.naziv || null;
    }
  } catch {
    subject = null;
  }

  eventEmitter.emit("testimonial:submitted", {
    testimonialId: created._id,
    name: created.name,
    rating: created.rating,
    message: created.message,
    subject,
  });

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

export async function getApprovedTestimonials({ limit = 10, featuredOnly = false, service = null, package: pkg = null, product = null, random = false } = {}) {
  const testimonials = await testimonialRepo.findApprovedTestimonials({ limit, featuredOnly, service, package: pkg, product, random });
  return mapTestimonialsForPublic(testimonials);
}

export async function getRatingSummary({ service = null, package: pkg = null, product = null } = {}) {
  return testimonialRepo.getRatingSummary({ service, package: pkg, product });
}

export default {
  listTestimonials,
  getTestimonialById,
  submitTestimonial,
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonialById,
  getApprovedTestimonials,
  getRatingSummary,
};