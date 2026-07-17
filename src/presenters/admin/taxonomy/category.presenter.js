import { formatDateTime } from "../../../utils/date.time.util.js";

export function prepareCategoryListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "domen", label: "Domen" },
      { key: "roditelj", label: "Roditelj" },
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
          { label: "Kratak opis", value: category.kratakOpis || "-" },
        ],
      },
      {
        title: "Slika",
        type: "custom",
        content: category.slika ? `<img src="${category.slika.url}" width="120">` : "Nema slike",
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
  const values = isEdit
    ? category
    : { name: "", domain: "service", parent: null, shortDescription: "", longDescription: "", isIndexable: true, priority: 0, isActive: true };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

  // slug simply doesn't exist in the array on create - createCategory() already
  // auto-generates one from the name when it's omitted (see slug.util.js). Shown on
  // edit so an admin can deliberately change it.
  if (isEdit) {
    fields.push({
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      width: 6,
      value: values.slug,
      help: "Menjajte pažljivo - postojeći linkovi ka ovoj kategoriji mogu prestati da rade.",
    });
  }

  fields.push(
    {
      name: "domain",
      label: "Domen",
      type: "select",
      required: true,
      width: 6,
      value: values.domain,
      options: [
        { value: "post", label: "Blog" },
        { value: "service", label: "Usluga" },
      ],
    },
    {
      name: "parent",
      label: "Roditeljska kategorija",
      type: "select",
      width: 6,
      value: values.parent,
      options: parentOptions.map((p) => ({ value: p.id, label: p.naziv })),
    },
    { name: "shortDescription", label: "Kratak opis", type: "textarea", rows: 2, width: 12, value: values.shortDescription, help: "Najviše 300 karaktera." },
    { name: "longDescription", label: "Dugi opis", type: "textarea", rows: 5, width: 12, value: values.longDescription },
    {
      name: "categoryImage",
      label: "Slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.featureImage?.url : null,
    },
    {
      name: "categoryImageDesc",
      label: "Opis slike (alt tekst)",
      type: "text",
      width: 6,
      required: true,
      value: values.featureImage?.alt || "",
    },
    { name: "isIndexable", label: "Dozvoli indeksiranje (SEO)", type: "checkbox", width: 6, value: values.isIndexable },
    { name: "isActive", label: "Aktivna", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/kategorije/${category.id}` : "/admin/kategorije",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj kategoriju",
    cancelUrl: "/admin/kategorije",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kategorije", url: "/admin/kategorije" },
      { label: isEdit ? "Izmena" : "Nova kategorija", url: null },
    ],
  };
}

export default { prepareCategoryListData, prepareCategoryDetailsData, prepareCategoryFormData };