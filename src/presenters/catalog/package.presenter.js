export function preparePackageListData(result, query = {}) {
  return {
    packages: result.data,
    subtitle: "Kombinacije tretmana osmišljene da vam donesu više za manje — bez žurbe, uz naš tim koji brine o detaljima.",
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