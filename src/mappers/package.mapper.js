import { formatDateTime } from "../utils/date.time.util.js";

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

function findVariant(item) {
  if (item.service && typeof item.service === "object" && Array.isArray(item.service.packages)) {
    return item.service.packages.find((p) => String(p._id) === String(item.servicePackageId)) || null;
  }
  return null;
}

function getItemsSummary(items = []) {
  return items
    .filter((item) => item.service && typeof item.service === "object")
    .map((item) => {
      const variant = findVariant(item);
      return `${item.service.name}${variant ? ` — ${variant.name}` : ""} x${item.sessions}`;
    });
}

function mapItems(items = []) {
  return items.map((item) => {
    const variant = findVariant(item);
    return {
      usluga:
        item.service && typeof item.service === "object"
          ? { id: item.service._id.toString(), naziv: item.service.name, slug: item.service.slug }
          : { id: item.service?.toString() },
      varijanta: variant ? { id: variant._id.toString(), naziv: variant.name, cena: variant.totalPrice } : { id: item.servicePackageId?.toString() },
      brojSeansi: item.sessions,
    };
  });
}

export function mapPackagesForAdminList(packages = []) {
  return packages
    .map((pkg) => {
      if (!pkg) return null;
      return {
        id: pkg._id.toString(),
        naziv: pkg.name,
        slug: pkg.slug,
        stavke: getItemsSummary(pkg.items),
        cena: `${pkg.totalPrice} RSD`,
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

  return {
    id: pkg._id.toString(),
    naziv: pkg.name,
    slug: pkg.slug,
    kratakOpis: pkg.shortDescription || "",
    stavke: getItemsSummary(pkg.items),
    cena: `${pkg.totalPrice} RSD`,
    staraCena: pkg.basePrice ? `${pkg.basePrice} RSD` : null,
    oznaka: pkg.badge || null,
    najbolji: Boolean(pkg.isBest),
    slika: formatImage(pkg.image),
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