import { formatDateTime } from "../utils/date.time.util.js";
import { formatMoney } from "../utils/price.util.js";

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

// A raw (unpopulated) Mongoose ObjectId is ALSO typeof "object" - and it even has a
// self-aliasing `._id` getter for interop - so `typeof x === "object"` alone cannot
// tell a raw ObjectId apart from a real populated Service document. Checking for
// `.name` (a field only the real document has) is the actual distinguishing signal.
function isPopulatedService(service) {
  return Boolean(service && typeof service === "object" && typeof service.name === "string");
}

function findVariant(item) {
  if (isPopulatedService(item.service) && Array.isArray(item.service.packages)) {
    return item.service.packages.find((p) => String(p._id) === String(item.servicePackageId)) || null;
  }
  return null;
}

// item.service is the live populated Service doc when the query populated this path
// and the referenced Service still exists. Two distinct "not populated" cases, easy
// to mix up:
//  - a raw ObjectId (truthy, no .name): the query simply didn't request a populate
//    on this path - not necessarily deleted, just not fetched here. No name is
//    available to show, but the id itself is still valid.
//  - null: populate() ran and came back empty - the referenced Service really was
//    deleted (shouldn't happen going forward now that service.service.js blocks
//    that - see deleteServiceById - but pre-existing/stale data can still have it).
// Showing a clear placeholder for either case, instead of silently dropping the item
// (the old behavior), matters: a package missing an item from its summary looks like
// it has fewer things in it than it's actually priced for.
function serviceLabel(item) {
  if (isPopulatedService(item.service)) return item.service.name;
  if (item.service) return "Usluga nije učitana";
  return "Usluga obrisana";
}

function getItemsSummary(items = []) {
  return items.map((item) => {
    const variant = findVariant(item);
    return `${serviceLabel(item)}${variant ? ` - ${variant.name}` : ""} x${item.sessions}`;
  });
}

function mapItems(items = []) {
  return items.map((item) => {
    const variant = findVariant(item);
    return {
      usluga: isPopulatedService(item.service)
        ? { id: item.service._id.toString(), naziv: item.service.name, slug: item.service.slug }
        : { id: item.service?.toString() || null, naziv: serviceLabel(item) },
      varijanta: variant ? { id: variant._id.toString(), naziv: variant.name, cena: variant.totalPrice } : { id: item.servicePackageId?.toString() },
      brojSeansi: item.sessions,
    };
  });
}

function getVariantDuration(item) {
  const variant = findVariant(item);
  return variant ? variant.duration : null;
}

// Packages built from a single service item (e.g. "Tesla-Tone 24 - 5 tretmana"
// and "Tesla-Tone 24 - 10 tretmana") are really session-count tiers of the same
// treatment, not distinct bundles - grouping key ties them together so the
// listing page can render one card with a tier toggle instead of two separate
// cards. Multi-item bundles (a combo of several different services) don't have
// this concept, so each gets its own standalone group keyed by its own id.
function buildGroupKey(pkg) {
  const items = pkg.items || [];
  if (items.length !== 1) return `standalone:${pkg._id}`;

  const [item] = items;
  const serviceKey = isPopulatedService(item.service) ? item.service.slug : item.service?.toString() || "nepoznato";
  return `${serviceKey}:${item.servicePackageId}`;
}

function getSavingsPercent(pkg) {
  if (!pkg.basePrice) return null;
  return Math.round((1 - pkg.totalPrice / pkg.basePrice) * 100);
}

