import postRepo from "../repositories/post.repository.js";
import {
  mapPostsForAdminList,
  mapPostForAdminDetail,
  mapPostForEdit,
  mapPostsForCards,
  mapPostForPublicDetail,
} from "../mappers/post.mapper.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
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
  if (data.status === "scheduled" && !data.scheduledFor) validationError("scheduledFor");
}

export async function listPosts({ search = "", filters = {}, limit = 10, page = 1, sortBy } = {}) {
  const result = await postRepo.findPosts({ search, limit, page, filters, sortBy, populateFields: populate });
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

export async function findPublishedPosts({ limit = 10, page = 1, filters = {}, search = "", sortBy = "featured" } = {}) {
  const result = await postRepo.findPosts({ search, limit, page, filters: { ...filters, publishedOnly: true }, sortBy, populateFields: populate });
  return { data: mapPostsForCards(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

// Total published posts, used for the "Sve objave" filter tab count.
export async function countAllPublishedPosts() {
  return postRepo.countPosts({ publishedOnly: true });
}

// Decorates each public category with how many published posts it currently
// has, so the /blog filter tabs can show real counts, same as /usluge and /prodavnica.
export async function attachPostCountsToCategories(categories = []) {
  const counts = await Promise.all(categories.map((cat) => postRepo.countPosts({ category: cat.id, publishedOnly: true })));
  return categories.map((cat, index) => ({ ...cat, count: counts[index] }));
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

  if (data.slug) {
    const existing = await postRepo.findPostBySlug(data.slug);
    if (existing) conflict("Post sa ovim slug-om već postoji");
  } else {
    data.slug = await generateUniqueSlug(data.title, (candidate) => postRepo.findPostBySlug(candidate));
  }

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

export async function updatePostStatus(postId, status, { scheduledFor } = {}) {
  if (!postId) validationError("postId");
  if (!["draft", "scheduled", "published", "archived"].includes(status)) badRequest("Nepoznat status posta");
  if (status === "scheduled") {
    if (!scheduledFor) validationError("scheduledFor");
    if (new Date(scheduledFor) <= new Date()) badRequest("Datum zakazivanja mora biti u budućnosti");
  }

  const patch = { status };
  if (status === "scheduled") patch.scheduledFor = scheduledFor;

  const updated = await postRepo.updatePostById(postId, patch);
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

export async function listSlugsForSitemap() {
  return postRepo.findActiveSlugsForSitemap();
}

export default {
  listPosts,
  getPostById,
  getPostForEdit,
  findPublishedPosts,
  countAllPublishedPosts,
  attachPostCountsToCategories,
  getPublicPostBySlug,
  createPost,
  updatePostById,
  updatePostStatus,
  updatePostSeo,
  deletePostById,
  listSlugsForSitemap,
};