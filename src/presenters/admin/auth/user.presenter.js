export function prepareUserListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "telefon", label: "Telefon" },
      { key: "uloga", label: "Uloga" },
      { key: "status", label: "Status" },
      { key: "poslednjiLogin", label: "Poslednji login" },
      { key: "registrovan", label: "Registrovan" },
    ],
    actions: [
      { type: "view", url: "/admin/korisnici/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/korisnici/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/korisnici/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/korisnici",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Korisnici", url: null },
    ],
    topbar: {
      searchUrl: "/admin/korisnici/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi statusi" },
            { value: "guest", label: "Gost" },
            { value: "pending", label: "Na čekanju potvrde" },
            { value: "active", label: "Aktivan" },
            { value: "inactive", label: "Neaktivan" },
            { value: "suspended", label: "Suspendovan" },
          ],
        },
      ],
    },
  };
}

export function prepareUserDetailsData(user, roleOptions = []) {
  return {
    backUrl: "/admin/korisnici",
    editUrl: `/admin/korisnici/izmena/${user.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Ime i prezime", value: user.imePrezime },
          { label: "Email", value: user.email },
          { label: "Telefon", value: user.telefon || "-" },
          { label: "Uloga", value: user.uloga },
          { label: "Način prijave", value: user.nacinPrijave },
          { label: "Status", value: user.status },
          { label: "Email potvrđen", value: user.potvrdjenEmail },
        ],
      },
    ],
    sidebar: [
      {
        title: "Izmena uloge/statusa",
        type: "custom",
        content: "user-actions",
        data: {
          roleFormAction: `/admin/korisnici/${user.id}/rola`,
          statusFormAction: `/admin/korisnici/${user.id}/status`,
          verifyFormAction: `/admin/korisnici/${user.id}/verifikuj`,
          currentRoleId: user.roleId,
          roleOptions,
          currentStatus: user.statusRaw,
          statuses: [
            { value: "active", label: "Aktivan" },
            { value: "inactive", label: "Neaktivan" },
            { value: "suspended", label: "Suspendovan" },
          ],
          showVerifyAction: user.statusRaw === "pending",
        },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Poslednji login", value: user.poslednjiLogin || "Nikada" },
          { label: "Registrovan", value: user.vreme.registrovan },
          { label: "Ažuriran", value: user.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Korisnici", url: "/admin/korisnici" },
      { label: user.imePrezime, url: null },
    ],
  };
}
