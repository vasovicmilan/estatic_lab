import { formatDateTime } from "../utils/date.time.util.js";

export function mapResourcesForAdminList(resources = []) {
  return resources
    .map((resource) => {
      if (!resource) return null;
      return {
        id: resource._id.toString(),
        naziv: resource.name,
        kapacitet: resource.capacity,
        aktivan: resource.isActive ? "Da" : "Ne",
        kreiran: formatDateTime(resource.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapResourceForAdminDetail(resource) {
  if (!resource) return null;

  return {
    id: resource._id.toString(),
    naziv: resource.name,
    kapacitet: resource.capacity,
    aktivan: resource.isActive,
    napomena: resource.notes || "",
    vreme: {
      kreiran: formatDateTime(resource.createdAt),
      azuriran: formatDateTime(resource.updatedAt),
    },
  };
}

export function mapResourceForEdit(resource) {
  if (!resource) return null;

  return {
    id: resource._id.toString(),
    name: resource.name,
    capacity: resource.capacity,
    isActive: resource.isActive,
    notes: resource.notes || "",
  };
}

// {id, name, capacity} pairs for the Service admin form's resource dropdown
export function mapResourceForSelect(resource) {
  if (!resource) return null;

  return {
    id: resource._id.toString(),
    naziv: resource.name,
    kapacitet: resource.capacity,
    aktivan: resource.isActive,
  };
}

export function mapResourcesForSelect(resources = []) {
  return resources.map(mapResourceForSelect).filter(Boolean);
}

// raw capacity/active shape for availability.service.js and appointment.service.js's
// internal use - no mapped shape exposes numeric capacity in the right form
export function mapResourceRaw(resource) {
  return resource;
}

export default {
  mapResourcesForAdminList,
  mapResourceForAdminDetail,
  mapResourceForEdit,
  mapResourceForSelect,
  mapResourcesForSelect,
  mapResourceRaw,
};