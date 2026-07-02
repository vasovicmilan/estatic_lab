export function prepareCategoryListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "slug", label: "Slug" },
      { key: "domen", label: "Domen" },
      { key: "roditelj", label: "Roditelj" },
      { key: "prioritet", label: "Prioritet" },
      { key: "aktivna", label: "Aktivna" },
      { key: "kreirana", label: "Kreirana" },
    ],
    actions: [
      { type: "view", url: "/admin/kategorije/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/kategorije/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/kategorije/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/kategorije",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kategorije", url: null },
    ],
    topbar: {
      createUrl: "/admin/kategorije/dodavanje",
      createLabel: "Nova kategorija",
      searchUrl: "/admin/kategorije/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "domain",
          label: "Domen",
          value: query.domain || "",
          options: [
            { value: "", label: "Svi domeni" },
            { value: "post", label: "Blog" },
            { value: "service", label: "Usluga" },
          ],
        },
      ],
    },
  };
}

export function prepareCategoryDetailsData(category) {
  return {
    backUrl: "/admin/kategorije",
    editUrl: `/admin/kategorije/izmena/${category.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: category.naziv },
          { label: "Slug", value: category.slug },
          { label: "Domen", value: category.domen },
          { label: "Roditelj", value: category.roditelj?.naziv || "-" },
          { label: "Kratak opis", value: category.kratakOpis || "-" },
        ],
      },
      {
        title: "Slika",
        type: "table",
        rows: [{ label: "Istaknuta slika", value: category.slika?.url ? `<img src="${category.slika.url}" width="120">` : "Nema slike" }],
      },
      {
        title: "Meta podaci",
        type: "table",
        rows: [
          { label: "Indeksiranje", value: category.meta.indeksiranje },
          { label: "Prioritet", value: category.meta.prioritet },
          { label: "Aktivna", value: category.meta.aktivna },
        ],
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: category.vreme.kreirano },
          { label: "Ažurirano", value: category.vreme.azurirano },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kategorije", url: "/admin/kategorije" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareCategoryFormData(category = null, { parentOptions = [] } = {}) {
  const isEdit = !!category;

  return {
    formAction: isEdit ? `/admin/kategorije/izmena/${category.id}` : "/admin/kategorije/dodavanje",
    isEdit,
    backUrl: "/admin/kategorije",
    formData: isEdit
      ? category
      : {
          name: "",
          slug: "",
          domain: "service",
          parent: null,
          shortDescription: "",
          longDescription: "",
          featureImage: null,
          isIndexable: true,
          priority: 0,
          isActive: true,
        },
    parentOptions,
    domains: [
      { value: "post", label: "Blog" },
      { value: "service", label: "Usluga" },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kategorije", url: "/admin/kategorije" },
      { label: isEdit ? "Izmena" : "Nova kategorija", url: null },
    ],
  };
}