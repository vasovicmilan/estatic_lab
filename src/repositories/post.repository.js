import Post from "../models/post.model.js";
import { buildPostFilter } from "./filters/post.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createPost(data, { session } = {}) {
  const [post] = await Post.create([data], { session });
  return post;
}

export async function findPostById(id, { populateFields = [], session } = {}) {
  let query = Post.findById(id).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findPostBySlug(slug, { populateFields = [], session } = {}) {
  let query = Post.findOne({ slug }).session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findPosts({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [
    { path: "categories", select: "name slug" },
    { path: "tags", select: "name slug" },
    { path: "author", select: "firstName lastName avatar" },
  ],
  session,
} = {}) {
  const filter = buildPostFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Post.find(filter)
    .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);

  const [data, total] = await Promise.all([
    query.lean(),
    Post.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// atomic view counter increment - deliberately not part of a findById + save round trip
export async function incrementPostViews(id, { session } = {}) {
  return Post.findByIdAndUpdate(id, { $inc: { views: 1 } }, { returnDocument: "after", session }).lean();
}

export async function updatePostById(id, updateData, { session } = {}) {
  return Post.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deletePostById(id, { session } = {}) {
  return Post.findByIdAndDelete(id, { session }).lean();
}

export async function countPosts(filters = {}, { session } = {}) {
  return Post.countDocuments(buildPostFilter(filters)).session(session || null);
}

// Called when a Category is deleted - Post.categories[] is current taxonomy
// assignment, always safe to auto-clean. (Missed in the original Category-deletion
// fix, which only covered Product/Service/Package - Post uses the same "post"
// category domain and was left out.)
export async function pullCategoryFromAllPosts(categoryId, { session } = {}) {
  return Post.updateMany({ categories: categoryId }, { $pull: { categories: categoryId } }, { session });
}

// Called when a Tag is deleted - Post.tags[] is current taxonomy assignment,
// always safe to auto-clean.
export async function pullTagFromAllPosts(tagId, { session } = {}) {
  return Post.updateMany({ tags: tagId }, { $pull: { tags: tagId } }, { session });
}

export default {
  createPost,
  findPostById,
  findPostBySlug,
  findPosts,
  incrementPostViews,
  updatePostById,
  deletePostById,
  countPosts,
  pullCategoryFromAllPosts,
  pullTagFromAllPosts,
}