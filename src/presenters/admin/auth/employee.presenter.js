export function prepareEmployeeListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "brojUsluga", label: "Broj usluga" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/zaposleni/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/zaposleni/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/zaposleni/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/zaposleni",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Zaposleni", url: null },
    ],
    topbar: {
      createUrl: "/admin/zaposleni/dodavanje",
      createLabel: "Novi zaposleni",
      searchUrl: "/admin/zaposleni/pretraga",
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
            { value: "false", label: "Neaktivni" },
          ],
        },
      ],
    },
  };
}

export function prepareEmployeeDetailsData(employee) {
  return {
    backUrl: "/admin/zaposleni",
    editUrl: `/admin/zaposleni/izmena/${employee.id}`,
    sections: [
      {
        title: "Podaci o korisniku",
        type: "table",
        rows: [
          { label: "Ime i prezime", value: employee.korisnik.imePrezime },
          { label: "Email", value: employee.korisnik.email },
          { label: "Telefon", value: employee.korisnik.telefon || "-" },
          { label: "Povezan ekspert profil", value: employee.povezaniEkspert?.imePrezime || "Nije povezan" },
        ],
      },
      {
        title: "Usluge",
        type: "list",
        items: employee.usluge,
      },
      {
        title: "Radno vreme",
        type: "table",
        rows: employee.radnoVreme.map((wh) => ({ label: wh.dan, value: wh.termini.join(", ") || "Neradni dan" })),
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Aktivan", value: employee.aktivan },
          { label: "Napomena", value: employee.napomena || "-" },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: employee.vreme.kreiran },
          { label: "Ažuriran", value: employee.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Zaposleni", url: "/admin/zaposleni" },
      { label: employee.korisnik.imePrezime, url: null },
    ],
  };
}

export function prepareEmployeeFormData(employee = null, { userOptions = [], serviceOptions = [], expertOptions = [] } = {}) {
  const isEdit = !!employee;
  const weekDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return {
    formAction: isEdit ? `/admin/zaposleni/izmena/${employee.id}` : "/admin/zaposleni/dodavanje",
    isEdit,
    formType: "employee",
    backUrl: "/admin/zaposleni",
    formData: isEdit
      ? employee
      : { userId: "", expert: null, services: [], workingHours: [], isActive: true, notes: "" },
    userOptions,
    serviceOptions,
    expertOptions,
    weekDays,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Zaposleni", url: "/admin/zaposleni" },
      { label: isEdit ? "Izmena" : "Novi zaposleni", url: null },
    ],
  };
}
