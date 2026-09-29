import { PUBLIC_PAGE_SIZES } from "../../utils/pagination.util.js";
import { DEFAULT_PACKAGES_INTRO } from "../../config/site-content-defaults.js";

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

export function preparePackageListData(packages, query = {}, { page = 1, perPage = 12, intro = DEFAULT_PACKAGES_INTRO } = {}) {
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
    subtitle: "Kombinacije tretmana osmišljene da vam donesu više za manje - bez žurbe, uz naš tim koji brine o detaljima.",
    intro,
    pagination: {
      currentPage,
      totalPages,
      limit: perPage,
      total: allGroups.length,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: "/paketi",
      query,
    },
    breadcrumbs: [{ label: "Paketi", url: null }],
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