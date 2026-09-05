import { formatDateTime } from "../utils/date.time.util.js";
import { formatPrice, formatMoney } from "../utils/price.util.js";
import { renderContentBlocks, contentBlocksToPlainText } from "../utils/content-blocks.util.js";
import { formatImage } from "../utils/image-format.util.js";

const BADGE_LABELS = {
  none: null,
  featured: "Istaknuto",
  sale: "Na akciji",
};

function translateBadge(badge) {
  return BADGE_LABELS[badge] ?? null;
}

const SHIPPING_CLASS_LABELS = {
  standard: "Redovna pošta",
  freight: "Veliki/težak artikal - cena dostave se procenjuje ručno",
};

function translateShippingClass(shippingClass) {
  return SHIPPING_CLASS_LABELS[shippingClass] || SHIPPING_CLASS_LABELS.standard;
}

function getCategoryNames(product) {
  if (!product.categories || !Array.isArray(product.categories)) return [];
  return product.categories.filter((c) => c && typeof c === "object" && c.name).map((c) => c.name);
}

function getTagNames(product) {
  if (!product.tags || !Array.isArray(product.tags)) return [];
  return product.tags.filter((t) => t && typeof t === "object" && t.name).map((t) => t.name);
}

function getPriceRange(product) {
  if (product.priceOnRequest) return "Cena na upit";
  const prices = (product.variations || []).filter((v) => v.isActive).map((v) => v.price);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatPrice(min)} - ${formatMoney(max)}`;
}

function getTotalStock(product) {
  return (product.variations || []).reduce((sum, v) => sum + (v.stock || 0), 0);
}

function mapVariations(variations = []) {
  return variations.map((v) => ({
    id: v._id?.toString(),
    naziv: v.label,
    sku: v.sku || null,
    cena: v.price,
    staraCena: v.compareAtPrice || null,
    stanje: v.stock,
    pragNiskogStanja: v.lowStockThreshold,
    naStanju: v.stock > 0,
    slika: formatImage(v.image),
    redosled: v.order,
    aktivna: v.isActive,
  }));
}

export function mapProductsForAdminList(products = []) {
  return products
    .map((product) => {
      if (!product) return null;
      return {
        id: product._id.toString(),
        naziv: product.name,
        slika: formatImage(product.image),
        sku: product.sku,
        slug: product.slug,
        kategorije: getCategoryNames(product),
        cena: getPriceRange(product),
        naUpit: !!product.priceOnRequest,
        stanje: getTotalStock(product),
        brojVarijanti: product.variations?.length || 0,
        oznaka: translateBadge(product.badge),
        aktivan: product.isActive ? "Da" : "Ne",
        kreiran: formatDateTime(product.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapProductForAdminDetail(product) {
  if (!product) return null;

  return {
    id: product._id.toString(),
    naziv: product.name,
    slug: product.slug,
    sku: product.sku,
    kratakOpis: product.shortDescription || "",
    dugiOpis: renderContentBlocks(product.longDescription),
    kategorije: getCategoryNames(product),
    tagovi: getTagNames(product),
    slika: formatImage(product.image),
    galerija: (product.gallery || []).map(formatImage),
    videi: product.videos || [],
    varijante: mapVariations(product.variations),
    stanjeUkupno: getTotalStock(product),
    povezaniProizvodi: (product.relatedProducts || [])
      .filter((p) => p && typeof p === "object" && p.name)
      .map((p) => ({ id: p._id?.toString(), naziv: p.name, slug: p.slug })),
    povezaneUsluge: (product.relatedServices || [])
      .filter((s) => s && typeof s === "object" && s.name)
      .map((s) => ({ id: s._id?.toString(), naziv: s.name, slug: s.slug })),
    povezaniPostovi: (product.relatedPosts || [])
      .filter((p) => p && typeof p === "object" && p.title)
      .map((p) => ({ id: p._id?.toString(), naslov: p.title, slug: p.slug, slika: formatImage(p.coverImage) })),
    faq: (product.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    seoKljucneReci: product.seoKeywords || [],
    oznaka: translateBadge(product.badge),
    oznakaRaw: product.badge || "none",
    nacinDostave: translateShippingClass(product.shippingClass),
    nacinDostaveRaw: product.shippingClass || "standard",
    naUpit: !!product.priceOnRequest,
    aktivan: product.isActive,
    vreme: {
      kreiran: formatDateTime(product.createdAt),
      azuriran: formatDateTime(product.updatedAt),
    },
  };
}

// raw-shaped (IDs, not display strings) - used to pre-fill the admin edit form,
// same convention as mapServiceForEdit
export function mapProductForEdit(product) {
  if (!product) return null;

  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription || "",
    longDescription: product.longDescription || [],
    categories: (product.categories || []).map((c) => c._id?.toString() || c.toString()),
    tags: (product.tags || []).map((t) => t._id?.toString() || t.toString()),
    image: product.image || null,
    gallery: product.gallery || [],
    videos: product.videos || [],
    seoKeywords: product.seoKeywords || [],
    variations: product.variations || [],
    relatedProducts: (product.relatedProducts || []).map((p) => p._id?.toString() || p.toString()),
    relatedServices: (product.relatedServices || []).map((s) => s._id?.toString() || s.toString()),
    relatedPosts: (product.relatedPosts || []).map((p) => p._id?.toString() || p.toString()),
    faq: product.faq || [],
    badge: product.badge || "none",
    shippingClass: product.shippingClass || "standard",
    priceOnRequest: !!product.priceOnRequest,
    isActive: product.isActive,
  };
}

// public listing card - no faq/full gallery, just enough to render a grid
export function mapProductForPublicCard(product) {
  if (!product) return null;

  return {
    id: product._id.toString(),
    naziv: product.name,
    slug: product.slug,
    kratakOpis: product.shortDescription || "",
    slika: formatImage(product.image),
    kategorije: getCategoryNames(product),
    cena: getPriceRange(product),
    naUpit: !!product.priceOnRequest,
    naStanju: getTotalStock(product) > 0,
    oznaka: translateBadge(product.badge),
    oznakaRaw: product.badge || "none",
  };
}

export function mapProductsForPublic(products = []) {
  return products.map(mapProductForPublicCard).filter(Boolean);
}

export function mapProductForPublicDetail(product) {
  if (!product) return null;

  return {
    id: product._id.toString(),
    naziv: product.name,
    slug: product.slug,
    kratakOpis: product.shortDescription || "",
    dugiOpis: renderContentBlocks(product.longDescription),
    dugiOpisTekst: contentBlocksToPlainText(product.longDescription),
    kategorije: getCategoryNames(product),
    tagovi: getTagNames(product),
    slika: formatImage(product.image),
    galerija: (product.gallery || []).map(formatImage),
    videi: product.videos || [],
    varijante: mapVariations((product.variations || []).filter((v) => v.isActive)),
    povezaniProizvodi: (product.relatedProducts || [])
      .filter((p) => p && typeof p === "object" && p.name)
      .map((p) => ({ id: p._id?.toString(), naziv: p.name, slug: p.slug, slika: formatImage(p.image) })),
    povezaneUsluge: (product.relatedServices || [])
      .filter((s) => s && typeof s === "object" && s.name)
      .map((s) => ({ id: s._id?.toString(), naziv: s.name, slug: s.slug, slika: formatImage(s.image) })),
    povezaniPostovi: (product.relatedPosts || [])
      .filter((p) => p && typeof p === "object" && p.title)
      .map((p) => ({ id: p._id?.toString(), naslov: p.title, slug: p.slug, slika: formatImage(p.coverImage) })),
    faq: (product.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    oznaka: translateBadge(product.badge),
    naUpit: !!product.priceOnRequest,
  };
}

export function mapProductRaw(product) {
  return product;
}

// Same convention as mapCategoryForSelect/mapResourceForSelect (see category.mapper.js/
// resource.mapper.js) - a minimal {id, naziv} shape for populating a <select>/
// multiselect, used by both product.controller.js (relatedProducts on the product's
// own form) and service.controller.js (relatedProducts on the service form).
export function mapProductForSelect(product) {
  if (!product) return null;
  return {
    id: product._id.toString(),
    naziv: product.name,
  };
}

export function mapProductsForSelect(products = []) {
  return products.map(mapProductForSelect).filter(Boolean);
}

export default {
  mapProductsForAdminList,
  mapProductForAdminDetail,
  mapProductForEdit,
  mapProductForPublicCard,
  mapProductsForPublic,
  mapProductForPublicDetail,
  mapProductRaw,
  mapProductForSelect,
  mapProductsForSelect,
};