import Role from "../models/role.model.js";
import { buildRoleFilter } from "./filters/role.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createRole(data, { session } = {}) {
  const [role] = await Role.create([data], { session });
  return role;
}

export async function findRoleById(id, { session } = {}) {
  return Role.findById(id).session(session || null).lean();
}

export async function findRoleByName(name, { session } = {}) {
  return Role.findOne({ name }).session(session || null).lean();
}

export async function findDefaultRole({ session } = {}) {
  return Role.findOne({ isDefault: true }).session(session || null).lean();
}

export async function findRoles({ search = "", limit = 20, page = 1, session } = {}) {
  const filter = buildRoleFilter({ search });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Role.find(filter).sort({ priority: -1, name: 1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    Role.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateRoleById(id, updateData, { session } = {}) {
  return Role.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteRoleById(id, { session } = {}) {
  return Role.findByIdAndDelete(id, { session }).lean();
}

export async function countRoles(filters = {}, { session } = {}) {
  return Role.countDocuments(buildRoleFilter(filters)).session(session || null);
}