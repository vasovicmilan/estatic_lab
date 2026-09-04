import { formatDateTime } from "../utils/date.time.util.js";
import { formatPrice, formatMoney } from "../utils/price.util.js";

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

function getCategoryNames(service) {
  if (!service.categories || !Array.isArray(service.categories)) return [];
  return service.categories.filter((c) => c && typeof c === "object" && c.name).map((c) => c.name);
}

function getTagNames(service) {
  if (!service.tags || !Array.isArray(service.tags)) return [];
  return service.tags.filter((t) => t && typeof t === "object" && t.name).map((t) => t.name);
}

// Each entry in service.resources may arrive as a raw ObjectId (not populated)
// or a populated {_id, name, capacity} document - same ambiguity the project's
// other mappers already handle for other refs (see the mapper-bug pattern fix
// noted for package/employee/testimonial mappers: typeof "object" alone can't
// distinguish a raw ObjectId from a populated doc, since ObjectId is also
// typeof "object" - only an actual populated field has a `.name`).
function getResourceNames(service) {
  if (!service.resources || !Array.isArray(service.resources)) return [];
  return service.resources.filter((r) => r && typeof r === "object" && r.name).map((r) => r.name);
}

function getResourceIds(service) {
  if (!service.resources || !Array.isArray(service.resources)) return [];
  return service.resources.map((r) => (typeof r === "object" ? r._id?.toString() : r?.toString())).filter(Boolean);
}

// Each entry in service.relatedProducts may arrive as a raw ObjectId or a
// populated {_id, name, slug, image} document - same ambiguity handled for
// resources above.
function getRelatedProductCards(service) {
  if (!service.relatedProducts || !Array.isArray(service.relatedProducts)) return [];
  return service.relatedProducts
    .filter((p) => p && typeof p === "object" && p.name)
    .map((p) => ({ id: p._id?.toString(), naziv: p.name, slug: p.slug, slika: formatImage(p.image) }));
}

function getRelatedProductIds(service) {
  if (!service.relatedProducts || !Array.isArray(service.relatedProducts)) return [];
  return service.relatedProducts.map((p) => (typeof p === "object" ? p._id?.toString() : p?.toString())).filter(Boolean);
}

function getRelatedPostCards(entity) {
  if (!entity.relatedPosts || !Array.isArray(entity.relatedPosts)) return [];
  return entity.relatedPosts
    .filter((p) => p && typeof p === "object" && p.title)
    .map((p) => ({ id: p._id?.toString(), naslov: p.title, slug: p.slug, slika: formatImage(p.coverImage) }));
}

function getRelatedPostIds(entity) {
  if (!entity.relatedPosts || !Array.isArray(entity.relatedPosts)) return [];
  return entity.relatedPosts.map((p) => (typeof p === "object" ? p._id?.toString() : p?.toString())).filter(Boolean);
}

