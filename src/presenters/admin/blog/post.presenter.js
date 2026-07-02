export function preparePostListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naslov", label: "Naslov" },
      { key: "status", label: "Status" },
      { key: "autor", label: "Autor" },
      { key: "kategorije", label: "Kategorije" },
      { key: "pregledi", label: "Pregledi" },
      { key: "datumObjave", label: "Objavljeno" },
    ],
    actions: [
      { type: "view", url: "/admin/blog/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/blog/izmena/", icon: "pencil" },
      { type: "custom", url: "/admin/blog/", idKey: "id", subPath: "seo", icon: "search", label: "SEO" },
      { type: "delete", url: "/admin/blog/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/blog",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Blog", url: null },
    ],
    topbar: {
      createUrl: "/admin/blog/dodavanje",
      createLabel: "Novi post",
      searchUrl: "/admin/blog/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi statusi" },
            { value: "draft", label: "Nacrt" },
            { value: "published", label: "Objavljeno" },
            { value: "archived", label: "Arhivirano" },
          ],
        },
      ],
    },
  };
}

export function preparePostDetailsData(post) {
  return {
    backUrl: "/admin/blog",
    editUrl: `/admin/blog/izmena/${post.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naslov", value: post.naslov },
          { label: "Slug", value: post.slug },
          { label: "Status", value: post.status },
          { label: "Autor", value: post.autor.ime },
          { label: "Kratak opis", value: post.kratakOpis },
        ],
      },
      {
        title: "Sadržaj",
        type: "blocks",
        blocks: post.sadrzaj,
      },
    ],
    sidebar: [
      {
        title: "Klasifikacija",
        type: "table",
        rows: [
          { label: "Kategorije", value: post.kategorije.join(", ") || "-" },
          { label: "Tagovi", value: post.tagovi.join(", ") || "-" },
        ],
      },
      {
        title: "SEO",
        type: "table",
        rows: [
          { label: "SEO naslov", value: post.seo.naslov || "-" },
          { label: "SEO opis", value: post.seo.opis || "-" },
          { label: "Indeksiranje", value: post.indeksiranje },
        ],
      },
      {
        title: "Statistika",
        type: "table",
        rows: [
          { label: "Vreme čitanja", value: post.vremeCitanja },
          { label: "Pregledi", value: post.pregledi },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Objavljeno", value: post.datumObjave || "Nije objavljeno" },
          { label: "Kreiran", value: post.vreme.kreiran },
          { label: "Ažuriran", value: post.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Blog", url: "/admin/blog" },
      { label: post.naslov, url: null },
    ],
  };
}

export function preparePostFormData(post = null, { categoryOptions = [], tagOptions = [], authorOptions = [] } = {}) {
  const isEdit = !!post;

  return {
    formAction: isEdit ? `/admin/blog/izmena/${post.id}` : "/admin/blog/dodavanje",
    isEdit,
    backUrl: "/admin/blog",
    formData: isEdit
      ? post
      : {
          title: "",
          slug: "",
          excerpt: "",
          content: [],
          coverImage: null,
          gallery: [],
          categories: [],
          tags: [],
          author: "",
          status: "draft",
          seo: { title: "", description: "", keywords: [] },
          isIndexable: true,
        },
    categoryOptions,
    tagOptions,
    authorOptions,
    statuses: [
      { value: "draft", label: "Nacrt" },
      { value: "published", label: "Objavljeno" },
      { value: "archived", label: "Arhivirano" },
    ],
    blockTypes: ["paragraph", "heading", "image", "quote", "list", "video"],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Blog", url: "/admin/blog" },
      { label: isEdit ? "Izmena" : "Novi post", url: null },
    ],
  };
}

export function preparePostSeoFormData(post) {
  return {
    formAction: `/admin/blog/${post.id}/seo`,
    backUrl: `/admin/blog/detalji/${post.id}`,
    formData: {
      seo: post.seo,
      isIndexable: post.indeksiranje === "Dozvoljeno",
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Blog", url: "/admin/blog" },
      { label: post.naslov, url: `/admin/blog/detalji/${post.id}` },
      { label: "SEO", url: null },
    ],
  };
}