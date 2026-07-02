import { formatDateTime } from "../utils/date.time.util.js";

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

function getPriceRange(service) {
  const prices = (service.packages || []).filter((p) => p.isActive).map((p) => p.totalPrice);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min} RSD` : `${min} - ${max} RSD`;
}

function mapPackages(packages = []) {
  return packages.map((p) => ({
    id: p._id?.toString(),
    naziv: p.name,
    slug: p.slug,
    brojSeansi: p.sessions,
    trajanje: `${p.duration} min`,
    cena: `${p.totalPrice} RSD`,
    staraCena: p.basePrice ? `${p.basePrice} RSD` : null,
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
    terapeuti: (service.employees || []).map((e) => (typeof e === "object" ? e._id?.toString() : e?.toString())),
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
    employees: (service.employees || []).map((e) => e._id?.toString() || e.toString()),
    isActive: service.isActive,
  };
}

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
  };
}

export function mapServiceRaw(service) {
  return service;
}

export default {
  mapServicesForAdminList,
  mapServiceForAdminDetail,
  mapServiceForEdit,
  mapServiceForPublicCard,
  mapServicesForPublic,
  mapServiceForPublicDetail,
  mapServiceRaw,
};