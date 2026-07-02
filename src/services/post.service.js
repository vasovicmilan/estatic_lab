import * as postRepo from "../repositories/post.repository.js";
import {
  mapPostsForAdminList,
  mapPostForAdminDetail,
  mapPostForEdit,
  mapPostsForCards,
  mapPostForPublicDetail,
} from "../mappers/post.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const populate = [
  { path: "categories", select: "name slug" },
  { path: "tags", select: "name slug" },
  { path: "author", select: "firstName lastName avatar" },
];

function validateBasicData(data) {
  if (!data) validationError("data");
  if (!data.title) validationError("title");
  if (!data.excerpt) validationError("excerpt");
  if (!data.coverImage?.img) validationError("coverImage");
  if (!data.author) validationError("author");
}

export async function listPosts({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await postRepo.findPosts({ search, limit, page, filters, populateFields: populate });
  return { data: mapPostsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getPostById(postId) {
  if (!postId) validationError("postId");
  const post = await postRepo.findPostById(postId, { populateFields: populate });
  if (!post) notFound("Post");
  return mapPostForAdminDetail(post);
}

export async function getPostForEdit(postId) {
  if (!postId) validationError("postId");
  const post = await postRepo.findPostById(postId, { populateFields: populate });
  if (!post) notFound("Post");
  return mapPostForEdit(post);
}

export async function findPublishedPosts({ limit = 10, page = 1, filters = {}, search = "" } = {}) {
  const result = await postRepo.findPosts({ search, limit, page, filters: { ...filters, publishedOnly: true }, populateFields: populate });
  return { data: mapPostsForCards(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getPublicPostBySlug(slug) {
  if (!slug) validationError("slug");
  const post = await postRepo.findPostBySlug(slug, { populateFields: populate });
  if (!post || post.status !== "published") notFound("Post");

  await postRepo.incrementPostViews(post._id);
  return mapPostForPublicDetail(post);
}

export async function createPost(data) {
  validateBasicData(data);
  if (!data.slug) validationError("slug");

  const existing = await postRepo.findPostBySlug(data.slug);
  if (existing) conflict("Post sa ovim slug-om već postoji");

  const created = await postRepo.createPost(data);
  logInfo("Post created", { postId: created._id, title: created.title });
  return getPostById(created._id);
}

export async function updatePostById(postId, data) {
  if (!postId) validationError("postId");
  const existing = await postRepo.findPostById(postId);
  if (!existing) notFound("Post");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await postRepo.findPostBySlug(data.slug);
    if (conflicting) conflict("Post sa ovim slug-om već postoji");
  }

  const updated = await postRepo.updatePostById(postId, data);
  logInfo("Post updated", { postId, updatedFields: Object.keys(data) });
  return getPostById(updated._id);
}

export async function updatePostStatus(postId, status) {
  if (!postId) validationError("postId");
  if (!["draft", "published", "archived"].includes(status)) badRequest("Nepoznat status posta");

  const updated = await postRepo.updatePostById(postId, { status });
  if (!updated) notFound("Post");
  logInfo("Post status changed", { postId, status });
  return getPostById(updated._id);
}

export async function updatePostSeo(postId, seo) {
  if (!postId) validationError("postId");
  const updated = await postRepo.updatePostById(postId, { seo });
  if (!updated) notFound("Post");
  return getPostById(updated._id);
}

export async function deletePostById(postId) {
  if (!postId) validationError("postId");
  const existing = await postRepo.findPostById(postId);
  if (!existing) notFound("Post");
  await postRepo.deletePostById(postId);
  logInfo("Post deleted", { postId });
  return { success: true };
}

export default {
  listPosts,
  getPostById,
  getPostForEdit,
  findPublishedPosts,
  getPublicPostBySlug,
  createPost,
  updatePostById,
  updatePostStatus,
  updatePostSeo,
  deletePostById,
};