function getPriceRange(service) {
  const prices = (service.packages || []).filter((p) => p.isActive).map((p) => p.totalPrice);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatPrice(min)} - ${formatMoney(max)}`;
}

function mapPackages(packages = []) {
  return packages.map((p) => ({
    id: p._id?.toString(),
    naziv: p.name,
    slug: p.slug,
    brojSeansi: p.sessions,
    trajanje: `${p.duration} min`,
    cena: formatMoney(p.totalPrice),
    staraCena: p.basePrice ? formatMoney(p.basePrice) : null,
    oznaka: p.badge || null,
    najbolji: Boolean(p.isBest),
    aktivan: Boolean(p.isActive),
  }));
}

function mapFeatures(features = []) {
  return features
    .filter((f) => f.isActive)
    .map((f) => ({
      id: f._id?.toString(),
      naziv: f.name,
      slug: f.slug,
      opis: f.description,
      ikona: f.icon || null,
    }));
}

export function mapServicesForAdminList(services = []) {
  return services
    .map((service) => {
      if (!service) return null;
      return {
        id: service._id.toString(),
        naziv: service.name,
        slika: formatImage(service.image),
        slug: service.slug,
        kategorije: getCategoryNames(service),
        cena: getPriceRange(service),
        brojVarijanti: service.packages?.length || 0,
        istaknuto: service.highlight ? "Da" : "Ne",
        aktivna: service.isActive ? "Da" : "Ne",
        kreirana: formatDateTime(service.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapServiceForAdminDetail(service) {
  if (!service) return null;

  return {
    id: service._id.toString(),
    naziv: service.name,
    slug: service.slug,
    kratakOpis: service.shortDescription || "",
    dugiOpis: service.longDescription || "",
    kategorije: getCategoryNames(service),
    tagovi: getTagNames(service),
    resursi: getResourceNames(service),
    slika: formatImage(service.image),
    galerija: (service.gallery || []).map(formatImage),
    trajanjePodrazumevano: `${service.defaultDuration} min`,
    istaknuto: service.highlight,
    cta: service.ctaText,
    karakteristike: (service.features || []).map((f) => ({
      id: f._id?.toString(),
      naziv: f.name,
      opis: f.description,
      ikona: f.icon || null,
      aktivna: f.isActive,
    })),
    varijante: (service.packages || []).map((p) => ({
      id: p._id?.toString(),
      naziv: p.name,
      slug: p.slug,
      brojSeansi: p.sessions,
      trajanje: p.duration,
      cena: p.totalPrice,
      staraCena: p.basePrice || null,
      oznaka: p.badge || null,
      najbolji: p.isBest,
      aktivan: p.isActive,
    })),
    tabelaPoredjenja: {
      kolone: service.comparisonColumns || [],
      redovi: service.comparisonTable || [],
    },
    faq: (service.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    povezaniProizvodi: getRelatedProductCards(service),
    povezaniPostovi: getRelatedPostCards(service),
    seoKljucneReci: service.seoKeywords || [],
    aktivna: service.isActive,
    vreme: {
      kreirana: formatDateTime(service.createdAt),
      azurirana: formatDateTime(service.updatedAt),
    },
  };
}

export function mapServiceForEdit(service) {
  if (!service) return null;

  return {
    id: service._id.toString(),
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription || "",
    longDescription: service.longDescription || "",
    categories: (service.categories || []).map((c) => c._id?.toString() || c.toString()),
    tags: (service.tags || []).map((t) => t._id?.toString() || t.toString()),
    resources: getResourceIds(service),
    relatedProducts: getRelatedProductIds(service),
    relatedPosts: getRelatedPostIds(service),
    equipmentNoteText: service.equipmentNote?.text || "",
    equipmentNoteButtonText: service.equipmentNote?.buttonText || "",
    equipmentNoteButtonUrl: service.equipmentNote?.buttonUrl || "",
    image: service.image || null,
    gallery: service.gallery || [],
    videos: service.videos || [],
    seoKeywords: service.seoKeywords || [],
    defaultDuration: service.defaultDuration,
    highlight: service.highlight,
    ctaText: service.ctaText,
    features: service.features || [],
    packages: service.packages || [],
    comparisonColumns: service.comparisonColumns || [],
    comparisonTable: service.comparisonTable || [],
    faq: service.faq || [],
    isActive: service.isActive,
  };
}

// public listing card - no comparison table/full faq, just enough to render a grid
export function mapServiceForPublicCard(service) {
  if (!service) return null;

  return {
    id: service._id.toString(),
    naziv: service.name,
    slug: service.slug,
    kratakOpis: service.shortDescription || "",
    slika: formatImage(service.image),
    kategorije: getCategoryNames(service),
    cena: getPriceRange(service),
    istaknuto: Boolean(service.highlight),
    cta: service.ctaText,
  };
}

export function mapServicesForPublic(services = []) {
  return services.map(mapServiceForPublicCard).filter(Boolean);
}

export function mapServiceForPublicDetail(service) {
  if (!service) return null;

  return {
    id: service._id.toString(),
    naziv: service.name,
    slug: service.slug,
    kratakOpis: service.shortDescription || "",
    dugiOpis: service.longDescription || "",
    kategorije: getCategoryNames(service),
    tagovi: getTagNames(service),
    slika: formatImage(service.image),
    galerija: (service.gallery || []).map(formatImage),
    videi: service.videos || [],
    cta: service.ctaText,
    karakteristike: mapFeatures(service.features),
    varijante: mapPackages(service.packages),
    tabelaPoredjenja: {
      kolone: service.comparisonColumns || [],
      redovi: service.comparisonTable || [],
    },
    faq: (service.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    povezaniProizvodi: getRelatedProductCards(service),
    povezaniPostovi: getRelatedPostCards(service),
    opremaNapomena: service.equipmentNote?.text
      ? {
          tekst: service.equipmentNote.text,
          dugmeTekst: service.equipmentNote.buttonText || "Pogledajte opremu",
          dugmeUrl: service.equipmentNote.buttonUrl || "/prodavnica",
        }
      : null,
  };
}

export function mapServiceRaw(service) {
  return service;
}

// Same convention as mapCategoryForSelect/mapResourceForSelect (see category.mapper.js/
// resource.mapper.js) - a minimal {id, naziv} shape for populating a <select>/
// multiselect, used by product.controller.js's relatedServices field on the
// product's own form.
export function mapServiceForSelect(service) {
  if (!service) return null;
  return {
    id: service._id.toString(),
    naziv: service.name,
  };
}

export function mapServicesForSelect(services = []) {
  return services.map(mapServiceForSelect).filter(Boolean);
}

export default {
  mapServicesForAdminList,
  mapServiceForAdminDetail,
  mapServiceForEdit,
  mapServiceForPublicCard,
  mapServicesForPublic,
  mapServiceForPublicDetail,
  mapServiceRaw,
  mapServiceForSelect,
  mapServicesForSelect,
};