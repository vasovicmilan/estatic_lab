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
            { value: "false", label: "Neaktivne (nacrti)" },
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
        customRows: service.varijante,
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
          { label: "Aktivna", value: service.aktivna ? "Da" : "Ne (nacrt)" },
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

// ---------------------------------------------------------------------------
// Phase 1: core info + image
// ---------------------------------------------------------------------------
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
      };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

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
    { name: "highlight", label: "Istakni ovu uslugu", type: "checkbox", width: 6, value: values.highlight }
  );

  // packages/features/comparison/faq/employees/isActive only show on the single-shot
  // EDIT form now — first-time creation handles those across phases 2 and 3.
  if (isEdit) {
    fields.push(
      {
        name: "packages",
        label: "Varijante usluge",
        type: "repeater",
        width: 12,
        value: values.packages || [],
        addLabel: "Dodaj varijantu",
        help: "Usluga mora imati bar jednu varijantu (paket) za zakazivanje.",
        itemFields: [
          { name: "name", label: "Naziv varijante", type: "text", required: true },
          { name: "duration", label: "Trajanje (min)", type: "number", min: 5, required: true },
          { name: "totalPrice", label: "Cena", type: "number", min: 0, step: "0.01", required: true },
        ],
      },
      {
        name: "features",
        label: "Karakteristike",
        type: "repeater",
        width: 12,
        value: values.features || [],
        addLabel: "Dodaj karakteristiku",
        itemFields: [
          { name: "name", label: "Naziv", type: "text", required: true },
          { name: "description", label: "Opis", type: "textarea" },
        ],
      },
      { name: "comparisonColumnsCsv", label: "Kolone tabele poređenja (odvojene zarezom)", type: "text", width: 12, value: (values.comparisonColumns || []).join(", ") },
      {
        name: "comparisonTable",
        label: "Tabela poređenja",
        type: "comparison-table",
        width: 12,
        value: values.comparisonTable || [],
        columnsFieldName: "comparisonColumnsCsv",
      },
      {
        name: "faq",
        label: "Česta pitanja",
        type: "repeater",
        width: 12,
        value: values.faq || [],
        addLabel: "Dodaj pitanje",
        itemFields: [
          { name: "question", label: "Pitanje", type: "text", required: true },
          { name: "answer", label: "Odgovor", type: "textarea", required: true },
        ],
      },
      {
        name: "employees",
        label: "Zaposleni koji pružaju uslugu",
        type: "multiselect",
        width: 12,
        value: (values.employees || []).map((e) => (typeof e === "object" ? e.id ?? e._id?.toString() : e)),
        options: employeeOptions,
      }
    );
  }

  fields.push(
    {
      name: "serviceImage",
      label: "Glavna slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.image?.url : null,
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.image?.imgDesc || "" }
  );

  if (isEdit) {
    fields.push({ name: "isActive", label: "Aktivna", type: "checkbox", width: 6, value: values.isActive });
  }

  return {
    formAction: isEdit ? `/admin/usluge/${service.id}` : "/admin/usluge/dodavanje",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    phaseInfo: isEdit ? undefined : { label: "Nova usluga", current: 1, total: 3 },
    submitLabel: isEdit ? "Sačuvaj izmene" : "Sačuvaj i nastavi",
    cancelUrl: "/admin/usluge",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: isEdit ? "Izmena" : "Nova usluga", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 2: packages/variants
// ---------------------------------------------------------------------------
export function prepareServicePackagesStepData(service) {
  const fields = [
    {
      name: "packages",
      label: "Varijante usluge",
      type: "repeater",
      width: 12,
      value: service.packages || [],
      addLabel: "Dodaj varijantu",
      help: "Dodajte bar jednu varijantu (paket) — bez ovoga usluga ne može biti objavljena.",
      itemFields: [
        { name: "name", label: "Naziv varijante", type: "text", required: true },
        { name: "duration", label: "Trajanje (min)", type: "number", min: 5, required: true },
        { name: "totalPrice", label: "Cena", type: "number", min: 0, step: "0.01", required: true },
      ],
    },
  ];

  return {
    formAction: `/admin/usluge/${service.id}/dodavanje/paketi`,
    formEnctype: "application/x-www-form-urlencoded",
    formMethod: "POST",
    isEdit: false,
    fields,
    phaseInfo: { label: `Nova usluga — ${service.name}`, current: 2, total: 3 },
    submitLabel: "Sačuvaj i nastavi",
    cancelUrl: `/admin/usluge/detalji/${service.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: service.name, url: null },
      { label: "Varijante", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 3: optional extras + publish
// ---------------------------------------------------------------------------
export function prepareServiceExtrasStepData(service, { employeeOptions = [] } = {}) {
  const fields = [
    {
      name: "features",
      label: "Karakteristike",
      type: "repeater",
      width: 12,
      value: service.features || [],
      addLabel: "Dodaj karakteristiku",
      itemFields: [
        { name: "name", label: "Naziv", type: "text", required: true },
        { name: "description", label: "Opis", type: "textarea" },
      ],
    },
    { name: "comparisonColumnsCsv", label: "Kolone tabele poređenja (odvojene zarezom)", type: "text", width: 12, value: (service.comparisonColumns || []).join(", ") },
    {
      name: "comparisonTable",
      label: "Tabela poređenja",
      type: "comparison-table",
      width: 12,
      value: service.comparisonTable || [],
      columnsFieldName: "comparisonColumnsCsv",
    },
    {
      name: "faq",
      label: "Česta pitanja",
      type: "repeater",
      width: 12,
      value: service.faq || [],
      addLabel: "Dodaj pitanje",
      itemFields: [
        { name: "question", label: "Pitanje", type: "text", required: true },
        { name: "answer", label: "Odgovor", type: "textarea", required: true },
      ],
    },
    {
      name: "employees",
      label: "Zaposleni koji pružaju uslugu",
      type: "multiselect",
      width: 12,
      value: (service.employees || []).map((e) => (typeof e === "object" ? e.id ?? e._id?.toString() : e)),
      options: employeeOptions,
    },
    { name: "highlight", label: "Istakni ovu uslugu", type: "checkbox", width: 6, value: service.highlight },
    {
      name: "isActive",
      label: "Objavi uslugu odmah",
      type: "checkbox",
      width: 6,
      value: true,
      help: "Ostavite neoznačeno da sačuvate kao nacrt i objavite kasnije iz izmene usluge.",
    },
  ];

  return {
    formAction: `/admin/usluge/${service.id}/dodavanje/detalji`,
    formEnctype: "application/x-www-form-urlencoded",
    formMethod: "POST",
    isEdit: false,
    fields,
    phaseInfo: { label: `Nova usluga — ${service.name}`, current: 3, total: 3 },
    submitLabel: "Sačuvaj",
    cancelUrl: `/admin/usluge/detalji/${service.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Usluge", url: "/admin/usluge" },
      { label: service.name, url: null },
      { label: "Detalji i objava", url: null },
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

export default {
  prepareServiceListData,
  prepareServiceDetailsData,
  prepareServiceFormData,
  prepareServicePackagesStepData,
  prepareServiceExtrasStepData,
  prepareServiceSeoFormData,
};