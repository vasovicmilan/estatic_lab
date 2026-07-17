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
  const values = isEdit
    ? expert
    : {
        firstName: "",
        lastName: "",
        title: "",
        shortBio: "",
        bio: "",
        specializations: [],
        services: [],
        socialLinks: { instagram: "", facebook: "", linkedin: "", website: "" },
        isActive: true,
        order: 0,
      };

  const fields = [
    { name: "firstName", label: "Ime", type: "text", required: true, width: 6, value: values.firstName },
    { name: "lastName", label: "Prezime", type: "text", required: true, width: 6, value: values.lastName },
  ];

  // slug simply doesn't exist in the array on create - createExpert() already
  // auto-generates one from the name when it's omitted. Shown on edit so an admin can
  // deliberately change it.
  if (isEdit) {
    fields.push({
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      width: 6,
      value: values.slug,
      help: "Menjajte pažljivo - postojeći linkovi ka ovom ekspertu mogu prestati da rade.",
    });
  }

  fields.push(
    { name: "title", label: "Titula", type: "text", width: 6, value: values.title, placeholder: "npr. Senior terapeut" },
    { name: "shortBio", label: "Kratka biografija", type: "textarea", rows: 2, width: 12, value: values.shortBio, help: "Najviše 300 karaktera." },
    { name: "bio", label: "Biografija", type: "textarea", rows: 5, width: 12, value: values.bio },
    {
      name: "services",
      label: "Usluge",
      type: "multiselect",
      width: 12,
      value: (values.services || []).map((s) => (typeof s === "object" ? s.id ?? s._id?.toString() : s)),
      options: serviceOptions,
    },
    {
      name: "specializationsCsv",
      label: "Specijalizacije (odvojene zarezom)",
      type: "text",
      width: 12,
      value: (values.specializations || []).join(", "),
    },
    { name: "socialLinks[instagram]", label: "Instagram", type: "url", width: 6, value: values.socialLinks?.instagram || "" },
    { name: "socialLinks[facebook]", label: "Facebook", type: "url", width: 6, value: values.socialLinks?.facebook || "" },
    { name: "socialLinks[linkedin]", label: "LinkedIn", type: "url", width: 6, value: values.socialLinks?.linkedin || "" },
    { name: "socialLinks[website]", label: "Sajt", type: "url", width: 6, value: values.socialLinks?.website || "" },
    {
      name: "expertImage",
      label: "Profilna slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.image?.url : null,
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.image?.imgDesc || "" },
    { name: "order", label: "Redosled prikaza", type: "number", min: 0, width: 6, value: values.order },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/eksperti/${expert.id}` : "/admin/eksperti",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj eksperta",
    cancelUrl: "/admin/eksperti",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Eksperti", url: "/admin/eksperti" },
      { label: isEdit ? "Izmena" : "Novi ekspert", url: null },
    ],
  };
}