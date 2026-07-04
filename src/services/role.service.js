import * as roleRepo from "../repositories/role.repository.js";
import {
  mapRolesForAdminList,
  mapRoleForAdminDetail,
  mapRoleForEdit,
  mapRolesForSelect,
} from "../mappers/role.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";

export async function listRoles({ search = "", limit = 10, page = 1 } = {}) {
  const result = await roleRepo.findRoles({ search, limit, page });
  return { data: mapRolesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getRoleById(roleId) {
  if (!roleId) validationError("roleId");
  const role = await roleRepo.findRoleById(roleId);
  if (!role) notFound("Rola");
  return mapRoleForAdminDetail(role);
}

export async function getRoleForEdit(roleId) {
  if (!roleId) validationError("roleId");
  const role = await roleRepo.findRoleById(roleId);
  if (!role) notFound("Rola");
  return mapRoleForEdit(role);
}

export async function getRolesForSelect() {
  const result = await roleRepo.findRoles({ limit: 100 });
  return mapRolesForSelect(result.data);
}

// used internally by user.service.js when no role is specified at registration
export async function findDefaultRole() {
  return roleRepo.findDefaultRole();
}

export async function findRoleByName(name) {
  if (!name) return null;
  return roleRepo.findRoleByName(name);
}

export async function createRole(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");

  const existing = await roleRepo.findRoleByName(data.name);
  if (existing) conflict("Rola sa ovim nazivom već postoji");

  const created = await roleRepo.createRole(data);
  logInfo("Role created", { roleId: created._id, name: created.name });
  return mapRoleForAdminDetail(created);
}

export async function updateRoleById(roleId, data) {
  if (!roleId) validationError("roleId");
  const existing = await roleRepo.findRoleById(roleId);
  if (!existing) notFound("Rola");

  if (data.name && data.name !== existing.name) {
    const conflicting = await roleRepo.findRoleByName(data.name);
    if (conflicting) conflict("Rola sa ovim nazivom već postoji");
  }

  const updated = await roleRepo.updateRoleById(roleId, data);
  logInfo("Role updated", { roleId, updatedFields: Object.keys(data) });
  return mapRoleForAdminDetail(updated);
}

export async function deleteRoleById(roleId) {
  if (!roleId) validationError("roleId");
  const existing = await roleRepo.findRoleById(roleId);
  if (!existing) notFound("Rola");
  if (existing.isDefault) badRequest("Podrazumevana rola ne može biti obrisana");

  await roleRepo.deleteRoleById(roleId);
  logInfo("Role deleted", { roleId });
  return { success: true };
}

export default {
  listRoles,
  getRoleById,
  getRoleForEdit,
  getRolesForSelect,
  findDefaultRole,
  findRoleByName,
  createRole,
  updateRoleById,
  deleteRoleById,
};
