import eventEmitter from "../events/event.emitter.js";
import productRepo from "../repositories/product.repository.js";
import { generateSlug, generateUniqueSlug } from "../utils/slug.util.js";
import {
  mapProductsForAdminList,
  mapProductForAdminDetail,
  mapProductForEdit,
  mapProductsForPublic,
  mapProductForPublicDetail,
} from "../mappers/product.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

function validateVariations(variations = []) {
  for (const v of variations) {
    if (!v.label) badRequest("Svaka varijanta mora imati naziv");
    if (v.price == null || v.price < 0) badRequest(`Varijanta "${v.label}" mora imati validnu cenu`);
    if (v.stock == null || v.stock < 0) badRequest(`Varijanta "${v.label}" mora imati validno stanje zaliha`);
  }
}

function findVariation(product, variantId) {
  return (product.variations || []).find((v) => String(v._id) === String(variantId));
}

// ==================== ADMIN CRUD ====================

export async function listProducts({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await productRepo.findProducts({ search, limit, page, filters });
  return { data: mapProductsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getProductById(productId) {
  if (!productId) validationError("productId");
  const product = await productRepo.findProductById(productId);
  if (!product) notFound("Proizvod");
  return mapProductForAdminDetail(product);
}

export async function getProductForEdit(productId) {
  if (!productId) validationError("productId");
  const product = await productRepo.findProductById(productId);
  if (!product) notFound("Proizvod");
  return mapProductForEdit(product);
}

// ---- Phase 1: bare minimum - just enough to get a row in the DB -------------------
// No description, no image, no categories here on purpose - an admin should be able
// to punch in a name+SKU and move on, filling in the rest across the next two phases
// without the form blocking them on content that isn't ready yet.
export async function createDraftProduct(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (!data.sku) validationError("sku");

  const existingSku = await productRepo.findProductBySku(data.sku);
  if (existingSku) conflict("Proizvod sa ovim SKU već postoji");

  const payload = {
    name: data.name,
    sku: data.sku.toLowerCase().trim(),
    slug: data.slug || null,
    isActive: false,
    variations: [],
  };

  if (payload.slug) {
    const existingSlug = await productRepo.findProductBySlug(payload.slug);
    if (existingSlug) conflict("Proizvod sa ovim slug-om već postoji");
  } else {
    payload.slug = await generateUniqueSlug(payload.name, (candidate) => productRepo.findProductBySlug(candidate).then(Boolean));
  }

  const created = await productRepo.createProduct(payload);
  logInfo("Product draft created (phase 1)", { productId: created._id, name: created.name, sku: created.sku });
  return mapProductForEdit(created);
}

// ---- Phase 2: variations + content + media -----------------------------------------
// Everything needed to actually describe and sell the product: variations (the one
// thing that's still required - a product can't be published without at least one),
// categories/tags, descriptions, and all imagery (main image, gallery, video).
export async function addDetailsAndMedia(productId, data) {
  if (!productId) validationError("productId");
  const existing = await productRepo.findProductById(productId);
  if (!existing) notFound("Proizvod");

  const variations = data.variations ?? existing.variations ?? [];
  validateVariations(variations);

  const updated = await productRepo.updateProductById(productId, {
    variations,
    categories: data.categories ?? existing.categories ?? [],
    tags: data.tags ?? existing.tags ?? [],
    shortDescription: data.shortDescription ?? existing.shortDescription ?? "",
    longDescription: data.longDescription ?? existing.longDescription ?? "",
    image: data.image ?? existing.image ?? null,
    gallery: data.gallery ?? existing.gallery ?? [],
    videos: data.videos ?? existing.videos ?? [],
  });

  logInfo("Product details and media saved (phase 2)", { productId, variationCount: variations.length });
  return mapProductForEdit(updated);
}

// ---- Phase 3: SEO + remaining optional bits + publish ------------------------------
export async function addSeoAndPublish(productId, data) {
  if (!productId) validationError("productId");
  const existing = await productRepo.findProductById(productId);
  if (!existing) notFound("Proizvod");

  const merged = {
    seoKeywords: data.seoKeywords ?? existing.seoKeywords ?? [],
    relatedProducts: data.relatedProducts ?? existing.relatedProducts ?? [],
    faq: data.faq ?? existing.faq ?? [],
    isActive: data.isActive ?? true,
  };

  if (merged.isActive) {
    if (!existing.image) badRequest("Objavljen proizvod mora imati sliku - vratite se na korak 2.");
    if (!existing.variations?.length) badRequest("Objavljen proizvod mora imati bar jednu varijantu za prodaju - vratite se na korak 2.");
  }

  const updated = await productRepo.updateProductById(productId, merged);
  logInfo("Product SEO saved" + (merged.isActive ? " and published (phase 3)" : " as draft (phase 3)"), { productId });
  return mapProductForAdminDetail(updated);
}

// kept for the standalone post-creation SEO edit form (separate from phase 3 above,
// which only runs once during initial creation)
export async function updateProductSeo(productId, seoKeywords) {
  if (!productId) validationError("productId");
  const updated = await productRepo.updateProductById(productId, { seoKeywords: seoKeywords || [] });
  if (!updated) notFound("Proizvod");
  return getProductById(updated._id);
}

export async function createProduct(data) {
  if (!data) validationError("data");
  if (!data.name) validationError("name");
  if (!data.sku) validationError("sku");
  if (data.variations?.length) validateVariations(data.variations);

  const existingSku = await productRepo.findProductBySku(data.sku);
  if (existingSku) conflict("Proizvod sa ovim SKU već postoji");

  const slug = await generateUniqueSlug(data.slug || data.name, (candidate) =>
    productRepo.findProductBySlug(candidate).then(Boolean)
  );

  const created = await productRepo.createProduct({ ...data, sku: data.sku.toLowerCase().trim(), slug });
  logInfo("Product created", { productId: created._id, sku: created.sku });
  return getProductById(created._id);
}

export async function updateProductById(productId, data) {
  if (!productId) validationError("productId");
  const existing = await productRepo.findProductById(productId);
  if (!existing) notFound("Proizvod");

  if (data.variations?.length) validateVariations(data.variations);

  if (data.sku && data.sku.toLowerCase().trim() !== existing.sku) {
    const conflicting = await productRepo.findProductBySku(data.sku);
    if (conflicting) conflict("Proizvod sa ovim SKU već postoji");
  }

  let slug = existing.slug;
  if (data.name && generateSlug(data.name) !== existing.slug && !data.slug) {
    slug = await generateUniqueSlug(data.name, async (candidate) => {
      if (candidate === existing.slug) return false;
      return Boolean(await productRepo.findProductBySlug(candidate));
    });
  } else if (data.slug) {
    slug = generateSlug(data.slug);
  }

  const updated = await productRepo.updateProductById(productId, {
    ...data,
    ...(data.sku ? { sku: data.sku.toLowerCase().trim() } : {}),
    slug,
  });
  logInfo("Product updated", { productId, updatedFields: Object.keys(data) });
  return getProductById(updated._id);
}

export async function deleteProductById(productId) {
  if (!productId) validationError("productId");
  const existing = await productRepo.findProductById(productId);
  if (!existing) notFound("Proizvod");
  await productRepo.deleteProductById(productId);
  logInfo("Product deleted", { productId });
  return { success: true };
}

// ==================== PUBLIC CATALOG ====================

export async function listPublicProducts({ search = "", filters = {}, limit = 12, page = 1 } = {}) {
  const result = await productRepo.findProducts({ search, limit, page, filters: { ...filters, isActive: true } });
  return { data: mapProductsForPublic(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getPublicProductBySlug(slug) {
  if (!slug) validationError("slug");
  const product = await productRepo.findProductBySlug(slug);
  if (!product || !product.isActive) notFound("Proizvod");
  return mapProductForPublicDetail(product);
}

// ==================== STOCK ====================
// Checkout-facing reads and internal use by order/temporary-order services.

// raw (unmapped) - order/temporary-order services need the actual current
// price/stock/title to build order line items, not the display-formatted shape
export async function getVariationRaw(productId, variantId) {
  if (!productId) validationError("productId");
  if (!variantId) validationError("variantId");
  const product = await productRepo.findProductById(productId, { populateFields: [] });
  if (!product || !product.isActive) notFound("Proizvod");
  const variation = findVariation(product, variantId);
  if (!variation || !variation.isActive) notFound("Varijanta proizvoda");
  return { product, variation };
}

// Reserves stock for a checkout - called INSIDE temporary-order.service.js's
// creation transaction, same reasoning packagePurchaseService.reserveSession is
// called inside bookAppointment's transaction: a reservation and the record that
// depends on it must always succeed or fail together.
export async function decreaseVariationStock(productId, variantId, quantity, { session } = {}) {
  const product = await productRepo.findProductDocById(productId, { session });
  if (!product) notFound("Proizvod");

  const variation = product.variations.id(variantId);
  if (!variation) badRequest("Varijanta proizvoda ne postoji");
  if (variation.stock < quantity) {
    badRequest(`Nema dovoljno zaliha za "${product.name} - ${variation.label}" (dostupno: ${variation.stock})`);
  }

  variation.stock -= quantity;
  await product.save({ session });
  logInfo("Product variation stock decreased", { productId, variantId, quantity, remaining: variation.stock });

  if (variation.stock <= 0) {
    eventEmitter.emit("product:out_of_stock", {
      productId: product._id.toString(),
      productName: product.name,
      sku: product.sku,
      variantId: variation._id.toString(),
      variantLabel: variation.label,
    });
  } else if (variation.stock <= (variation.lowStockThreshold ?? 5)) {
    eventEmitter.emit("product:low_stock", {
      productId: product._id.toString(),
      productName: product.name,
      sku: product.sku,
      variantId: variation._id.toString(),
      variantLabel: variation.label,
      stock: variation.stock,
    });
  }

  return product;
}

// Gives reserved stock back - called when a checkout is cancelled/expires before
// ever being confirmed, or when a confirmed order is later cancelled/returned.
export async function restoreVariationStock(productId, variantId, quantity, { session } = {}) {
  const product = await productRepo.findProductDocById(productId, { session });
  if (!product) return null; // product may have been deleted since - nothing to restore onto

  const variation = product.variations.id(variantId);
  if (!variation) return product; // variation may have been removed since - nothing to release

  variation.stock += quantity;
  await product.save({ session });
  logInfo("Product variation stock restored", { productId, variantId, quantity, remaining: variation.stock });
  return product;
}

export default {
  listProducts,
  getProductById,
  getProductForEdit,
  createProduct,
  createDraftProduct,
  addDetailsAndMedia,
  addSeoAndPublish,
  updateProductSeo,
  updateProductById,
  deleteProductById,
  listPublicProducts,
  getPublicProductBySlug,
  getVariationRaw,
  decreaseVariationStock,
  restoreVariationStock,
};