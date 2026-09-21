import * as roleService from "../../../services/role.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as tagService from "../../../services/tag.service.js";
import * as resourceService from "../../../services/resource.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Every function here mirrors its controllers/web/admin/** counterpart 1:1 - same
// service calls, same audit log entries. What's deliberately NOT here: the
// /dodavanje and /izmena/:id GET routes that just render an empty/pre-filled admin
// form - an API client renders its own UI, it has no use for a server-rendered
// form page. Only the actual data endpoints (list/detail/create/update/delete)
// exist here. Image upload (categoryImageDesc + req.uploadedFile on the web) is
// deliberately out of scope for this pass - these endpoints accept JSON bodies
// only, no multipart/form-data; a category/tag created via this API simply has no
// featureImage until a dedicated upload endpoint exists.

// ---- Roles ----

export async function listRoles(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const result = await roleService.listRoles({ search: search || "", page: resolvePage(page), limit: resolveLimit(limit) });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listRoles] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getRole(req, res, next) {
  try {
    const role = await roleService.getRoleById(req.params.roleId);
    return res.json({ success: true, data: role });
  } catch (error) {
    logError("[api/admin/getRole] Greška", error, { roleId: req.params.roleId });
    next(error);
  }
}

export async function createRole(req, res, next) {
  try {
    const role = await roleService.createRole(req.body);
    logInfo(`[api/admin/createRole] Rola kreirana: "${role.naziv || role.name}"`, { roleId: role.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "ROLE_CREATED", entity: { type: "Role", id: role.id } });
    return res.status(201).json({ success: true, data: role });
  } catch (error) {
    logError("[api/admin/createRole] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { roleId } = req.params;
    const role = await roleService.updateRoleById(roleId, req.body);
    logInfo(`[api/admin/updateRole] Rola #${roleId} ažurirana`, { roleId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "ROLE_UPDATED", entity: { type: "Role", id: roleId } });
    return res.json({ success: true, data: role });
  } catch (error) {
    logError("[api/admin/updateRole] Greška", error, { roleId: req.params.roleId, body: req.body });
    next(error);
  }
}

export async function deleteRole(req, res, next) {
  try {
    const { roleId } = req.params;
    await roleService.deleteRoleById(roleId);
    logInfo(`[api/admin/deleteRole] Rola #${roleId} obrisana`, { roleId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "ROLE_DELETED", entity: { type: "Role", id: roleId } });
    return res.json({ success: true, data: { message: "Rola je obrisana." } });
  } catch (error) {
    logError("[api/admin/deleteRole] Greška", error, { roleId: req.params.roleId });
    next(error);
  }
}

// ---- Categories ----

// Category.meta.{isActive,priority} is nested in the schema, but a flat body is a
// friendlier API contract - same reshaping the web controller does before handing
// off to categoryService (which expects the schema shape as-is, no flattening of
// its own). content arrives as a real array/object in a JSON body already, unlike
// the web form's JSON-stringified field, so no parsing needed here.
function buildCategoryData(body) {
  const data = { ...body };
  data.parent = data.parent || null;
  if (body.isActive !== undefined || body.priority !== undefined) {
    data.meta = { isActive: body.isActive !== undefined ? body.isActive : true, priority: body.priority !== undefined ? parseInt(body.priority, 10) : 0 };
  }
  delete data.isActive;
  delete data.priority;
  return data;
}

export async function listCategories(req, res, next) {
  try {
    const { search, domain, parent, isActive, page = 1, limit = 10 } = req.query;
    const result = await categoryService.listCategories({
      search: search || "",
      domain: domain || undefined,
      parent: parent || undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listCategories] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getCategory(req, res, next) {
  try {
    const category = await categoryService.getCategoryById(req.params.categoryId);
    return res.json({ success: true, data: category });
  } catch (error) {
    logError("[api/admin/getCategory] Greška", error, { categoryId: req.params.categoryId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as admin-catalog.controller.js's
// getPackageForEdit/getProductForEdit (see that file's header comment for the
// full rationale). categoryService.getCategoryForEdit already existed
// (mapCategoryForEdit, English-keyed, raw values) but had no route wired to
// it - this is purely additive, getCategory's existing response is unchanged.
export async function getCategoryForEdit(req, res, next) {
  try {
    const category = await categoryService.getCategoryForEdit(req.params.categoryId);
    return res.json({ success: true, data: category });
  } catch (error) {
    logError("[api/admin/getCategoryForEdit] Greška", error, { categoryId: req.params.categoryId });
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const category = await categoryService.createCategory(buildCategoryData(req.body));
    logInfo(`[api/admin/createCategory] Kategorija kreirana: "${category.naziv}"`, { categoryId: category.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CATEGORY_CREATED", entity: { type: "Category", id: category.id } });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    logError("[api/admin/createCategory] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.updateCategoryById(categoryId, buildCategoryData(req.body));
    logInfo(`[api/admin/updateCategory] Kategorija #${categoryId} ažurirana`, { categoryId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CATEGORY_UPDATED", entity: { type: "Category", id: categoryId } });
    return res.json({ success: true, data: category });
  } catch (error) {
    logError("[api/admin/updateCategory] Greška", error, { categoryId: req.params.categoryId, body: req.body });
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const { categoryId } = req.params;
    await categoryService.deleteCategoryById(categoryId);
    logInfo(`[api/admin/deleteCategory] Kategorija #${categoryId} obrisana`, { categoryId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CATEGORY_DELETED", entity: { type: "Category", id: categoryId } });
    return res.json({ success: true, data: { message: "Kategorija je obrisana." } });
  } catch (error) {
    logError("[api/admin/deleteCategory] Greška", error, { categoryId: req.params.categoryId });
    next(error);
  }
}

// ---- Tags ----

export async function listTags(req, res, next) {
  try {
    const { search, domain, isActive, page = 1, limit = 10 } = req.query;
    const result = await tagService.listTags({
      search: search || "",
      domain: domain || undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listTags] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getTag(req, res, next) {
  try {
    const tag = await tagService.getTagById(req.params.tagId);
    return res.json({ success: true, data: tag });
  } catch (error) {
    logError("[api/admin/getTag] Greška", error, { tagId: req.params.tagId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as getCategoryForEdit above.
// tagService.getTagForEdit already existed (mapTagForEdit) but had no route
// wired to it - purely additive, getTag's existing response is unchanged.
export async function getTagForEdit(req, res, next) {
  try {
    const tag = await tagService.getTagForEdit(req.params.tagId);
    return res.json({ success: true, data: tag });
  } catch (error) {
    logError("[api/admin/getTagForEdit] Greška", error, { tagId: req.params.tagId });
    next(error);
  }
}

export async function createTag(req, res, next) {
  try {
    const tag = await tagService.createTag(req.body);
    logInfo(`[api/admin/createTag] Tag kreiran: "${tag.naziv}"`, { tagId: tag.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "TAG_CREATED", entity: { type: "Tag", id: tag.id } });
    return res.status(201).json({ success: true, data: tag });
  } catch (error) {
    logError("[api/admin/createTag] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateTag(req, res, next) {
  try {
    const { tagId } = req.params;
    const tag = await tagService.updateTagById(tagId, req.body);
    logInfo(`[api/admin/updateTag] Tag #${tagId} ažuriran`, { tagId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "TAG_UPDATED", entity: { type: "Tag", id: tagId } });
    return res.json({ success: true, data: tag });
  } catch (error) {
    logError("[api/admin/updateTag] Greška", error, { tagId: req.params.tagId, body: req.body });
    next(error);
  }
}

export async function deleteTag(req, res, next) {
  try {
    const { tagId } = req.params;
    await tagService.deleteTagById(tagId);
    logInfo(`[api/admin/deleteTag] Tag #${tagId} obrisan`, { tagId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "TAG_DELETED", entity: { type: "Tag", id: tagId } });
    return res.json({ success: true, data: { message: "Tag je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteTag] Greška", error, { tagId: req.params.tagId });
    next(error);
  }
}

// ---- Resources (equipment/rooms/tables the booking system tracks capacity for) ----

export async function listResources(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await resourceService.listResources({
      search: search || "",
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listResources] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getResource(req, res, next) {
  try {
    const resource = await resourceService.getResourceById(req.params.resourceId);
    return res.json({ success: true, data: resource });
  } catch (error) {
    logError("[api/admin/getResource] Greška", error, { resourceId: req.params.resourceId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as getCategoryForEdit above.
// resourceService.getResourceForEdit already existed but had no route wired
// to it - purely additive, getResource's existing response is unchanged.
export async function getResourceForEdit(req, res, next) {
  try {
    const resource = await resourceService.getResourceForEdit(req.params.resourceId);
    return res.json({ success: true, data: resource });
  } catch (error) {
    logError("[api/admin/getResourceForEdit] Greška", error, { resourceId: req.params.resourceId });
    next(error);
  }
}

export async function createResource(req, res, next) {
  try {
    const resource = await resourceService.createResource(req.body);
    logInfo(`[api/admin/createResource] Resurs kreiran: "${resource.naziv}"`, { resourceId: resource.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "RESOURCE_CREATED", entity: { type: "Resource", id: resource.id } });
    return res.status(201).json({ success: true, data: resource });
  } catch (error) {
    logError("[api/admin/createResource] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateResource(req, res, next) {
  try {
    const { resourceId } = req.params;
    const resource = await resourceService.updateResourceById(resourceId, req.body);
    logInfo(`[api/admin/updateResource] Resurs #${resourceId} ažuriran`, { resourceId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "RESOURCE_UPDATED", entity: { type: "Resource", id: resourceId } });
    return res.json({ success: true, data: resource });
  } catch (error) {
    logError("[api/admin/updateResource] Greška", error, { resourceId: req.params.resourceId, body: req.body });
    next(error);
  }
}

export async function deleteResource(req, res, next) {
  try {
    const { resourceId } = req.params;
    await resourceService.deleteResourceById(resourceId);
    logInfo(`[api/admin/deleteResource] Resurs #${resourceId} obrisan`, { resourceId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "RESOURCE_DELETED", entity: { type: "Resource", id: resourceId } });
    return res.json({ success: true, data: { message: "Resurs je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteResource] Greška", error, { resourceId: req.params.resourceId });
    next(error);
  }
}

export default {
  listRoles, getRole, createRole, updateRole, deleteRole,
  listCategories, getCategory, getCategoryForEdit, createCategory, updateCategory, deleteCategory,
  listTags, getTag, getTagForEdit, createTag, updateTag, deleteTag,
  listResources, getResource, getResourceForEdit, createResource, updateResource, deleteResource,
};
