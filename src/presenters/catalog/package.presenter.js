import { PUBLIC_PAGE_SIZES } from "../../utils/pagination.util.js";
import { DEFAULT_PACKAGES_INTRO } from "../../config/site-content-defaults.js";
import { buildCategoryTabRows } from "../../utils/category-tabs.util.js";

// Groups the flat package list into per-treatment "tiers": packages sharing
// the same grupa key (see package.mapper.js buildGroupKey) are the same
// underlying treatment at different session counts (5 vs 10, etc.) and render
// as one card with a toggle; a package with no siblings just gets a group of
// one and renders like a normal standalone card.
function groupPackagesByTreatment(packages = []) {
  const order = [];
  const groups = new Map();

  packages.forEach((pkg) => {
    if (!groups.has(pkg.grupa)) {
      groups.set(pkg.grupa, []);
      order.push(pkg.grupa);
    }
    groups.get(pkg.grupa).push(pkg);
  });

  return order.map((key) => {
    const tiers = [...groups.get(key)].sort((a, b) => (a.brojSeansi || 0) - (b.brojSeansi || 0));
    const defaultTier = tiers.find((t) => t.najbolji) || tiers[tiers.length - 1];
    return {
      naslov: defaultTier.naslovTretmana,
      trajanjePoSeansi: defaultTier.trajanjePoSeansi,
      tiers,
      defaultTierId: defaultTier.id,
    };
  });
}

// Package categories are the same "service"-domain categories services use. A
// category's count is the number of display cards (treatment groups, see
// groupPackagesByTreatment) that have at least one package in it or in any of
// its descendants - counted in memory off the already-fetched full catalog, so
// the tab bar costs no extra queries. Categories with no packages are dropped
// (a package catalog is far smaller than the service one, most service
// categories would otherwise show as empty tabs); the active one is always kept.
export function attachPackageCountsToCategories(categories = [], packages = [], activeCategoryId = null) {
  const childrenByParent = new Map();
  categories.forEach((c) => {
    if (!c.parent) return;
    if (!childrenByParent.has(c.parent)) childrenByParent.set(c.parent, []);
    childrenByParent.get(c.parent).push(c.id);
  });

  function descendantIds(rootId) {
    const seen = new Set([rootId]);
    const stack = [rootId];
    while (stack.length) {
      for (const child of childrenByParent.get(stack.pop()) || []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
    return seen;
  }

  return categories
    .map((cat) => {
      const ids = descendantIds(cat.id);
      const groups = new Set(packages.filter((p) => (p.kategorije || []).some((id) => ids.has(id))).map((p) => p.grupa));
      return { ...cat, count: groups.size };
    })
    .filter((cat) => cat.count > 0 || cat.id === activeCategoryId);
}

export function countPackageGroups(packages = []) {
  return new Set(packages.map((p) => p.grupa)).size;
}

export function preparePackageListData(
  packages,
  query = {},
  { page = 1, perPage = 12, intro = DEFAULT_PACKAGES_INTRO, category = null, categories = [], totalCount = 0 } = {}
) {
  // Grouping happens across the WHOLE catalog first, THEN the resulting
  // groups (display cards) are what gets paginated - not the raw Package
  // documents. Doing it the other way around (paginate raw documents, then
  // group whatever landed on this page) could split a 5/10-session tier pair
  // across two different pages, silently breaking that pair's toggle on
  // whichever page ended up with only one half. See package.controller.js's
  // own comment on why this function now takes the full package list rather
  // than an already-paginated DB result.
  const allGroups = groupPackagesByTreatment(packages);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const totalPages = Math.max(1, Math.ceil(allGroups.length / perPage));
  const start = (currentPage - 1) * perPage;
  const pageGroups = allGroups.slice(start, start + perPage);

  return {
    packages,
    packageGroups: pageGroups,
    subtitle: category
      ? category.description || ""
      : "Kombinacije tretmana osmišljene da vam donesu više za manje - bez žurbe, uz naš tim koji brine o detaljima.",
    intro: category ? null : intro,
    category,
    categoryTabRows:
      categories.length > 0
        ? buildCategoryTabRows(categories, category ? category.slug : null, totalCount, { basePath: "/paketi/kategorija", allLabel: "Svi paketi" })
        : [],
    pagination: {
      currentPage,
      totalPages,
      limit: perPage,
      total: allGroups.length,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: category ? `/paketi/kategorija/${category.slug}` : "/paketi",
      query,
    },
    breadcrumbs: category
      ? [
          { label: "Paketi", url: "/paketi" },
          { label: category.naziv, url: null },
        ]
      : [{ label: "Paketi", url: null }],
  };
}

export function preparePackageDetailData(pkg, { testimonials = [] } = {}) {
  return {
    package: pkg,
    testimonials,
    bookingUrl: `/kontakt?tema=${encodeURIComponent("Zakazivanje paketa: " + pkg.naziv)}`,
    breadcrumbs: [
      { label: "Paketi", url: "/paketi" },
      { label: pkg.naziv, url: null },
    ],
  };
}