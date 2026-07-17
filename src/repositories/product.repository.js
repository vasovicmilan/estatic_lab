import Product from "../models/product.model.js";
import { buildProductFilter } from "./filters/product.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

const DEFAULT_POPULATE = [
  { path: "categories", select: "name slug" },
  { path: "tags", select: "name slug" },
];

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createProduct(data, { session } = {}) {
  const [product] = await Product.create([data], { session });
  return product;
}

export async function findProductById(id, { populateFields = DEFAULT_POPULATE, session } = {}) {
  let query = Product.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

// non-lean, real document - for in-place mutation of variations[].stock inside a
// transaction (see the note above on why this logic isn't in the repository itself)
export async function findProductDocById(id, { session } = {}) {
  return Product.findById(id).session(session || null);
}

export async function findProductBySlug(slug, { session } = {}) {
  return Product.findOne({ slug }).session(session || null).lean();
}

export async function findProductBySku(sku, { session } = {}) {
  return Product.findOne({ sku: sku.toLowerCase().trim() }).session(session || null).lean();
}

// bulk fetch by id, e.g. resolving a cart's line items for display/checkout - one
// query instead of N, same reasoning as every other findXByIds in this codebase
export async function findProductsByIds(ids, { populateFields = DEFAULT_POPULATE, session } = {}) {
  let query = Product.find({ _id: { $in: ids } }).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findProducts({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = DEFAULT_POPULATE,
  sort = { createdAt: -1 },
  session,
} = {}) {
  const filter = buildProductFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Product.find(filter).sort(sort).skip(skip).limit(resolvedLimit).session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    Product.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateProductById(id, updateData, { session } = {}) {
  return Product.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteProductById(id, { session } = {}) {
  return Product.findByIdAndDelete(id, { session }).lean();
}

export async function countProducts(filters = {}, { session } = {}) {
  return Product.countDocuments(buildProductFilter(filters)).session(session || null);
}

export default {
  createProduct,
  findProductById,
  findProductDocById,
  findProductBySlug,
  findProductBySku,
  findProductsByIds,
  findProducts,
  updateProductById,
  deleteProductById,
  countProducts,
};