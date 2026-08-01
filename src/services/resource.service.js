import resourceRepo from "../repositories/resource.repository.js";
import serviceRepo from "../repositories/service.repository.js";
import {
  mapResourcesForAdminList,
  mapResourceForAdminDetail,
  mapResourceForEdit,
  mapResourcesForSelect,
} from "../mappers/resource.mapper.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

export async function listResources({ search = "", isActive, limit = 10, page = 1 } = {}) {
  const result = await resourceRepo.findResources({ search, limit, page, filters: { isActive } });
  return { data: mapResourcesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getResourceById(resourceId) {
  if (!resourceId) validationError("resourceId");
  const resource = await resourceRepo.findResourceById(resourceId);
  if (!resource) notFound("Resurs");
  return mapResourceForAdminDetail(resource);
}

export async function getResourceForEdit(resourceId) {
  if (!resourceId) validationError("resourceId");
  const resource = await resourceRepo.findResourceById(resourceId);
  if (!resource) notFound("Resurs");
  return mapResourceForEdit(resource);
}

// {id, naziv, kapacitet, aktivan} pairs for the Service admin form's resource
// dropdown - includes inactive resources so an admin can still see what a
// service currently points to
export async function getResourcesForSelect() {
  const resources = await resourceRepo.findAllResources();
  return mapResourcesForSelect(resources);
}

/**
 * Raw (unmapped) resource for availability.service.js/appointment.service.js's
 * internal use - needs the numeric `capacity` and `isActive` directly, which no
 * mapped shape exposes in the right form. Returns null rather than throwing,
 * since a service with no resource assigned is the normal, unconstrained case.
 */
export async function getResourceByIdRaw(resourceId) {
  if (!resourceId) return null;
  return resourceRepo.findResourceById(resourceId);
}

/**
 * The capacity a resource actually offers right now. An inactive resource
 * (under maintenance, retired) offers zero, regardless of its configured
 * capacity - this is the single place that rule lives, so availability and
 * booking can never disagree about it.
 */
export function getEffectiveCapacity(resource) {
  if (!resource) return null;
  return resource.isActive ? resource.capacity : 0;
}

export async function createResource(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");

  const created = await resourceRepo.createResource(data);
  logInfo("Resource created", { resourceId: created._id, name: created.name, capacity: created.capacity });
  return getResourceById(created._id);
}

export async function updateResourceById(resourceId, data) {
  if (!resourceId) validationError("resourceId");
  const existing = await resourceRepo.findResourceById(resourceId);
  if (!existing) notFound("Resurs");

  const updated = await resourceRepo.updateResourceById(resourceId, data);
  logInfo("Resource updated", { resourceId, updatedFields: Object.keys(data) });
  return getResourceById(updated._id);
}

export async function deleteResourceById(resourceId) {
  if (!resourceId) validationError("resourceId");
  const existing = await resourceRepo.findResourceById(resourceId);
  if (!existing) notFound("Resurs");

  // A Service pointing at this resource is a structural dependency, same
  // tier as Package.items[].service in service.service.js's deleteServiceById -
  // deleting the resource out from under it would silently remove a capacity
  // constraint the admin explicitly set up, so this blocks with a directive
  // rather than auto-clearing the reference.
  const servicesUsingResource = await serviceRepo.findServices({ filters: { resource: resourceId }, limit: 5, populateFields: [] });
  if (servicesUsingResource.total > 0) {
    const names = servicesUsingResource.data.map((s) => s.name).join(", ");
    badRequest(`Resurs se koristi kod usluga (${names}) - prvo uklonite resurs sa tih usluga`);
  }

  await resourceRepo.deleteResourceById(resourceId);
  logInfo("Resource deleted", { resourceId });
  return { success: true };
}

export default {
  listResources,
  getResourceById,
  getResourceForEdit,
  getResourcesForSelect,
  getResourceByIdRaw,
  getEffectiveCapacity,
  createResource,
  updateResourceById,
  deleteResourceById,
};