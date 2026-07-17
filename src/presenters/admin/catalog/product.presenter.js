export function prepareProductListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "sku", label: "SKU" },
      { key: "kategorije", label: "Kategorije" },
      { key: "cena", label: "Cena" },
      { key: "stanje", label: "Zalihe" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/proizvodi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/proizvodi/izmena/", icon: "pencil" },
      { type: "custom", url: "/admin/proizvodi/", idKey: "id", subPath: "seo", icon: "search", label: "SEO" },
      { type: "delete", url: "/admin/proizvodi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/proizvodi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: null },
    ],
    topbar: {
      createUrl: "/admin/proizvodi/dodavanje",
      createLabel: "Novi proizvod",
      searchUrl: "/admin/proizvodi/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "isActive",
          label: "Status",
          value: query.isActive || "",
          options: [
            { value: "", label: "Svi" },
            { value: "true", label: "Aktivni" },
            { value: "false", label: "Neaktivni (nacrti)" },
          ],
        },
        {
          type: "select",
          name: "inStock",
          label: "Zalihe",
          value: query.inStock || "",
          options: [
            { value: "", label: "Sve" },
            { value: "true", label: "Na stanju" },
            { value: "false", label: "Bez zaliha" },
          ],
        },
      ],
    },
  };
}

export function prepareProductDetailsData(product) {
  return {
    backUrl: "/admin/proizvodi",
    editUrl: `/admin/proizvodi/izmena/${product.id}`,
    galleryUrl: `/admin/proizvodi/${product.id}/galerija`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: product.naziv },
          { label: "SKU", value: product.sku },
          { label: "Slug", value: product.slug },
          { label: "Kratak opis", value: product.kratakOpis || "-" },
          { label: "Kategorije", value: product.kategorije.join(", ") || "-" },
          { label: "Tagovi", value: product.tagovi.join(", ") || "-" },
        ],
      },
      {
        title: "Slika",
        type: "custom",
        content: product.slika ? `<img src="${product.slika.url}" alt="${product.slika.alt || ""}" width="200" class="img-fluid rounded">` : "Nema slike",
      },
      ...(product.galerija && product.galerija.length > 0
        ? [
            {
              title: "Galerija",
              type: "custom",
              content: product.galerija
                .map((img) => `<img src="${img.url}" alt="${img.alt || ""}" width="120" class="img-fluid rounded me-2 mb-2">`)
                .join(""),
            },
          ]
        : []),
      {
        title: "Varijante",
        type: "variants",
        variants: product.varijante,
      },
      ...(product.povezaniProizvodi?.length
        ? [
            {
              title: "Povezani proizvodi",
              type: "list",
              items: product.povezaniProizvodi.map((p) => p.naziv),
            },
          ]
        : []),
      {
        title: "FAQ",
        type: "table",
        rows: product.faq.map((f) => ({ label: f.pitanje, value: f.odgovor })),
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Aktivan", value: product.aktivan ? "Da" : "Ne (nacrt)" },
          { label: "Ukupno na stanju", value: product.stanjeUkupno },
          { label: "Broj varijanti", value: product.varijante.length },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: product.vreme.kreiran },
          { label: "Ažuriran", value: product.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: product.naziv, url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 1: core info + image
// ---------------------------------------------------------------------------
export function prepareProductFormData(product = null, { categoryOptions = [], tagOptions = [] } = {}) {
  const isEdit = !!product;
  const values = isEdit
    ? product
    : {
        name: "",
        sku: "",
        shortDescription: "",
        longDescription: "",
        categories: [],
        tags: [],
      };

  const fields = [
    { name: "name", label: "Naziv", type: "text", required: true, width: 6, value: values.name },
    { name: "sku", label: "SKU (šifra proizvoda)", type: "text", required: true, width: 6, value: values.sku, help: "Jedinstvena šifra - model/kataloški broj." },
  ];

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
    }
  );

  // relatedProducts/faq/isActive only show on the single-shot EDIT form - first-time
  // creation handles those across phases 2 and 3, same convention as Service.
  if (isEdit) {
    fields.push({
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
    });
  }

  fields.push(
    {
      name: "productImage",
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
    fields.push({ name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive });
  }

  return {
    formAction: isEdit ? `/admin/proizvodi/${product.id}` : "/admin/proizvodi/dodavanje",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    phaseInfo: isEdit ? undefined : { label: "Novi proizvod", current: 1, total: 3 },
    submitLabel: isEdit ? "Sačuvaj izmene" : "Sačuvaj i nastavi",
    cancelUrl: "/admin/proizvodi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: isEdit ? "Izmena" : "Novi proizvod", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 2: variations
// ---------------------------------------------------------------------------
export function prepareProductVariationsStepData(product) {
  const fields = [
    {
      name: "variations",
      label: "Varijante",
      type: "repeater",
      width: 12,
      value: product.variations || [],
      addLabel: "Dodaj varijantu",
      help: "Dodajte bar jednu varijantu - bez ovoga proizvod ne može biti objavljen. Naziv je slobodan tekst (npr. „50ml”, „Glava tip A”).",
      itemFields: [
        { name: "label", label: "Naziv varijante", type: "text", required: true },
        { name: "sku", label: "SKU varijante (opciono)", type: "text" },
        { name: "price", label: "Cena", type: "number", min: 0, step: "0.01", required: true },
        { name: "stock", label: "Zalihe", type: "number", min: 0, required: true },
        { name: "lowStockThreshold", label: "Prag niskog stanja", type: "number", min: 0 },
      ],
    },
  ];

  return {
    formAction: `/admin/proizvodi/${product.id}/dodavanje/varijante`,
    formEnctype: "application/x-www-form-urlencoded",
    formMethod: "POST",
    isEdit: false,
    fields,
    phaseInfo: { label: `Novi proizvod - ${product.name}`, current: 2, total: 3 },
    submitLabel: "Sačuvaj i nastavi",
    cancelUrl: `/admin/proizvodi/detalji/${product.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: product.name, url: null },
      { label: "Varijante", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 3: optional extras + publish
// ---------------------------------------------------------------------------
export function prepareProductExtrasStepData(product, { productOptions = [] } = {}) {
  const fields = [
    {
      name: "relatedProducts",
      label: "Povezani proizvodi",
      type: "multiselect",
      width: 12,
      value: (product.relatedProducts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
      options: productOptions.map((p) => ({ value: p.id, label: p.naziv })),
    },
    {
      name: "faq",
      label: "Česta pitanja",
      type: "repeater",
      width: 12,
      value: product.faq || [],
      addLabel: "Dodaj pitanje",
      itemFields: [
        { name: "question", label: "Pitanje", type: "text", required: true },
        { name: "answer", label: "Odgovor", type: "textarea", required: true },
      ],
    },
    {
      name: "isActive",
      label: "Objavi proizvod odmah",
      type: "checkbox",
      width: 6,
      value: true,
      help: "Ostavite neoznačeno da sačuvate kao nacrt i objavite kasnije iz izmene proizvoda.",
    },
  ];

  return {
    formAction: `/admin/proizvodi/${product.id}/dodavanje/detalji`,
    formEnctype: "application/x-www-form-urlencoded",
    formMethod: "POST",
    isEdit: false,
    fields,
    phaseInfo: { label: `Novi proizvod - ${product.name}`, current: 3, total: 3 },
    submitLabel: "Sačuvaj",
    cancelUrl: `/admin/proizvodi/detalji/${product.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: product.name, url: null },
      { label: "Detalji i objava", url: null },
    ],
  };
}

export function prepareProductSeoFormData(product) {
  return {
    formAction: `/admin/proizvodi/${product.id}/seo`,
    isEdit: true,
    fields: [
      {
        name: "seoKeywordsCsv",
        label: "Ključne reči (odvojene zarezom)",
        type: "text",
        width: 12,
        value: (product.seoKljucneReci || []).join(", "),
      },
    ],
    submitLabel: "Sačuvaj SEO podatke",
    cancelUrl: `/admin/proizvodi/detalji/${product.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: product.naziv, url: `/admin/proizvodi/detalji/${product.id}` },
      { label: "SEO", url: null },
    ],
  };
}

export default {
  prepareProductListData,
  prepareProductDetailsData,
  prepareProductFormData,
  prepareProductVariationsStepData,
  prepareProductExtrasStepData,
  prepareProductSeoFormData,
};