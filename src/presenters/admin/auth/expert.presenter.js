export function prepareExpertListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "titula", label: "Titula" },
      { key: "brojUsluga", label: "Broj usluga" },
      { key: "aktivan", label: "Aktivan" },
      { key: "redosled", label: "Redosled" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/eksperti/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/eksperti/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/eksperti/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/eksperti",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Eksperti", url: null },
    ],
    topbar: {
      createUrl: "/admin/eksperti/dodavanje",
      createLabel: "Novi ekspert",
      searchUrl: "/admin/eksperti/pretraga",
      search: query.search || "",
    },
  };
}

export function prepareExpertDetailsData(expert) {
  return {
    backUrl: "/admin/eksperti",
    editUrl: `/admin/eksperti/izmena/${expert.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Ime", value: expert.osnovno.ime },
          { label: "Prezime", value: expert.osnovno.prezime },
          { label: "Slug", value: expert.osnovno.slug },
          { label: "Titula", value: expert.osnovno.titula || "-" },
          { label: "Kratka biografija", value: expert.osnovno.kratkaBiografija || "-" },
        ],
      },
      {
        title: "Slika",
        type: "table",
        rows: [
          {
            label: "Profilna slika",
            value: expert.slika ? `<img src="${expert.slika.url}" alt="${expert.slika.alt}" width="120">` : "Nema slike",
          },
        ],
      },
      {
        title: "Specijalizacije i usluge",
        type: "list",
        items: [...expert.specijalizacije, ...expert.usluge],
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Aktivan", value: expert.aktivan ? "Da" : "Ne" },
          { label: "Redosled prikaza", value: expert.redosled },
        ],
      },
      {
        title: "Društvene mreže",
        type: "table",
        rows: Object.entries(expert.drustveneMreze || {}).map(([key, value]) => ({ label: key, value: value || "-" })),
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: expert.vreme.kreirano },
          { label: "Ažurirano", value: expert.vreme.azurirano },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Eksperti", url: "/admin/eksperti" },
      { label: `${expert.osnovno.ime} ${expert.osnovno.prezime}`, url: null },
    ],
  };
}

export function prepareExpertFormData(expert = null, { serviceOptions = [] } = {}) {
  const isEdit = !!expert;

  return {
    formAction: isEdit ? `/admin/eksperti/izmena/${expert.id}` : "/admin/eksperti/dodavanje",
    isEdit,
    backUrl: "/admin/eksperti",
    formData: isEdit
      ? expert
      : {
          firstName: "",
          lastName: "",
          slug: "",
          title: "",
          shortBio: "",
          bio: "",
          image: null,
          gallery: [],
          specializations: [],
          services: [],
          socialLinks: { instagram: "", facebook: "", linkedin: "", website: "" },
          isActive: true,
          order: 0,
        },
    serviceOptions,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Eksperti", url: "/admin/eksperti" },
      { label: isEdit ? "Izmena" : "Novi ekspert", url: null },
    ],
  };
}