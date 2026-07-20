export function preparePartnerListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "procenatProvizije", label: "Procenat provizije" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/partneri/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/partneri/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/partneri/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/partneri",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: null },
    ],
    topbar: {
      createUrl: "/admin/partneri/dodavanje",
      createLabel: "Novi partner",
      searchUrl: "/admin/partneri/pretraga",
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

export function preparePartnerDetailsData(partner) {
  return {
    backUrl: "/admin/partneri",
    editUrl: `/admin/partneri/izmena/${partner.id}`,
    sections: [
      {
        title: "Podaci o korisniku",
        type: "table",
        rows: [
          { label: "Ime i prezime", value: partner.korisnik.imePrezime },
          { label: "Email", value: partner.korisnik.email },
          { label: "Telefon", value: partner.korisnik.telefon || "-" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Procenat provizije", value: partner.procenatProvizije },
          { label: "Aktivan", value: partner.aktivan },
          { label: "Napomena", value: partner.napomena || "-" },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: partner.vreme.kreiran },
          { label: "Ažuriran", value: partner.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: "/admin/partneri" },
      { label: partner.korisnik.imePrezime, url: null },
    ],
  };
}

export function preparePartnerFormData(partner = null, { userOptions = [] } = {}) {
  const isEdit = !!partner;
  const values = isEdit ? partner : { userId: "", commissionRate: "", isActive: true, notes: "" };

  const fields = [];

  if (!isEdit) {
    fields.push({
      name: "userId",
      label: "Korisnik",
      type: "select",
      required: true,
      width: 12,
      value: values.userId,
      options: userOptions,
      help: "Postojeći korisnički nalog koji se promoviše u partnera.",
    });
  }

  fields.push(
    {
      name: "commissionRate",
      label: "Procenat provizije",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      step: "0.01",
      width: 6,
      value: values.commissionRate,
      help: "Procenat od diskontovane vrednosti prodaje koji partner dobija kao proviziju.",
    },
    { name: "notes", label: "Napomena", type: "textarea", rows: 3, width: 12, value: values.notes, help: "Najviše 500 karaktera." },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/partneri/${partner.id}` : "/admin/partneri",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj profil partnera",
    cancelUrl: "/admin/partneri",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: "/admin/partneri" },
      { label: isEdit ? "Izmena" : "Novi partner", url: null },
    ],
  };
}