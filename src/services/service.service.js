import serviceRepo from "../repositories/service.repository.js";
import {
  mapServicesForAdminList,
  mapServiceForAdminDetail,
  mapServiceForEdit,
  mapServicesForPublic,
  mapServiceForPublicDetail,
} from "../mappers/service.mapper.js";
import { generateSlug, generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const adminPopulate = [
  { path: "categories", select: "name slug" },
  { path: "tags", select: "name slug" },
];

function validatePackages(packages = []) {
  if (!packages.length) badRequest("Usluga mora imati bar jednu varijantu (paket) za zakazivanje");
  for (const p of packages) {
    if (!p.name) badRequest("Svaka varijanta mora imati naziv");
    if (!p.duration || p.duration < 5) badRequest(`Varijanta "${p.name}" mora imati trajanje od bar 5 minuta`);
    if (p.totalPrice == null || p.totalPrice < 0) badRequest(`Varijanta "${p.name}" mora imati validnu cenu`);
  }
}

/**
 * Each Service.packages[] entry (see service-package.schema.js) needs its own slug.
 * Collisions here only matter *within this one service's own list* (two variants of the
 * SAME service can't share a slug, but a slug can repeat across different services fine)
 * — so uniqueness is checked against sibling entries in the same array, not the database.
 */
function assignPackageSlugs(packages = []) {
  const usedSlugs = new Set();

  return packages.map((p) => {
    if (p.slug) {
      usedSlugs.add(p.slug);
      return p;
    }

    const base = generateSlug(p.name);
    let candidate = base;
    let suffix = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(candidate);
    return { ...p, slug: candidate };
  });
}

export async function listServices({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await serviceRepo.findServices({ search, limit, page, filters, populateFields: adminPopulate });
  return { data: mapServicesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getServiceById(serviceId) {
  if (!serviceId) validationError("serviceId");
  const service = await serviceRepo.findServiceById(serviceId, { populateFields: adminPopulate });
  if (!service) notFound("Usluga");
  return mapServiceForAdminDetail(service);
}

export async function getServiceForEdit(serviceId) {
  if (!serviceId) validationError("serviceId");
  const service = await serviceRepo.findServiceById(serviceId, { populateFields: adminPopulate });
  if (!service) notFound("Usluga");
  return mapServiceForEdit(service);
}

export async function getServiceBySlug(slug) {
  if (!slug) validationError("slug");
  const service = await serviceRepo.findServiceBySlug(slug, { populateFields: adminPopulate });
  if (!service || !service.isActive) notFound("Usluga");
  return mapServiceForPublicDetail(service);
}

export async function findActiveServices({ limit = 12, page = 1, filters = {} } = {}) {
  const result = await serviceRepo.findServices({
    limit,
    page,
    filters: { ...filters, isActive: true },
    populateFields: adminPopulate,
  });
  return { data: mapServicesForPublic(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function findHighlightedServices({ limit = 6 } = {}) {
  const result = await serviceRepo.findServices({ limit, filters: { isActive: true, highlight: true }, populateFields: adminPopulate });
  return mapServicesForPublic(result.data);
}

export async function findServicesByCategorySlug(categorySlug, { limit = 12, page = 1 } = {}) {
  // NOTE: resolving the category id from slug is the controller's job (via category.service.js)
  // — this function takes the already-resolved categoryId through `filters` to avoid a
  // circular service->service->service dependency chain.
  return findActiveServices({ limit, page, filters: {} });
}

export async function createService(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (!data.image?.img) validationError("image");

  data.packages = assignPackageSlugs(data.packages || []);
  validatePackages(data.packages);

  if (data.slug) {
    const existing = await serviceRepo.findServiceBySlug(data.slug);
    if (existing) conflict("Usluga sa ovim slug-om već postoji");
  } else {
    data.slug = await generateUniqueSlug(data.name, (candidate) => serviceRepo.findServiceBySlug(candidate));
  }

  const created = await serviceRepo.createService(data);
  logInfo("Service created", { serviceId: created._id, name: created.name, slug: created.slug });
  return getServiceById(created._id);
}

export async function updateServiceById(serviceId, data) {
  if (!serviceId) validationError("serviceId");
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) notFound("Usluga");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await serviceRepo.findServiceBySlug(data.slug);
    if (conflicting) conflict("Usluga sa ovim slug-om već postoji");
  }
  if (data.packages) {
    data.packages = assignPackageSlugs(data.packages);
    validatePackages(data.packages);
  }

  const updated = await serviceRepo.updateServiceById(serviceId, data);
  logInfo("Service updated", { serviceId, updatedFields: Object.keys(data) });
  return getServiceById(updated._id);
}

export async function updateServiceSeo(serviceId, seoKeywords) {
  if (!serviceId) validationError("serviceId");
  const updated = await serviceRepo.updateServiceById(serviceId, { seoKeywords: seoKeywords || [] });
  if (!updated) notFound("Usluga");
  return getServiceById(updated._id);
}

export async function deleteServiceById(serviceId) {
  if (!serviceId) validationError("serviceId");
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) notFound("Usluga");
  await serviceRepo.deleteServiceById(serviceId);
  logInfo("Service deleted", { serviceId });
  return { success: true };
}

/**
 * Pulls just the chosen variant + validates it's active — the read-only step that
 * happens before appointment.service.js opens its booking transaction.
 */
export async function getActiveVariant(serviceId, servicePackageId) {
  if (!serviceId) validationError("serviceId");
  if (!servicePackageId) validationError("servicePackageId");

  const result = await serviceRepo.findServicePackageVariant(serviceId, servicePackageId);
  if (!result) notFound("Varijanta usluge");
  if (!result.service.name) notFound("Usluga");
  if (result.variant.isActive === false) badRequest("Ova varijanta trenutno nije dostupna za zakazivanje");

  return result; // { service: { _id, name, employees }, variant: { _id, name, duration, totalPrice, ... } }
}

export default {
  listServices,
  getServiceById,
  getServiceForEdit,
  getServiceBySlug,
  findActiveServices,
  findHighlightedServices,
  findServicesByCategorySlug,
  createService,
  updateServiceById,
  updateServiceSeo,
  deleteServiceById,
  getActiveVariant,
};