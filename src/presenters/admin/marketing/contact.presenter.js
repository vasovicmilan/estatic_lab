export function prepareContactListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "tema", label: "Tema" },
      { key: "status", label: "Status" },
      { key: "datum", label: "Datum" },
    ],
    actions: [{ type: "view", url: "/admin/kontakt/detalji/", icon: "eye" }],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/kontakt",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kontakt poruke", url: null },
    ],
    topbar: {
      searchUrl: "/admin/kontakt/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi statusi" },
            { value: "new", label: "Novi" },
            { value: "read", label: "Pročitan" },
            { value: "replied", label: "Odgovoren" },
            { value: "archived", label: "Arhiviran" },
          ],
        },
      ],
    },
  };
}

export function prepareContactDetailsData(contact) {
  return {
    backUrl: "/admin/kontakt",
    sections: [
      {
        title: "Pošiljalac",
        type: "table",
        rows: [
          { label: "Ime", value: contact.osnovno.ime },
          { label: "Prezime", value: contact.osnovno.prezime },
          { label: "Email", value: contact.osnovno.email },
          { label: "Telefon", value: contact.osnovno.telefon || "-" },
          { label: "Tema", value: contact.osnovno.tema || "-" },
        ],
      },
      {
        title: "Poruka",
        type: "table",
        rows: [{ label: "Sadržaj", value: contact.poruka }],
      },
    ],
    sidebar: [
      ...(contact.referalniKod
        ? [
            {
              title: "Referalni kod",
              type: "table",
              rows: [
                { label: "Kod", value: contact.referalniKod },
                { label: "Napomena", value: "Ovaj upit je stigao preko partnerskog referalnog linka. Koristite ovaj kod kada budete kreirali kupovinu paketa za ovog korisnika." },
              ],
            },
          ]
        : []),
      {
        title: "Status",
        type: "custom",
        content: "status-select-form",
        data: {
          formAction: `/admin/kontakt/${contact.id}/status`,
          currentStatus: contact.osnovno.statusRaw,
          options: [
            { value: "read", label: "Pročitan" },
            { value: "replied", label: "Odgovoren" },
            { value: "archived", label: "Arhiviran" },
          ],
        },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: contact.vreme.kreirano },
          { label: "Ažurirano", value: contact.vreme.azurirano },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kontakt", url: "/admin/kontakt" },
      { label: contact.osnovno.ime, url: null },
    ],
  };
}