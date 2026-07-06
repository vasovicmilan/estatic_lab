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
  const values = isEdit
    ? service
    : {
        name: "",
        shortDescription: "",
        longDescription: "",
        categories: [],
        tags: [],
        defaultDuration: 60,
        highlight: false,
        ctaText: "Zakaži termin",
        features: [],
        packages: [{ name: "", sessions: 1, duration: 60, totalPrice: 0, isActive: true }],
        comparisonColumns: [],
        comparisonTable: [],
        faq: [],
        employees: [],
        isActive: true,
      };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

  // slug simply doesn't exist in the array on create — createService() already
  // auto-generates one from the name (and per-variant slugs from each variant's own
  // name) when omitted. Shown on edit so an admin can deliberately change it.
  if (isEdit) {
    fields.push({
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      width: 6,
      value: values.slug,
      help: "Menjajte pažljivo — postojeći linkovi ka ovoj usluzi mogu prestati da rade.",
    });
  }

  fields.push(
    { name: "shortDescription", label: "Kratak opis", type: "textarea", rows: 2, width: 12, value: values.shortDescription, help: "Najviše 300 karaktera." },
    { name: "longDescription", label: "Dugi opis", type: "textarea", rows: 5, width: 12, value: values.longDescription },
    {
      name: "categories",
      label: "Kategorije",
      type: "multiselect",
      width: 6,
      value: (values.categories || []).map((c) => (typeof c === "object" ? c.id ?? c._id?.toString() : c)),
      options: categoryOptions.map((c) => ({ value: c.id, label: c.naziv })),
    },
    {
      name: "tags",
      label: "Tagovi",
      type: "multiselect",
      width: 6,
      value: (values.tags || []).map((t) => (typeof t === "object" ? t.id ?? t._id?.toString() : t)),
      options: tagOptions.map((t) => ({ value: t.id, label: t.naziv })),
    },
    { name: "defaultDuration", label: "Podrazumevano trajanje (min)", type: "number", min: 5, width: 6, value: values.defaultDuration },
    { name: "ctaText", label: "CTA tekst", type: "text", width: 6, value: values.ctaText },
    { name: "highlight", label: "Istakni ovu uslugu", type: "checkbox", width: 6, value: values.highlight },
    // these are repeating/structured widgets (variants, features, comparison table,
    // FAQ) built by the existing dynamic form-builder JS — hidden fields just seed
    // the widget with the current value
    { name: "packages", label: "Varijante usluge", type: "hidden", width: 12, value: JSON.stringify(values.packages || []) },
    { name: "features", label: "Karakteristike", type: "hidden", width: 12, value: JSON.stringify(values.features || []) },
    { name: "comparisonColumnsCsv", label: "Kolone tabele poređenja (odvojene zarezom)", type: "text", width: 12, value: (values.comparisonColumns || []).join(", ") },
    { name: "comparisonTable", label: "Tabela poređenja", type: "hidden", width: 12, value: JSON.stringify(values.comparisonTable || []) },
    { name: "faq", label: "Česta pitanja", type: "hidden", width: 12, value: JSON.stringify(values.faq || []) },
    {
      name: "employees",
      label: "Zaposleni koji pružaju uslugu",
      type: "multiselect",
      width: 12,
      value: (values.employees || []).map((e) => (typeof e === "object" ? e.id ?? e._id?.toString() : e)),
      options: employeeOptions,
    },
    {
      name: "serviceImage",
      label: "Glavna slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.image?.url : null,
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.image?.imgDesc || "" },
    { name: "isActive", label: "Aktivna", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/usluge/${service.id}` : "/admin/usluge",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj uslugu",
    cancelUrl: "/admin/usluge",
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
    isEdit: true,
    fields: [
      {
        name: "seoKeywordsCsv",
        label: "Ključne reči (odvojene zarezom)",
        type: "text",
        width: 12,
        value: (service.seoKljucneReci || []).join(", "),
      },
    ],
    submitLabel: "Sačuvaj SEO podatke",
    cancelUrl: `/admin/usluge/detalji/${service.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: service.naziv, url: `/admin/usluge/detalji/${service.id}` },
      { label: "SEO", url: null },
    ],
  };
}