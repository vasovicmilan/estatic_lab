export function prepareTagListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "slug", label: "Slug" },
      { key: "domen", label: "Domen" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/tagovi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/tagovi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/tagovi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/tagovi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tagovi", url: null },
    ],
    topbar: {
      createUrl: "/admin/tagovi/dodavanje",
      createLabel: "Novi tag",
      searchUrl: "/admin/tagovi/pretraga",
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

export function prepareTagDetailsData(tag) {
  return {
    backUrl: "/admin/tagovi",
    editUrl: `/admin/tagovi/izmena/${tag.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: tag.naziv },
          { label: "Slug", value: tag.slug },
          { label: "Domen", value: tag.domen },
          { label: "Aktivan", value: tag.aktivan ? "Da" : "Ne" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: tag.vreme.kreiran },
          { label: "Ažuriran", value: tag.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tagovi", url: "/admin/tagovi" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareTagFormData(tag = null) {
  const isEdit = !!tag;

  return {
    formAction: isEdit ? `/admin/tagovi/izmena/${tag.id}` : "/admin/tagovi/dodavanje",
    isEdit,
    backUrl: "/admin/tagovi",
    formData: isEdit ? tag : { name: "", slug: "", domain: "service", isActive: true },
    domains: [
      { value: "post", label: "Blog" },
      { value: "service", label: "Usluga" },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tagovi", url: "/admin/tagovi" },
      { label: isEdit ? "Izmena" : "Novi tag", url: null },
    ],
  };
}