export function preparePackageListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naziv", label: "Naziv" },
      { key: "stavke", label: "Usluge u paketu" },
      { key: "cena", label: "Cena" },
      { key: "najbolji", label: "Najbolji izbor" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/paketi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/paketi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/paketi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/paketi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: null },
    ],
    topbar: {
      createUrl: "/admin/paketi/dodavanje",
      createLabel: "Novi paket",
      searchUrl: "/admin/paketi/pretraga",
      search: query.search || "",
    },
  };
}

export function preparePackageDetailsData(pkg) {
  return {
    backUrl: "/admin/paketi",
    editUrl: `/admin/paketi/izmena/${pkg.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: pkg.naziv },
          { label: "Slug", value: pkg.slug },
          { label: "Kratak opis", value: pkg.kratakOpis || "-" },
          { label: "Opis", value: pkg.opis },
        ],
      },
      {
        title: "Usluge u paketu",
        type: "table",
        rows: pkg.stavke.map((s) => ({ label: s.usluga.naziv, value: `${s.brojSeansi} seansi` })),
      },
      {
        title: "FAQ",
        type: "table",
        rows: pkg.faq.map((f) => ({ label: f.pitanje, value: f.odgovor })),
      },
    ],
    sidebar: [
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Cena", value: `${pkg.cena} RSD` },
          { label: "Stara cena", value: pkg.staraCena ? `${pkg.staraCena} RSD` : "-" },
          { label: "Ukupno trajanje", value: pkg.ukupnoTrajanje || "-" },
          { label: "Oznaka", value: pkg.oznaka || "-" },
          { label: "Najbolji izbor", value: pkg.najbolji ? "Da" : "Ne" },
          { label: "Aktivan", value: pkg.aktivan ? "Da" : "Ne" },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: pkg.vreme.kreiran },
          { label: "Ažuriran", value: pkg.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: "/admin/paketi" },
      { label: pkg.naziv, url: null },
    ],
  };
}

export function preparePackageFormData(pkg = null, { serviceOptions = [], categoryOptions = [], tagOptions = [] } = {}) {
  const isEdit = !!pkg;
  const values = isEdit
    ? pkg
    : {
        name: "",
        description: "",
        shortDescription: "",
        // was [{ service: "", sessions: 1 }] — that placeholder row with an empty
        // service is exactly what was silently getting submitted with nothing to
        // edit it, and is exactly what tripped "Svaka stavka paketa mora imati
        // izabranu uslugu". Starts empty now; the repeater widget below is the
        // only way rows get added, and every row it adds has a real service picker.
        items: [],
        totalPrice: 0,
        basePrice: null,
        totalDuration: null,
        badge: "",
        isBest: false,
        order: 0,
        categories: [],
        tags: [],
        faq: [],
        isActive: true,
      };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

  // slug simply doesn't exist in the array on create — createPackage() already
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
      help: "Menjajte pažljivo — postojeći linkovi ka ovom paketu mogu prestati da rade.",
    });
  }

  fields.push(
    { name: "description", label: "Opis", type: "textarea", rows: 4, required: true, width: 12, value: values.description },
    { name: "shortDescription", label: "Kratak opis", type: "textarea", rows: 2, width: 12, value: values.shortDescription, help: "Najviše 300 karaktera." },
    {
      name: "items",
      label: "Usluge u paketu",
      type: "repeater",
      width: 12,
      value: values.items || [],
      addLabel: "Dodaj uslugu u paket",
      help: "Paket mora sadržati bar jednu uslugu — izaberite je iz padajućeg menija za svaku stavku.",
      itemFields: [
        { name: "service", label: "Usluga", type: "select", required: true, options: serviceOptions },
        { name: "sessions", label: "Broj seansi", type: "number", min: 1, value: 1, required: true },
      ],
    },
    { name: "totalPrice", label: "Cena", type: "number", required: true, min: 0, step: "0.01", width: 6, value: values.totalPrice },
    { name: "basePrice", label: "Stara cena (opciono)", type: "number", min: 0, step: "0.01", width: 6, value: values.basePrice },
    { name: "totalDuration", label: "Ukupno trajanje (min, opciono)", type: "number", min: 0, width: 6, value: values.totalDuration },
    { name: "badge", label: "Oznaka (npr. 'Popularno')", type: "text", width: 6, value: values.badge },
    { name: "order", label: "Redosled prikaza", type: "number", min: 0, width: 6, value: values.order },
    { name: "isBest", label: "Istakni kao najbolju opciju", type: "checkbox", width: 6, value: values.isBest },
    {
      name: "categories",
      label: "Kategorije",
      type: "multiselect",
      width: 6,
      value: (values.categories || []).map((c) => (typeof c === "object" ? c.id ?? c._id?.toString() : c)),
      options: categoryOptions.map((c) => ({ value: c.id, label: c.naziv })),
    },
    {
      name: "tags",
      label: "Tagovi",
      type: "multiselect",
      width: 6,
      value: (values.tags || []).map((t) => (typeof t === "object" ? t.id ?? t._id?.toString() : t)),
      options: tagOptions.map((t) => ({ value: t.id, label: t.naziv })),
    },
    {
      name: "faq",
      label: "Česta pitanja",
      type: "repeater",
      width: 12,
      value: values.faq || [],
      addLabel: "Dodaj pitanje",
      itemFields: [
        { name: "question", label: "Pitanje", type: "text", required: true },
        { name: "answer", label: "Odgovor", type: "textarea", required: true },
      ],
    },
    {
      name: "packageImage",
      label: "Slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      preview: isEdit ? values.image?.url : null,
    },
    { name: "imageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.image?.imgDesc || "" },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/paketi/${pkg.id}` : "/admin/paketi",
    formEnctype: "multipart/form-data",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj paket",
    cancelUrl: "/admin/paketi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Paketi", url: "/admin/paketi" },
      { label: isEdit ? "Izmena" : "Novi paket", url: null },
    ],
  };
}

export default { preparePackageListData, preparePackageDetailsData, preparePackageFormData };