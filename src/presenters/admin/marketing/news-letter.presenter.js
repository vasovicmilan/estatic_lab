export function prepareNewsletterListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "email", label: "Email" },
      { key: "status", label: "Status" },
      { key: "prijavljen", label: "Prijavljen" },
    ],
    actions: [
      { type: "view", url: "/admin/newsletter/detalji/", icon: "eye" },
      { type: "delete", url: "/admin/newsletter/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/newsletter",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Newsletter", url: null },
    ],
    topbar: {
      searchUrl: "/admin/newsletter/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "subscribed", label: "Prijavljeni" },
            { value: "unsubscribed", label: "Odjavljeni" },
          ],
        },
      ],
    },
  };
}

export function prepareNewsletterDetailsData(subscriber) {
  return {
    backUrl: "/admin/newsletter",
    sections: [
      {
        title: "Podaci",
        type: "table",
        rows: [
          { label: "Email", value: subscriber.osnovno.email },
          { label: "Status", value: subscriber.osnovno.status },
        ],
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Prijavljen", value: subscriber.vreme.prijavljen },
          { label: "Odjavljen", value: subscriber.vreme.odjavljen || "-" },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Newsletter", url: "/admin/newsletter" },
      { label: subscriber.osnovno.email, url: null },
    ],
  };
}