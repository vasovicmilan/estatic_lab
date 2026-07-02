import { formatDateTime } from "../utils/date.time.util.js";

function translateDomain(domain) {
  const map = {
    post: "Blog",
    service: "Usluga",
  };
  return map[domain] || domain;
}

function translateIndexable(isIndexable) {
  return isIndexable ? "Dozvoljeno" : "Zabranjeno";
}

function translateActive(isActive) {
  return isActive ? "Da" : "Ne";
}

export function mapCategoriesForAdminList(categories = []) {
  return categories
    .map((category) => {
      if (!category) return null;
      return {
        id: category._id.toString(),
        naziv: category.name,
        slug: category.slug,
        domen: translateDomain(category.domain),
        domenRaw: category.domain,
        roditelj: category.parent
          ? typeof category.parent === "object"
            ? category.parent.name
            : category.parent.toString()
          : null,
        prioritet: category.meta?.priority ?? 0,
        aktivna: translateActive(category.meta?.isActive),
        kreirana: formatDateTime(category.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapCategoryForAdminDetail(category) {
  if (!category) return null;

  return {
    id: category._id.toString(),
    naziv: category.name,
    slug: category.slug,
    domen: category.domain,
    roditelj: category.parent
      ? typeof category.parent === "object"
        ? { id: category.parent._id.toString(), naziv: category.parent.name, slug: category.parent.slug }
        : { id: category.parent.toString() }
      : null,
    kratakOpis: category.shortDescription || null,
    dugiOpis: category.longDescription || null,
    slika: category.featureImage
      ? {
          url: category.featureImage.img,
          opis: category.featureImage.imgDesc || null,
        }
      : null,
    meta: {
      indeksiranje: translateIndexable(category.isIndexable),
      prioritet: category.meta?.priority ?? 0,
      aktivna: translateActive(category.meta?.isActive),
    },
    vreme: {
      kreirano: formatDateTime(category.createdAt),
      azurirano: formatDateTime(category.updatedAt),
    },
  };
}

export function mapCategoryForEdit(category) {
  if (!category) return null;

  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    domain: category.domain,
    parent: category.parent?._id?.toString() || category.parent?.toString() || null,
    shortDescription: category.shortDescription || "",
    longDescription: category.longDescription || "",
    featureImage: category.featureImage || null,
    isIndexable: category.isIndexable,
    priority: category.meta?.priority ?? 0,
    isActive: category.meta?.isActive ?? true,
  };
}

export function mapCategoryForPublic(category) {
  if (!category) return null;

  return {
    id: category._id.toString(),
    naziv: category.name,
    slug: category.slug,
    domen: category.domain,
    kratakOpis: category.shortDescription || null,
    slika: category.featureImage?.img || null,
    slikaOpis: category.featureImage?.imgDesc || null,
  };
}

export function mapCategoriesForPublic(categories = []) {
  return categories.map(mapCategoryForPublic).filter(Boolean);
}

export function mapCategoryForSelect(category) {
  if (!category) return null;

  return {
    id: category._id.toString(),
    slug: category.slug,
    naziv: category.name,
    domen: category.domain,
  };
}

export function mapCategoriesForSelect(categories = []) {
  return categories.map(mapCategoryForSelect).filter(Boolean);
}

export function mapCategoryRaw(category) {
  return category;
}

export default {
  mapCategoriesForAdminList,
  mapCategoryForAdminDetail,
  mapCategoryForEdit,
  mapCategoryForPublic,
  mapCategoriesForPublic,
  mapCategoryForSelect,
  mapCategoriesForSelect,
  mapCategoryRaw,
};