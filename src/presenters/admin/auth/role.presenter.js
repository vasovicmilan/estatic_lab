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

  return {
    formAction: isEdit ? `/admin/role/izmena/${role.id}` : "/admin/role/dodavanje",
    isEdit,
    backUrl: "/admin/role",
    formData: isEdit
      ? role
      : { name: "", description: "", permissions: [], isDefault: false, priority: 0 },
    availablePermissions,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Role", url: "/admin/role" },
      { label: isEdit ? "Izmena" : "Nova rola", url: null },
    ],
  };
}