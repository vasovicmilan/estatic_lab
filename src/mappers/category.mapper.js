import { formatDateTime } from "../utils/date.time.util.js";

function formatImage(image) {
  if (!image || !image.img) return null;
  return {
    url: image.img,
    alt: image.imgDesc || null,
  };
}

function translateDomain(domain) {
  const map = {
    post: "Blog",
    service: "Usluga",
    product: "Proizvod",
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
        slika: formatImage(category.featureImage),
        slug: category.slug,
        domen: translateDomain(category.domain),
        domenRaw: category.domain,
        roditelj: category.parent
          ? category.parent.name
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
      ? category.parent.name
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
    content: category.content || [],
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
    // needed to group a flat category list into hierarchy tiers for the shop's
    // category chip navigation (see product.presenter.js's buildCategoryTabRows)
    parent: category.parent?._id?.toString() || category.parent?.toString() || null,
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

// Same {id, naziv, slug, domen} shape as mapCategoriesForSelect, but sorted into
// parent-before-children order with the name visually indented by depth
// ("— " per level) - so a dropdown reads as a tree, not a flat alphabetical
// list where a broad parent (e.g. "Aparati i oprema") looks exactly like any
// narrow leaf category. This matters most for coupon.model.js's
// excludedCategories: picking a category there also excludes every
// descendant automatically (see category.service.js's
// getCategoryAndDescendantIds) - an admin who can't tell a parent from a leaf
// at a glance can accidentally exclude far more of the catalog than intended
// with no visual warning at selection time.
export function mapCategoriesForSelectWithHierarchy(categories = []) {
  const byParent = new Map();
  for (const category of categories) {
    const parentId = category.parent ? (category.parent._id || category.parent).toString() : null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(category);
  }

  const result = [];
  const visited = new Set();

  function walk(parentId, depth) {
    const children = byParent.get(parentId) || [];
    for (const category of children) {
      const idStr = category._id.toString();
      if (visited.has(idStr)) continue; // guards the same accidental-cycle case findCategoryAndDescendantIds already guards
      visited.add(idStr);
      const mapped = mapCategoryForSelect(category);
      if (mapped) result.push({ ...mapped, naziv: `${"— ".repeat(depth)}${mapped.naziv}` });
      walk(idStr, depth + 1);
    }
  }

  walk(null, 0);

  // orphaned rows (parent id doesn't match any category in this list, e.g. a
  // stray/mismatched domain) would otherwise silently vanish from the
  // dropdown entirely - surface them at the root level instead of hiding them
  for (const category of categories) {
    const idStr = category._id.toString();
    if (!visited.has(idStr)) {
      visited.add(idStr);
      const mapped = mapCategoryForSelect(category);
      if (mapped) result.push(mapped);
    }
  }

  return result;
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