import serviceRepo from "../repositories/service.repository.js";
import {
  mapServicesForAdminList,
  mapServiceForAdminDetail,
  mapServiceForEdit,
  mapServicesForPublic,
  mapServiceForPublicDetail,
} from "../mappers/service.mapper.js";
import categoryService from "./category.service.js";
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
 * - so uniqueness is checked against sibling entries in the same array, not the database.
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

// Reused by both the schema-level publish guard's callers (phase 3) - same rules,
// thrown as our own badRequest() here so the controller gets a normal 400 instead of
// a raw Mongoose ValidationError when the check fails before we even hit the DB.
function assertPublishable(service) {
  if (!service.image?.img) badRequest("Usluga mora imati sliku pre objavljivanja");
  validatePackages(service.packages || []);
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

/**
 * Raw (unmapped) service for package.service.js's internal validation use only -
 * needs the raw `packages` array with `_id` fields to check a variant actually
 * belongs to the service, which the mapped shape (packages -> varijante, renamed
 * fields) doesn't expose in the right form. Returns null rather than throwing,
 * unlike getServiceById, since the caller has its own not-found message.
 */
export async function getServiceByIdRaw(serviceId) {
  if (!serviceId) return null;
  return serviceRepo.findServiceById(serviceId);
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
  const category = await categoryService.getCategoryBySlugAndDomain(categorySlug, "service");
  return findActiveServices({ limit, page, filters: { category: category._id } });
}

// ---- Phase 1: core info + image -------------------------------------------------
export async function createDraftService(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");

  const payload = { ...data, isActive: false, packages: [] };

  if (payload.slug) {
    const existing = await serviceRepo.findServiceBySlug(payload.slug);
    if (existing) conflict("Usluga sa ovim slug-om već postoji");
  } else {
    payload.slug = await generateUniqueSlug(payload.name, (candidate) => serviceRepo.findServiceBySlug(candidate));
  }

  const created = await serviceRepo.createService(payload);
  logInfo("Service draft created (phase 1)", { serviceId: created._id, name: created.name, slug: created.slug });
  return mapServiceForEdit(created);
}

// ---- Phase 2: packages/variants -------------------------------------------------
export async function addPackagesToService(serviceId, packages) {
  if (!serviceId) validationError("serviceId");
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) notFound("Usluga");

  validatePackages(packages || []);
  const withSlugs = assignPackageSlugs(packages);

  const updated = await serviceRepo.updateServiceById(serviceId, { packages: withSlugs });
  logInfo("Service packages saved (phase 2)", { serviceId, packageCount: withSlugs.length });
  return mapServiceForEdit(updated);
}

// ---- Phase 3: optional extras + publish -----------------------------------------
export async function addExtrasAndPublish(serviceId, data) {
  if (!serviceId) validationError("serviceId");
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) notFound("Usluga");

  const merged = {
    features: data.features ?? existing.features ?? [],
    comparisonColumns: data.comparisonColumns ?? existing.comparisonColumns ?? [],
    comparisonTable: data.comparisonTable ?? existing.comparisonTable ?? [],
    faq: data.faq ?? existing.faq ?? [],
    highlight: data.highlight ?? existing.highlight ?? false,
    isActive: data.isActive ?? true,
  };

  if (merged.isActive) assertPublishable({ ...existing, ...merged });

  const updated = await serviceRepo.updateServiceById(serviceId, merged);
  logInfo("Service extras saved" + (merged.isActive ? " and published (phase 3)" : " as draft (phase 3)"), { serviceId });
  return mapServiceForAdminDetail(updated);
}

export async function updateServiceById(serviceId, data) {
  if (!serviceId) validationError("serviceId");
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) notFound("Usluga");

  // QUESTION: NEEDS TO BE CHECKED DOES IT HAVE SENS AND DOES THIS WORK
  if (data.name) {
    data.slug = generateSlug(data.name);
  }

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

export async function getActiveVariant(serviceId, servicePackageId) {
  if (!serviceId) validationError("serviceId");
  if (!servicePackageId) validationError("servicePackageId");

  const result = await serviceRepo.findServicePackageVariant(serviceId, servicePackageId);
  if (!result) notFound("Varijanta usluge");
  if (!result.service.name) notFound("Usluga");
  if (result.variant.isActive === false) badRequest("Ova varijanta trenutno nije dostupna za zakazivanje");

  return result;
}

export default {
  listServices,
  getServiceById,
  getServiceByIdRaw,
  getServiceForEdit,
  getServiceBySlug,
  findActiveServices,
  findHighlightedServices,
  findServicesByCategorySlug,
  createDraftService,
  addPackagesToService,
  addExtrasAndPublish,
  updateServiceById,
  updateServiceSeo,
  deleteServiceById,
  getActiveVariant,
};