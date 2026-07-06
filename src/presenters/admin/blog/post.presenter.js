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
  const values = isEdit ? post : { title: "", excerpt: "", content: [], categories: [], tags: [], author: "", status: "draft", isIndexable: true };

  const fields = [{ name: "title", label: "Naslov", type: "text", required: true, width: isEdit ? 6 : 12, value: values.title }];

  // slug simply doesn't exist in the array on create — createPost() already
  // auto-generates one from the title when it's omitted. Shown on edit so an admin
  // can deliberately change it.
  if (isEdit) {
    fields.push({
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      width: 6,
      value: values.slug,
      help: "Menjajte pažljivo — postojeći linkovi ka ovom postu mogu prestati da rade.",
    });
  }

  fields.push(
    { name: "excerpt", label: "Kratak opis", type: "textarea", rows: 2, required: true, width: 12, value: values.excerpt, help: "Najviše 300 karaktera." },
    // structured post body built by the existing dynamic form-builder widget (see
    // blockTypes below, used by that widget) — hidden field just seeds the current value
    { name: "content", label: "Sadržaj", type: "hidden", width: 12, value: JSON.stringify(values.content || []) },
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
      name: "author",
      label: "Autor",
      type: "select",
      width: 6,
      value: typeof values.author === "object" ? values.author?.id ?? values.author?._id?.toString() : values.author,
      options: authorOptions,
      help: "Ostavite prazno da bi ste automatski bili postavljeni kao autor.",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      width: 6,
      value: values.status,
      options: [
        { value: "draft", label: "Nacrt" },
        { value: "published", label: "Objavljeno" },
        { value: "archived", label: "Arhivirano" },
      ],
    },
    {
      name: "coverImage",
      label: "Naslovna slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.coverImage?.url : null,
    },
    { name: "coverImageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.coverImage?.imgDesc || "" },
    { name: "isIndexable", label: "Dozvoli indeksiranje (SEO)", type: "checkbox", width: 6, value: values.isIndexable }
  );

  return {
    formAction: isEdit ? `/admin/blog/${post.id}` : "/admin/blog",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    blockTypes: ["paragraph", "heading", "image", "quote", "list", "video"], // used by the content-block widget
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj post",
    cancelUrl: "/admin/blog",
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
    isEdit: true,
    fields: [
      { name: "seoTitle", label: "SEO naslov", type: "text", width: 12, value: post.seo?.naslov || "", help: "Najviše 70 karaktera." },
      { name: "seoDescription", label: "SEO opis", type: "textarea", rows: 3, width: 12, value: post.seo?.opis || "", help: "Najviše 160 karaktera." },
      { name: "isIndexable", label: "Dozvoli indeksiranje (SEO)", type: "checkbox", width: 6, value: post.indeksiranje === "Dozvoljeno" },
    ],
    submitLabel: "Sačuvaj SEO podatke",
    cancelUrl: `/admin/blog/detalji/${post.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Blog", url: "/admin/blog" },
      { label: post.naslov, url: `/admin/blog/detalji/${post.id}` },
      { label: "SEO", url: null },
    ],
  };
}