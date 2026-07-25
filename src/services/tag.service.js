import mongoose from "mongoose";
import tagRepo from "../repositories/tag.repository.js";
import packageRepo from "../repositories/package.repository.js";
import postRepo from "../repositories/post.repository.js";
import productRepo from "../repositories/product.repository.js";
import serviceRepo from "../repositories/service.repository.js";
import { CATEGORY_DOMAINS } from "../models/category.model.js";
import {
  mapTagsForAdminList,
  mapTagForAdminDetail,
  mapTagForEdit,
  mapTagsForPublic,
  mapTagsForSelect,
} from "../mappers/tag.mapper.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

function ensureValidDomain(domain) {
  if (!CATEGORY_DOMAINS.includes(domain)) badRequest(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`);
}

export async function listTags({ search = "", domain, isActive, limit = 10, page = 1 } = {}) {
  const result = await tagRepo.findTags({ search, limit, page, filters: { domain, isActive } });
  return { data: mapTagsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getTagById(tagId) {
  if (!tagId) validationError("tagId");
  const tag = await tagRepo.findTagById(tagId);
  if (!tag) notFound("Tag");
  return mapTagForAdminDetail(tag);
}

export async function getTagForEdit(tagId) {
  if (!tagId) validationError("tagId");
  const tag = await tagRepo.findTagById(tagId);
  if (!tag) notFound("Tag");
  return mapTagForEdit(tag);
}

export async function getTagBySlugAndDomain(slug, domain) {
  if (!slug) validationError("slug");
  ensureValidDomain(domain);
  const tag = await tagRepo.findTagBySlug(slug, domain);
  if (!tag || !tag.isActive) notFound("Tag");
  return tag;
}

export async function getPublicTags(domain) {
  ensureValidDomain(domain);
  const tags = await tagRepo.findAllTagsByDomain(domain, { onlyActive: true });
  return mapTagsForPublic(tags);
}

export async function getTagsForSelect(domain) {
  ensureValidDomain(domain);
  const tags = await tagRepo.findAllTagsByDomain(domain, { onlyActive: false });
  return mapTagsForSelect(tags);
}

export async function createTag(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  ensureValidDomain(data.domain);

  if (data.slug) {
    const existing = await tagRepo.findTagBySlug(data.slug, data.domain);
    if (existing) conflict("Tag sa istim slug-om i domenom već postoji");
  } else {
    data.slug = await generateUniqueSlug(data.name, (candidate) => tagRepo.findTagBySlug(candidate, data.domain));
  }

  const created = await tagRepo.createTag(data);
  logInfo("Tag created", { tagId: created._id, name: created.name, domain: created.domain, slug: created.slug });
  return getTagById(created._id);
}

export async function updateTagById(tagId, data) {
  if (!tagId) validationError("tagId");
  const existing = await tagRepo.findTagById(tagId);
  if (!existing) notFound("Tag");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await tagRepo.findTagBySlug(data.slug, data.domain || existing.domain);
    if (conflicting) conflict("Tag sa istim slug-om i domenom već postoji");
  }

  const updated = await tagRepo.updateTagById(tagId, data);
  logInfo("Tag updated", { tagId, updatedFields: Object.keys(data) });
  return getTagById(updated._id);
}

export async function deleteTagById(tagId) {
  if (!tagId) validationError("tagId");
  const existing = await tagRepo.findTagById(tagId);
  if (!existing) notFound("Tag");

  // Tag on Package.tags[]/Post.tags[]/Product.tags[]/Service.tags[] is just current
  // taxonomy assignment, not a promise to anyone - unlike Category, Tag has no
  // hierarchy to worry about either, so there's no blocking check needed at all,
  // just pull it from everywhere it's assigned, atomically with the delete itself.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await packageRepo.pullTagFromAllPackages(tagId, { session });
      await postRepo.pullTagFromAllPosts(tagId, { session });
      await productRepo.pullTagFromAllProducts(tagId, { session });
      await serviceRepo.pullTagFromAllServices(tagId, { session });
      await tagRepo.deleteTagById(tagId, { session });
    });
  } finally {
    await session.endSession();
  }

  logInfo("Tag deleted", { tagId });
  return { success: true };
}

export default {
  listTags,
  getTagById,
  getTagForEdit,
  getTagBySlugAndDomain,
  getPublicTags,
  getTagsForSelect,
  createTag,
  updateTagById,
  deleteTagById,
};