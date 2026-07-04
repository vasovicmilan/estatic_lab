import packageRepo from "../repositories/package.repository.js";
import {
  mapPackagesForAdminList,
  mapPackageForAdminDetail,
  mapPackageForEdit,
  mapPackagesForPublic,
  mapPackageForPublicDetail,
} from "../mappers/package.mapper.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const populate = [{ path: "items.service", select: "name slug" }];

function validateItems(items = []) {
  if (!items.length) badRequest("Paket mora sadržati bar jednu uslugu");
  for (const item of items) {
    if (!item.service) badRequest("Svaka stavka paketa mora imati izabranu uslugu");
    if (!item.sessions || item.sessions < 1) badRequest("Broj seansi mora biti bar 1");
  }
}

export async function listPackages({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await packageRepo.findPackages({ search, limit, page, filters, populateFields: populate });
  return { data: mapPackagesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getPackageById(packageId) {
  if (!packageId) validationError("packageId");
  const pkg = await packageRepo.findPackageById(packageId, { populateFields: populate });
  if (!pkg) notFound("Paket");
  return mapPackageForAdminDetail(pkg);
}

export async function getPackageForEdit(packageId) {
  if (!packageId) validationError("packageId");
  const pkg = await packageRepo.findPackageById(packageId, { populateFields: populate });
  if (!pkg) notFound("Paket");
  return mapPackageForEdit(pkg);
}

export async function getPackageBySlug(slug) {
  if (!slug) validationError("slug");
  const pkg = await packageRepo.findPackageBySlug(slug, { populateFields: populate });
  if (!pkg || !pkg.isActive) notFound("Paket");
  return mapPackageForPublicDetail(pkg);
}

export async function findActivePackages({ limit = 10, page = 1 } = {}) {
  const result = await packageRepo.findPackages({ limit, page, filters: { isActive: true }, populateFields: populate });
  return { data: mapPackagesForPublic(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function createPackage(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (data.totalPrice == null) validationError("totalPrice");
  validateItems(data.items);

  if (data.slug) {
    const existing = await packageRepo.findPackageBySlug(data.slug);
    if (existing) conflict("Paket sa ovim slug-om već postoji");
  } else {
    data.slug = await generateUniqueSlug(data.name, (candidate) => packageRepo.findPackageBySlug(candidate));
  }

  const created = await packageRepo.createPackage(data);
  logInfo("Package created", { packageId: created._id, name: created.name, slug: created.slug });
  return getPackageById(created._id);
}

export async function updatePackageById(packageId, data) {
  if (!packageId) validationError("packageId");
  const existing = await packageRepo.findPackageById(packageId);
  if (!existing) notFound("Paket");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await packageRepo.findPackageBySlug(data.slug);
    if (conflicting) conflict("Paket sa ovim slug-om već postoji");
  }
  if (data.items) validateItems(data.items);

  const updated = await packageRepo.updatePackageById(packageId, data);
  logInfo("Package updated", { packageId, updatedFields: Object.keys(data) });
  return getPackageById(updated._id);
}

export async function deletePackageById(packageId) {
  if (!packageId) validationError("packageId");
  const existing = await packageRepo.findPackageById(packageId);
  if (!existing) notFound("Paket");
  await packageRepo.deletePackageById(packageId);
  logInfo("Package deleted", { packageId });
  return { success: true };
}

export default {
  listPackages,
  getPackageById,
  getPackageForEdit,
  getPackageBySlug,
  findActivePackages,
  createPackage,
  updatePackageById,
  deletePackageById,
};