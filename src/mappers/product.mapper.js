import { formatDateTime } from "../utils/date.time.util.js";

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
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
  const prices = (product.variations || []).filter((v) => v.isActive).map((v) => v.price);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min} RSD` : `${min} - ${max} RSD`;
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
        sku: product.sku,
        slug: product.slug,
        kategorije: getCategoryNames(product),
        cena: getPriceRange(product),
        stanje: getTotalStock(product),
        brojVarijanti: product.variations?.length || 0,
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
    dugiOpis: product.longDescription || "",
    kategorije: getCategoryNames(product),
    tagovi: getTagNames(product),
    slika: formatImage(product.image),
    galerija: (product.gallery || []).map(formatImage),
    videi: product.videos || [],
    varijante: mapVariations(product.variations),
    stanjeUkupno: getTotalStock(product),
    povezaniProizvodi: (product.relatedProducts || [])
      .filter((p) => p && typeof p === "object")
      .map((p) => ({ id: p._id?.toString(), naziv: p.name, slug: p.slug })),
    faq: (product.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    seoKljucneReci: product.seoKeywords || [],
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
    longDescription: product.longDescription || "",
    categories: (product.categories || []).map((c) => c._id?.toString() || c.toString()),
    tags: (product.tags || []).map((t) => t._id?.toString() || t.toString()),
    image: product.image || null,
    gallery: product.gallery || [],
    videos: product.videos || [],
    seoKeywords: product.seoKeywords || [],
    variations: product.variations || [],
    relatedProducts: (product.relatedProducts || []).map((p) => p._id?.toString() || p.toString()),
    faq: product.faq || [],
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
    naStanju: getTotalStock(product) > 0,
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
    dugiOpis: product.longDescription || "",
    kategorije: getCategoryNames(product),
    tagovi: getTagNames(product),
    slika: formatImage(product.image),
    galerija: (product.gallery || []).map(formatImage),
    videi: product.videos || [],
    varijante: mapVariations((product.variations || []).filter((v) => v.isActive)),
    povezaniProizvodi: (product.relatedProducts || [])
      .filter((p) => p && typeof p === "object")
      .map((p) => ({ id: p._id?.toString(), naziv: p.name, slug: p.slug, slika: formatImage(p.image) })),
    faq: (product.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
  };
}

export function mapProductRaw(product) {
  return product;
}

export default {
  mapProductsForAdminList,
  mapProductForAdminDetail,
  mapProductForEdit,
  mapProductForPublicCard,
  mapProductsForPublic,
  mapProductForPublicDetail,
  mapProductRaw,
};