// Gives the /paketi listing real, indexable body copy explaining what
// packages are and why they're worth choosing over single-visit bookings,
// before the visitor starts browsing the grid.
const PACKAGE_LIST_INTRO = {
  eyebrow: "Naši paketi",
  title: "Paketi tretmana - više seansi, niža cena po poseti",
  lead:
    "Ako planirate da ponavljate isti tretman, paket vam donosi istu negu uz nižu cenu po poseti i jednostavnije zakazivanje unapred.",
  paragraphs: [
    "Svaki paket sadrži unapred definisan broj seansi jednog tretmana ili kombinacije tretmana, uz mogućnost da termine zakazujete kad god vama odgovara. Cena po paketu je uvek niža od zbira pojedinačnih poseta - razlika je vidljiva na svakoj kartici paketa.",
  ],
  highlights: [
    {
      icon: "bi-piggy-bank",
      title: "Niža cena po seansi",
      text: "Plaćate paket unapred i uštedite u odnosu na pojedinačno zakazivanje istog tretmana.",
    },
    {
      icon: "bi-calendar2-week",
      title: "Fleksibilno zakazivanje",
      text: "Seanse iz paketa zakazujete kad vama odgovara, u dogovoru sa terapeutom.",
    },
    {
      icon: "bi-graph-up-arrow",
      title: "Vidljivi rezultati",
      text: "Veći broj tretmana obično daje bolje i trajnije rezultate nego pojedinačna poseta.",
    },
    {
      icon: "bi-gift",
      title: "Idealno za poklon",
      text: "Paket možete pokloniti nekome ko zaslužuje predah i negu.",
    },
  ],
};

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

export function preparePackageListData(result, query = {}) {
  return {
    packages: result.data,
    packageGroups: groupPackagesByTreatment(result.data),
    subtitle: "Kombinacije tretmana osmišljene da vam donesu više za manje - bez žurbe, uz naš tim koji brine o detaljima.",
    intro: PACKAGE_LIST_INTRO,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
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