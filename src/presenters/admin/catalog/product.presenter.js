import { BLOG_BLOCK_TYPES } from "../../../models/schemas/content.blog.schema.js";

export function prepareProductListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "slika", label: "Slika", type: "image" },
      { key: "naziv", label: "Naziv" },
      { key: "sku", label: "SKU" },
      { key: "kategorije", label: "Kategorije" },
      { key: "cena", label: "Cena" },
      { key: "stanje", label: "Zalihe" },
      { key: "oznaka", label: "Oznaka" },
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
        title: "Duži opis",
        type: "blocks",
        blocks: product.dugiOpis,
      },
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
      ...(product.povezaneUsluge?.length
        ? [
            {
              title: "Koristi se u terapijama",
              type: "list",
              items: product.povezaneUsluge.map((s) => s.naziv),
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
          { label: "Oznaka", value: product.oznaka || "Bez oznake" },
          { label: "Način dostave", value: product.nacinDostave },
          { label: "Cena na upit", value: product.naUpit ? "Da" : "Ne" },
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
// Phase 1: bare minimum - just enough to get a row in the DB. No description,
// image, or categories here on purpose - those move to phase 2.
// ---------------------------------------------------------------------------
export function prepareProductCreateStep1Data() {
  return {
    formAction: "/admin/proizvodi/dodavanje",
    formEnctype: "application/x-www-form-urlencoded",
    isEdit: false,
    fields: [
      { name: "name", label: "Naziv", type: "text", required: true, width: 6, value: "" },
      { name: "sku", label: "SKU (šifra proizvoda)", type: "text", required: true, width: 6, value: "", help: "Jedinstvena šifra - model/kataloški broj." },
    ],
    phaseInfo: { label: "Novi proizvod", current: 1, total: 3 },
    submitLabel: "Sačuvaj i nastavi",
    cancelUrl: "/admin/proizvodi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: "Novi proizvod", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Single-shot edit form (post-creation) - keeps everything in one place, unlike
// the phased creation flow. Kept separate from phase 1 above since their shape
// diverged once phase 1 got trimmed down.
// ---------------------------------------------------------------------------
export function prepareProductFormData(product, { categoryOptions = [], tagOptions = [], productOptions = [], serviceOptions = [], postOptions = [] } = {}) {
  const values = product;

  const fields = [
    { name: "name", label: "Naziv", type: "text", required: true, width: 6, value: values.name },
    { name: "sku", label: "SKU (šifra proizvoda)", type: "text", required: true, width: 6, value: values.sku, help: "Jedinstvena šifra - model/kataloški broj." },
    { name: "shortDescription", label: "Kratak opis", type: "textarea", rows: 2, width: 12, value: values.shortDescription, help: "Najviše 300 karaktera." },
    { name: "longDescription", label: "Dugi opis", type: "content-blocks", width: 12, value: values.longDescription || [], blockTypes: BLOG_BLOCK_TYPES },
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
    {
      name: "variations",
      label: "Varijante",
      type: "repeater",
      width: 12,
      value: values.variations || [],
      addLabel: "Dodaj varijantu",
      help: "Proizvod mora imati bar jednu varijantu da bi ostao objavljen.",
      itemFields: [
        { name: "label", label: "Naziv varijante", type: "text", required: true },
        { name: "sku", label: "SKU varijante (opciono)", type: "text" },
        { name: "price", label: "Cena", type: "number", min: 0, step: "0.01", required: true },
        { name: "stock", label: "Zalihe", type: "number", min: 0, required: true },
        { name: "lowStockThreshold", label: "Prag niskog stanja", type: "number", min: 0 },
      ],
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
      name: "relatedProducts",
      label: "Povezani proizvodi",
      type: "multiselect",
      width: 6,
      value: (values.relatedProducts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
      options: productOptions.map((p) => ({ value: p.id, label: p.naziv })),
    },
    {
      name: "relatedServices",
      label: "Koristi se u terapijama",
      type: "multiselect",
      width: 6,
      value: (values.relatedServices || []).map((s) => (typeof s === "object" ? s.id ?? s._id?.toString() : s)),
      options: serviceOptions.map((s) => ({ value: s.id, label: s.naziv })),
      help: "Terapije u kojima se ovaj proizvod koristi ili preporučuje - prikazuje se na stranici proizvoda i na stranici svake izabrane terapije.",
    },
    {
      name: "relatedPosts",
      label: "Povezani blog postovi",
      type: "multiselect",
      width: 12,
      value: (values.relatedPosts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
      options: postOptions.map((p) => ({ value: p.id, label: p.naslov })),
      help: "Postovi koji pominju ili preporučuju ovaj proizvod - prikazuje se u sekciji 'Iz našeg bloga' na stranici proizvoda.",
    },
    {
      name: "productImage",
      label: "Glavna slika",
      type: "file",
      accept: "image/*",
      required: false,
      width: 6,
      preview: values.image?.url,
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.image?.imgDesc || "" },
    {
      name: "badge",
      label: "Oznaka",
      type: "select",
      width: 6,
      value: values.badge || "none",
      options: [
        { value: "none", label: "Bez oznake" },
        { value: "featured", label: "Istaknuto" },
        { value: "sale", label: "Na akciji" },
      ],
      help: "Prikazuje se kao značka na kartici proizvoda i određuje da li se proizvod pojavljuje u odgovarajućoj sekciji na naslovnoj strani prodavnice.",
    },
    {
      name: "shippingClass",
      label: "Način dostave",
      type: "select",
      width: 6,
      value: values.shippingClass || "standard",
      options: [
        { value: "standard", label: "Redovna pošta" },
        { value: "freight", label: "Veliki/težak artikal (cena dostave se procenjuje ručno)" },
      ],
      help: "Za velike ili teške uređaje koji se ne mogu poslati redovnom poštom - kupac neće dobiti automatsku cenu dostave, admin je unosi ručno pre potvrde porudžbine.",
    },
    {
      name: "priceOnRequest",
      label: "Cena na upit",
      type: "checkbox",
      width: 6,
      value: values.priceOnRequest,
      help: "Za artikle čiju cenu ne možemo garantovati unapred (npr. jako promenljiv trošak transporta) - umesto cene i dugmeta 'Dodaj u korpu', sajt prikazuje 'Cena na upit' i vezu ka kontakt formi. Prodaja se onda evidentira ručno kroz Porudžbine → Ručno kreiranje, sa cenom koju uneseš u tom trenutku.",
    },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive },
  ];

  return {
    formAction: `/admin/proizvodi/${product.id}`,
    formEnctype: "multipart/form-data",
    isEdit: true,
    fields,
    submitLabel: "Sačuvaj izmene",
    cancelUrl: "/admin/proizvodi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: "Izmena", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 2: variations + content + media - everything needed to actually
// describe and sell the product. Variations are the one thing still required
// (a product can't be published without at least one).
// ---------------------------------------------------------------------------
export function prepareProductDetailsMediaStepData(product, { categoryOptions = [], tagOptions = [] } = {}) {
  const fields = [
    {
      name: "categories",
      label: "Kategorije",
      type: "multiselect",
      width: 6,
      value: (product.categories || []).map((c) => (typeof c === "object" ? c.id ?? c._id?.toString() : c)),
      options: categoryOptions.map((c) => ({ value: c.id, label: c.naziv })),
    },
    {
      name: "tags",
      label: "Tagovi",
      type: "multiselect",
      width: 6,
      value: (product.tags || []).map((t) => (typeof t === "object" ? t.id ?? t._id?.toString() : t)),
      options: tagOptions.map((t) => ({ value: t.id, label: t.naziv })),
    },
    { name: "shortDescription", label: "Kratak opis", type: "textarea", rows: 2, width: 12, value: product.shortDescription || "", help: "Najviše 300 karaktera." },
    { name: "longDescription", label: "Dugi opis", type: "content-blocks", width: 12, value: product.longDescription || [], blockTypes: BLOG_BLOCK_TYPES },
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
    {
      name: "productImage",
      label: "Glavna slika",
      type: "file",
      accept: "image/*",
      required: !product.image,
      width: 6,
      preview: product.image?.url,
      help: "Obavezna da bi proizvod mogao biti objavljen u koraku 3.",
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: !!product.image || undefined, value: product.image?.imgDesc || "" },
  ];

  return {
    formAction: `/admin/proizvodi/${product.id}/dodavanje/detalji`,
    formEnctype: "multipart/form-data",
    isEdit: false,
    fields,
    phaseInfo: { label: `Novi proizvod - ${product.name}`, current: 2, total: 3 },
    submitLabel: "Sačuvaj i nastavi",
    cancelUrl: `/admin/proizvodi/detalji/${product.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Proizvodi", url: "/admin/proizvodi" },
      { label: product.name, url: null },
      { label: "Detalji i medija", url: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 3: SEO + remaining optional bits + publish
// ---------------------------------------------------------------------------
export function prepareProductSeoPublishStepData(product, { productOptions = [], serviceOptions = [], postOptions = [] } = {}) {
  const fields = [
    {
      name: "seoKeywordsCsv",
      label: "Ključne reči (odvojene zarezom)",
      type: "text",
      width: 12,
      value: (product.seoKeywords || []).join(", "),
    },
    {
      name: "relatedProducts",
      label: "Povezani proizvodi",
      type: "multiselect",
      width: 6,
      value: (product.relatedProducts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
      options: productOptions.map((p) => ({ value: p.id, label: p.naziv })),
    },
    {
      name: "relatedServices",
      label: "Koristi se u terapijama",
      type: "multiselect",
      width: 6,
      value: (product.relatedServices || []).map((s) => (typeof s === "object" ? s.id ?? s._id?.toString() : s)),
      options: serviceOptions.map((s) => ({ value: s.id, label: s.naziv })),
      help: "Terapije u kojima se ovaj proizvod koristi ili preporučuje - prikazuje se na stranici proizvoda i na stranici svake izabrane terapije.",
    },
    {
      name: "relatedPosts",
      label: "Povezani blog postovi",
      type: "multiselect",
      width: 12,
      value: (product.relatedPosts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
      options: postOptions.map((p) => ({ value: p.id, label: p.naslov })),
      help: "Postovi koji pominju ili preporučuju ovaj proizvod - prikazuje se u sekciji 'Iz našeg bloga' na stranici proizvoda.",
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
      name: "badge",
      label: "Oznaka",
      type: "select",
      width: 6,
      value: product.badge || "none",
      options: [
        { value: "none", label: "Bez oznake" },
        { value: "featured", label: "Istaknuto" },
        { value: "sale", label: "Na akciji" },
      ],
      help: "Prikazuje se kao značka na kartici proizvoda i određuje da li se proizvod pojavljuje u odgovarajućoj sekciji na naslovnoj strani prodavnice.",
    },
    {
      name: "shippingClass",
      label: "Način dostave",
      type: "select",
      width: 6,
      value: product.shippingClass || "standard",
      options: [
        { value: "standard", label: "Redovna pošta" },
        { value: "freight", label: "Veliki/težak artikal (cena dostave se procenjuje ručno)" },
      ],
      help: "Za velike ili teške uređaje koji se ne mogu poslati redovnom poštom - kupac neće dobiti automatsku cenu dostave, admin je unosi ručno pre potvrde porudžbine.",
    },
    {
      name: "priceOnRequest",
      label: "Cena na upit",
      type: "checkbox",
      width: 6,
      value: false,
      help: "Za artikle čiju cenu ne možemo garantovati unapred (npr. jako promenljiv trošak transporta) - umesto cene i dugmeta 'Dodaj u korpu', sajt prikazuje 'Cena na upit' i vezu ka kontakt formi. Prodaja se onda evidentira ručno kroz Porudžbine → Ručno kreiranje, sa cenom koju uneseš u tom trenutku.",
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
    formAction: `/admin/proizvodi/${product.id}/dodavanje/seo`,
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
      { label: "SEO i objava", url: null },
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
  prepareProductCreateStep1Data,
  prepareProductFormData,
  prepareProductDetailsMediaStepData,
  prepareProductSeoPublishStepData,
  prepareProductSeoFormData,
};