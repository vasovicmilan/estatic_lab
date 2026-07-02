export function preparePackageListData(result, query = {}) {
  return {
    packages: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/paketi",
      query,
    },
    breadcrumbs: [{ label: "Paketi", url: null }],
  };
}

export function preparePackageDetailData(pkg) {
  return {
    package: pkg,
    bookingUrl: `/zakazivanje/paket/${pkg.slug}`,
    breadcrumbs: [
      { label: "Paketi", url: "/paketi" },
      { label: pkg.naziv, url: null },
    ],
  };
}