export function prepareServiceListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "kategorije", label: "Kategorije" },
      { key: "cena", label: "Cena" },
      { key: "brojVarijanti", label: "Varijante" },
      { key: "istaknuto", label: "Istaknuto" },
      { key: "aktivna", label: "Aktivna" },
      { key: "kreirana", label: "Kreirana" },
    ],
    actions: [
      { type: "view", url: "/admin/usluge/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/usluge/izmena/", icon: "pencil" },
      { type: "custom", url: "/admin/usluge/", idKey: "id", subPath: "seo", icon: "search", label: "SEO" },
      { type: "delete", url: "/admin/usluge/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/usluge",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: null },
    ],
    topbar: {
      createUrl: "/admin/usluge/dodavanje",
      createLabel: "Nova usluga",
      searchUrl: "/admin/usluge/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "isActive",
          label: "Status",
          value: query.isActive || "",
          options: [
            { value: "", label: "Svi" },
            { value: "true", label: "Aktivne" },
            { value: "false", label: "Neaktivne" },
          ],
        },
      ],
    },
  };
}

export function prepareServiceDetailsData(service) {
  return {
    backUrl: "/admin/usluge",
    editUrl: `/admin/usluge/izmena/${service.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: service.naziv },
          { label: "Slug", value: service.slug },
          { label: "Kratak opis", value: service.kratakOpis || "-" },
          { label: "Kategorije", value: service.kategorije.join(", ") || "-" },
          { label: "Tagovi", value: service.tagovi.join(", ") || "-" },
          { label: "Podrazumevano trajanje", value: service.trajanjePodrazumevano },
        ],
      },
      {
        title: "Varijante (paketi usluge)",
        type: "table",
        rows: [],
        customRows: service.varijante, // rendered by a dedicated partial (naziv/trajanje/cena/aktivan)
      },
      {
        title: "Karakteristike",
        type: "list",
        items: service.karakteristike.map((f) => f.naziv),
      },
      {
        title: "FAQ",
        type: "table",
        rows: service.faq.map((f) => ({ label: f.pitanje, value: f.odgovor })),
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Istaknuto", value: service.istaknuto ? "Da" : "Ne" },
          { label: "Aktivna", value: service.aktivna ? "Da" : "Ne" },
          { label: "Broj terapeuta", value: service.terapeuti.length },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirana", value: service.vreme.kreirana },
          { label: "Ažurirana", value: service.vreme.azurirana },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: service.naziv, url: null },
    ],
  };
}

export function prepareServiceFormData(service = null, { categoryOptions = [], tagOptions = [], employeeOptions = [] } = {}) {
  const isEdit = !!service;

  return {
    formAction: isEdit ? `/admin/usluge/izmena/${service.id}` : "/admin/usluge/dodavanje",
    isEdit,
    backUrl: "/admin/usluge",
    formData: isEdit
      ? service
      : {
          name: "",
          slug: "",
          shortDescription: "",
          longDescription: "",
          categories: [],
          tags: [],
          image: null,
          gallery: [],
          defaultDuration: 60,
          highlight: false,
          ctaText: "Zakaži termin",
          features: [],
          packages: [{ name: "", slug: "", sessions: 1, duration: 60, totalPrice: 0, isActive: true }],
          comparisonColumns: [],
          comparisonTable: [],
          faq: [],
          employees: [],
          isActive: true,
        },
    categoryOptions,
    tagOptions,
    employeeOptions,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: isEdit ? "Izmena" : "Nova usluga", url: null },
    ],
  };
}

export function prepareServiceSeoFormData(service) {
  return {
    formAction: `/admin/usluge/${service.id}/seo`,
    backUrl: `/admin/usluge/detalji/${service.id}`,
    formData: {
      seoKeywords: service.seoKljucneReci || [],
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: service.naziv, url: `/admin/usluge/detalji/${service.id}` },
      { label: "SEO", url: null },
    ],
  };
}