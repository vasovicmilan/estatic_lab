import * as categoryRepo from "../repositories/category.repository.js";
import {
  mapCategoriesForAdminList,
  mapCategoryForAdminDetail,
  mapCategoryForEdit,
  mapCategoriesForPublic,
  mapCategoriesForSelect,
} from "../mappers/category.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

function ensureValidDomain(domain) {
  if (!["post", "service"].includes(domain)) badRequest("Domen mora biti 'post' ili 'service'");
}

export async function listCategories({ search = "", domain, parent, isActive, limit = 10, page = 1 } = {}) {
  const result = await categoryRepo.findCategories({ search, limit, page, filters: { domain, parent, isActive } });
  return { data: mapCategoriesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getCategoryById(categoryId) {
  if (!categoryId) validationError("categoryId");
  const category = await categoryRepo.findCategoryById(categoryId);
  if (!category) notFound("Kategorija");
  return mapCategoryForAdminDetail(category);
}

export async function getCategoryForEdit(categoryId) {
  if (!categoryId) validationError("categoryId");
  const category = await categoryRepo.findCategoryById(categoryId);
  if (!category) notFound("Kategorija");
  return mapCategoryForEdit(category);
}

export async function getCategoryBySlugAndDomain(slug, domain) {
  if (!slug) validationError("slug");
  ensureValidDomain(domain);
  const category = await categoryRepo.findCategoryBySlug(slug, domain);
  if (!category || category.meta?.isActive !== true) notFound("Kategorija");
  return category;
}

// unpaginated, active-only — nav menus, filter dropdowns
export async function getPublicCategories(domain) {
  ensureValidDomain(domain);
  const categories = await categoryRepo.findAllCategoriesByDomain(domain, { onlyActive: true });
  return mapCategoriesForPublic(categories);
}

export async function getCategoriesForSelect(domain) {
  ensureValidDomain(domain);
  const categories = await categoryRepo.findAllCategoriesByDomain(domain, { onlyActive: false });
  return mapCategoriesForSelect(categories);
}

export async function createCategory(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (!data.slug) validationError("slug");
  ensureValidDomain(data.domain);

  const existing = await categoryRepo.findCategoryBySlug(data.slug, data.domain);
  if (existing) conflict("Kategorija sa istim slug-om i domenom već postoji");

  const created = await categoryRepo.createCategory(data);
  logInfo("Category created", { categoryId: created._id, name: created.name, domain: created.domain });
  return getCategoryById(created._id);
}

export async function updateCategoryById(categoryId, data) {
  if (!categoryId) validationError("categoryId");
  const existing = await categoryRepo.findCategoryById(categoryId);
  if (!existing) notFound("Kategorija");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await categoryRepo.findCategoryBySlug(data.slug, data.domain || existing.domain);
    if (conflicting) conflict("Kategorija sa istim slug-om i domenom već postoji");
  }

  const updated = await categoryRepo.updateCategoryById(categoryId, data);
  logInfo("Category updated", { categoryId, updatedFields: Object.keys(data) });
  return getCategoryById(updated._id);
}

export async function deleteCategoryById(categoryId) {
  if (!categoryId) validationError("categoryId");
  const existing = await categoryRepo.findCategoryById(categoryId);
  if (!existing) notFound("Kategorija");

  const children = await categoryRepo.findCategories({ filters: { parent: categoryId }, limit: 1 });
  if (children.total > 0) badRequest("Kategorija ima podkategorije — premestite ih ili obrišite prvo");

  await categoryRepo.deleteCategoryById(categoryId);
  logInfo("Category deleted", { categoryId });
  return { success: true };
}

export default {
  listCategories,
  getCategoryById,
  getCategoryForEdit,
  getCategoryBySlugAndDomain,
  getPublicCategories,
  getCategoriesForSelect,
  createCategory,
  updateCategoryById,
  deleteCategoryById,
};
