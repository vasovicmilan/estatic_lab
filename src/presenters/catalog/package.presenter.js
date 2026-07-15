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

export function preparePackageDetailData(pkg, { testimonials = [] } = {}) {
  return {
    package: pkg,
    testimonials,
    // NOTE: there is no multi-service package booking flow yet — appointment.service.js's
    // bookAppointment() only handles one service+variant at a time. Routing to /kontakt
    // as an honest interim CTA rather than linking to a booking route that doesn't exist.
    bookingUrl: `/kontakt?tema=${encodeURIComponent("Zakazivanje paketa: " + pkg.naziv)}`,
    breadcrumbs: [
      { label: "Paketi", url: "/paketi" },
      { label: pkg.naziv, url: null },
    ],
  };
}