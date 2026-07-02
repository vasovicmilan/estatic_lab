export function preparePackageListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "stavke", label: "Usluge u paketu" },
      { key: "cena", label: "Cena" },
      { key: "najbolji", label: "Najbolji izbor" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/paketi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/paketi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/paketi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/paketi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: null },
    ],
    topbar: {
      createUrl: "/admin/paketi/dodavanje",
      createLabel: "Novi paket",
      searchUrl: "/admin/paketi/pretraga",
      search: query.search || "",
    },
  };
}

export function preparePackageDetailsData(pkg) {
  return {
    backUrl: "/admin/paketi",
    editUrl: `/admin/paketi/izmena/${pkg.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: pkg.naziv },
          { label: "Slug", value: pkg.slug },
          { label: "Kratak opis", value: pkg.kratakOpis || "-" },
          { label: "Opis", value: pkg.opis },
        ],
      },
      {
        title: "Usluge u paketu",
        type: "table",
        rows: pkg.stavke.map((s) => ({ label: s.usluga.naziv, value: `${s.brojSeansi} seansi` })),
      },
      {
        title: "FAQ",
        type: "table",
        rows: pkg.faq.map((f) => ({ label: f.pitanje, value: f.odgovor })),
      },
    ],
    sidebar: [
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Cena", value: `${pkg.cena} RSD` },
          { label: "Stara cena", value: pkg.staraCena ? `${pkg.staraCena} RSD` : "-" },
          { label: "Ukupno trajanje", value: pkg.ukupnoTrajanje || "-" },
          { label: "Oznaka", value: pkg.oznaka || "-" },
          { label: "Najbolji izbor", value: pkg.najbolji ? "Da" : "Ne" },
          { label: "Aktivan", value: pkg.aktivan ? "Da" : "Ne" },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: pkg.vreme.kreiran },
          { label: "Ažuriran", value: pkg.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: "/admin/paketi" },
      { label: pkg.naziv, url: null },
    ],
  };
}

export function preparePackageFormData(pkg = null, { serviceOptions = [], categoryOptions = [], tagOptions = [] } = {}) {
  const isEdit = !!pkg;

  return {
    formAction: isEdit ? `/admin/paketi/izmena/${pkg.id}` : "/admin/paketi/dodavanje",
    isEdit,
    backUrl: "/admin/paketi",
    formData: isEdit
      ? pkg
      : {
          name: "",
          slug: "",
          description: "",
          shortDescription: "",
          items: [{ service: "", sessions: 1 }],
          totalPrice: 0,
          basePrice: null,
          totalDuration: null,
          badge: "",
          isBest: false,
          order: 0,
          image: null,
          gallery: [],
          categories: [],
          tags: [],
          faq: [],
          isActive: true,
        },
    serviceOptions,
    categoryOptions,
    tagOptions,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: "/admin/paketi" },
      { label: isEdit ? "Izmena" : "Novi paket", url: null },
    ],
  };
}