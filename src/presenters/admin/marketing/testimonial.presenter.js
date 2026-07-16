export function prepareTestimonialListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "ime", label: "Ime" },
      { key: "email", label: "Email" },
      { key: "ocena", label: "Ocena" },
      { key: "usluga", label: "Usluga" },
      { key: "status", label: "Status" },
      { key: "istaknut", label: "Istaknut" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/testimoniali/detalji/", icon: "eye" },
      { type: "delete", url: "/admin/testimoniali/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/testimoniali",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Testimoniali", url: null },
    ],
    topbar: {
      searchUrl: "/admin/testimoniali/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "pending", label: "Na čekanju" },
            { value: "approved", label: "Odobreni" },
            { value: "rejected", label: "Odbijeni" },
          ],
        },
        {
          type: "select",
          name: "isFeatured",
          label: "Istaknut",
          value: query.isFeatured || "",
          options: [
            { value: "", label: "Svi" },
            { value: "true", label: "Da" },
            { value: "false", label: "Ne" },
          ],
        },
      ],
    },
  };
}

export function prepareTestimonialDetailsData(testimonial) {
  return {
    backUrl: "/admin/testimoniali",
    sections: [
      {
        title: "Podaci",
        type: "table",
        rows: [
          { label: "Ime", value: testimonial.osnovno.ime },
          { label: "Email", value: testimonial.osnovno.email || "-" },
          { label: "Ocena", value: testimonial.osnovno.ocenaZvezdice },
          { label: "Komentar", value: testimonial.osnovno.komentar },
          { label: testimonial.paket && !testimonial.usluga ? "Paket" : "Usluga",
            value: testimonial.usluga?.naziv || testimonial.paket?.naziv || "-", },
          { label: "Povezan korisnik", value: testimonial.korisnik?.ime || "Anonimni gost" },
        ],
      },
      {
        title: "Slika",
        type: "custom",
        content: testimonial.osnovno.slika
          ? `<img src="${testimonial.osnovno.slika.url}" alt="${testimonial.osnovno.slika.alt || ""}" width="120" class="img-fluid rounded-circle">`
          : "Nema slike",
      },
    ],
    sidebar: [
      {
        title: "Moderacija",
        type: "custom",
        content: "testimonial-moderation-form",
        data: {
          testimonialId: testimonial.id,
          currentStatus: testimonial.status.vrednostRaw,
          approveUrl: `/admin/testimoniali/${testimonial.id}/odobri`,
          rejectUrl: `/admin/testimoniali/${testimonial.id}/odbij`,
          isFeatured: testimonial.status.istaknut,
        },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: testimonial.vreme.kreirano },
          { label: "Ažurirano", value: testimonial.vreme.azurirano },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Testimoniali", url: "/admin/testimoniali" },
      { label: testimonial.osnovno.ime, url: null },
    ],
  };
}