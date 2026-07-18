import { CATEGORY_DOMAINS } from "../../../models/category.model.js";

const DOMAIN_LABELS = {
  post: "Blog",
  service: "Usluga",
  product: "Proizvod",
};

function getDomainOptions() {
  return CATEGORY_DOMAINS.map((domain) => ({ value: domain, label: DOMAIN_LABELS[domain] || domain }));
}

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
          options: [{ value: "", label: "Svi domeni" }, ...getDomainOptions()],
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
  const values = isEdit ? tag : { name: "", domain: "service", isActive: true };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

  // slug simply doesn't exist in the array on create - createTag() already
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
      help: "Menjajte pažljivo - postojeći linkovi mogu prestati da rade.",
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
      options: getDomainOptions(),
    },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/tagovi/${tag.id}` : "/admin/tagovi",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj tag",
    cancelUrl: "/admin/tagovi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tagovi", url: "/admin/tagovi" },
      { label: isEdit ? "Izmena" : "Novi tag", url: null },
    ],
  };
}