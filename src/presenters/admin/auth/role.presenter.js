import { RESERVED_ROLE_NAMES } from "../../../models/role.model.js";

export function prepareRoleListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "opis", label: "Opis" },
      { key: "brojPermisija", label: "Broj permisija" },
      { key: "podrazumevana", label: "Podrazumevana" },
      { key: "prioritet", label: "Prioritet" },
      { key: "kreirana", label: "Kreirana" },
    ],
    actions: [
      { type: "view", url: "/admin/role/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/role/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/role/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/role",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Role", url: null },
    ],
    topbar: {
      createUrl: "/admin/role/dodavanje",
      createLabel: "Nova rola",
      searchUrl: "/admin/role/pretraga",
      search: query.search || "",
    },
  };
}

export function prepareRoleDetailsData(role) {
  return {
    backUrl: "/admin/role",
    editUrl: `/admin/role/izmena/${role.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: role.osnovno.naziv },
          { label: "Opis", value: role.osnovno.opis || "-" },
          { label: "Podrazumevana", value: role.osnovno.podrazumevana ? "Da" : "Ne" },
          { label: "Prioritet", value: role.osnovno.prioritet },
        ],
      },
      {
        title: "Permisije",
        type: "list",
        items: role.permisije.map((p) => p.naziv),
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: role.vreme.kreirano },
          { label: "Ažurirano", value: role.vreme.azurirano },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Role", url: "/admin/role" },
      { label: role.osnovno.naziv, url: null },
    ],
  };
}

export function prepareRoleFormData(role = null, availablePermissions = []) {
  const isEdit = !!role;
  const values = isEdit ? role : { name: "", description: "", permissions: [], isDefault: false, priority: 0 };
  const isReserved = isEdit && RESERVED_ROLE_NAMES.includes(values.name);

  return {
    formAction: isEdit ? `/admin/role/${role.id}` : "/admin/role",
    isEdit,
    fields: [
      {
        name: "name",
        label: "Naziv role",
        type: "text",
        required: true,
        width: 6,
        value: values.name,
        disabled: isReserved,
        help: isReserved
          ? `"${values.name}" je rezervisan naziv i ne može biti promenjen — koristi se po nazivu na više mesta u sistemu.`
          : "Malim slovima — brojevi, crtice i donje crte su dozvoljeni (2-32 karaktera), npr. \"seo\" ili \"blog-urednik\".",
      },
      { name: "priority", label: "Prioritet", type: "number", min: 0, width: 6, value: values.priority },
      { name: "description", label: "Opis", type: "textarea", rows: 3, width: 12, value: values.description, help: "Najviše 300 karaktera." },
      {
        name: "permissions",
        label: "Permisije",
        type: "checkbox-group",
        width: 12,
        value: (values.permissions || []).map((p) => (typeof p === "object" ? p.value : p)),
        options: availablePermissions,
        help: "\"Pristup admin panelu\" je obavezan da bi rola uopšte mogla da uđe u /admin — bez njega, ni jedna od ostalih permisija ovde neće imati efekta.",
      },
      { name: "isDefault", label: "Podrazumevana rola za nove korisnike", type: "checkbox", width: 6, value: values.isDefault },
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj rolu",
    cancelUrl: "/admin/role",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Role", url: "/admin/role" },
      { label: isEdit ? "Izmena" : "Nova rola", url: null },
    ],
  };
}