export function mapPackagesForAdminList(packages = []) {
  return packages
    .map((pkg) => {
      if (!pkg) return null;
      return {
        id: pkg._id.toString(),
        naziv: pkg.name,
        slika: formatImage(pkg.image),
        slug: pkg.slug,
        stavke: getItemsSummary(pkg.items),
        cena: formatMoney(pkg.totalPrice),
        najbolji: pkg.isBest ? "Da" : "Ne",
        aktivan: pkg.isActive ? "Da" : "Ne",
        kreiran: formatDateTime(pkg.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapPackageForAdminDetail(pkg) {
  if (!pkg) return null;

  return {
    id: pkg._id.toString(),
    naziv: pkg.name,
    slug: pkg.slug,
    opis: pkg.description,
    kratakOpis: pkg.shortDescription || "",
    stavke: mapItems(pkg.items),
    cena: pkg.totalPrice,
    staraCena: pkg.basePrice || null,
    ukupnoTrajanje: pkg.totalDuration ? `${pkg.totalDuration} min` : null,
    oznaka: pkg.badge || "",
    najbolji: pkg.isBest,
    redosled: pkg.order || 0,
    slika: formatImage(pkg.image),
    galerija: (pkg.gallery || []).map(formatImage),
    faq: (pkg.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    aktivan: pkg.isActive,
    vreme: {
      kreiran: formatDateTime(pkg.createdAt),
      azuriran: formatDateTime(pkg.updatedAt),
    },
  };
}

export function mapPackageForEdit(pkg) {
  if (!pkg) return null;

  return {
    id: pkg._id.toString(),
    name: pkg.name,
    slug: pkg.slug,
    description: pkg.description,
    shortDescription: pkg.shortDescription || "",
    items: (pkg.items || []).map((item) => ({
      service: item.service?._id?.toString() || item.service?.toString(),
      servicePackageId: item.servicePackageId?.toString(),
      sessions: item.sessions,
    })),
    totalPrice: pkg.totalPrice,
    basePrice: pkg.basePrice || null,
    totalDuration: pkg.totalDuration || null,
    badge: pkg.badge || "",
    isBest: pkg.isBest,
    order: pkg.order || 0,
    image: pkg.image || null,
    gallery: pkg.gallery || [],
    videos: pkg.videos || [],
    categories: (pkg.categories || []).map((c) => c._id?.toString() || c.toString()),
    tags: (pkg.tags || []).map((t) => t._id?.toString() || t.toString()),
    faq: pkg.faq || [],
    isActive: pkg.isActive,
  };
}

export function mapPackageForPublicCard(pkg) {
  if (!pkg) return null;

  const items = pkg.items || [];
  const isSingleServiceRepeat = items.length === 1;
  const [firstItem] = items;

  return {
    id: pkg._id.toString(),
    naziv: pkg.name,
    slug: pkg.slug,
    kratakOpis: pkg.shortDescription || "",
    stavke: getItemsSummary(pkg.items),
    cena: formatMoney(pkg.totalPrice),
    staraCena: pkg.basePrice ? formatMoney(pkg.basePrice) : null,
    ustedaProcenat: getSavingsPercent(pkg),
    oznaka: pkg.badge || null,
    najbolji: Boolean(pkg.isBest),
    slika: formatImage(pkg.image),
    brojSeansi: isSingleServiceRepeat ? firstItem.sessions : null,
    trajanjePoSeansi: isSingleServiceRepeat ? getVariantDuration(firstItem) : null,
    naslovTretmana: isSingleServiceRepeat && isPopulatedService(firstItem.service) ? firstItem.service.name : pkg.name,
    grupa: buildGroupKey(pkg),
  };
}

export function mapPackagesForPublic(packages = []) {
  return packages.map(mapPackageForPublicCard).filter(Boolean);
}

export function mapPackageForPublicDetail(pkg) {
  if (!pkg) return null;

  return {
    id: pkg._id.toString(),
    naziv: pkg.name,
    slug: pkg.slug,
    opis: pkg.description,
    kratakOpis: pkg.shortDescription || "",
    stavke: mapItems(pkg.items),
    cena: pkg.totalPrice,
    staraCena: pkg.basePrice || null,
    ukupnoTrajanje: pkg.totalDuration ? `${pkg.totalDuration} min` : null,
    oznaka: pkg.badge || "",
    najbolji: pkg.isBest,
    slika: formatImage(pkg.image),
    galerija: (pkg.gallery || []).map(formatImage),
    videi: pkg.videos || [],
    faq: (pkg.faq || []).map((f) => ({ pitanje: f.question, odgovor: f.answer })),
    seoKeywords: pkg.seoKeywords || [],
  };
}

export function mapPackageRaw(pkg) {
  return pkg;
}

export default {
  mapPackagesForAdminList,
  mapPackageForAdminDetail,
  mapPackageForEdit,
  mapPackageForPublicCard,
  mapPackagesForPublic,
  mapPackageForPublicDetail,
  mapPackageRaw,
};