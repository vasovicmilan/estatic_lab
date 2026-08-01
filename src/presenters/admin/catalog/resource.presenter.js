export function prepareResourceListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "kapacitet", label: "Kapacitet" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/resursi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/resursi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/resursi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/resursi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Resursi", url: null },
    ],
    topbar: {
      createUrl: "/admin/resursi/dodavanje",
      createLabel: "Novi resurs",
      searchUrl: "/admin/resursi/pretraga",
      search: query.search || "",
      filters: [],
    },
  };
}

export function prepareResourceDetailsData(resource) {
  return {
    backUrl: "/admin/resursi",
    editUrl: `/admin/resursi/izmena/${resource.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: resource.naziv },
          { label: "Kapacitet (broj istovremenih termina)", value: resource.kapacitet },
          { label: "Aktivan", value: resource.aktivan ? "Da" : "Ne" },
          { label: "Napomena", value: resource.napomena || "-" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: resource.vreme.kreiran },
          { label: "Ažuriran", value: resource.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Resursi", url: "/admin/resursi" },
      { label: resource.naziv, url: null },
    ],
  };
}

export function prepareResourceFormData(resource = null) {
  const isEdit = !!resource;
  const values = isEdit ? resource : { name: "", capacity: 1, isActive: true, notes: "" };

  const fields = [
    { name: "name", label: "Naziv", type: "text", required: true, width: 8, value: values.name, help: "Npr. \"Sto za masažu\", \"ESMA aparat\"." },
    {
      name: "capacity",
      label: "Kapacitet",
      type: "number",
      min: 1,
      required: true,
      width: 4,
      value: values.capacity,
      help: "Koliko termina istovremeno može da koristi ovaj resurs (broj identičnih stolova/aparata). Danas je to obično 1.",
    },
    { name: "notes", label: "Napomena", type: "textarea", rows: 2, width: 12, value: values.notes },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive, help: "Neaktivan resurs se tretira kao da ima kapacitet 0 - nijedan termin ga neće moći koristiti." },
  ];

  return {
    formAction: isEdit ? `/admin/resursi/${resource.id}` : "/admin/resursi",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj resurs",
    cancelUrl: "/admin/resursi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Resursi", url: "/admin/resursi" },
      { label: isEdit ? "Izmena" : "Novi resurs", url: null },
    ],
  };
}

export default { prepareResourceListData, prepareResourceDetailsData, prepareResourceFormData };