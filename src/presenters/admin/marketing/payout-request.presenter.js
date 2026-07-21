export function preparePayoutRequestListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "earnerType", label: "Tip" },
      { key: "earnerName", label: "Ime" },
      { key: "iznos", label: "Iznos" },
      { key: "status", label: "Status" },
      { key: "zatrazeno", label: "Zatraženo" },
    ],
    actions: [{ type: "view", url: "/admin/isplate/detalji/", icon: "eye" }],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/isplate",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Isplate", url: null },
    ],
    topbar: {
      search: "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "requested", label: "Zatraženo" },
            { value: "approved", label: "Odobreno" },
            { value: "paid", label: "Isplaćeno" },
            { value: "rejected", label: "Odbijeno" },
          ],
        },
        {
          type: "select",
          name: "earnerType",
          label: "Tip",
          value: query.earnerType || "",
          options: [
            { value: "", label: "Svi" },
            { value: "employee", label: "Zaposleni" },
            { value: "partner", label: "Partner" },
          ],
        },
      ],
    },
  };
}

export function preparePayoutRequestDetailsData(request) {
  const actionsByStatus = {
    requested: [
      { label: "Odobri", url: `/admin/isplate/${request.id}/odobri`, variant: "primary" },
      { label: "Označi kao isplaćeno", url: `/admin/isplate/${request.id}/isplati`, variant: "success" },
      { label: "Odbij", url: `/admin/isplate/${request.id}/odbij`, variant: "danger" },
    ],
    approved: [
      { label: "Označi kao isplaćeno", url: `/admin/isplate/${request.id}/isplati`, variant: "success" },
      { label: "Odbij", url: `/admin/isplate/${request.id}/odbij`, variant: "danger" },
    ],
    paid: [],
    rejected: [],
  };

  return {
    backUrl: "/admin/isplate",
    sections: [
      {
        title: "Podaci o zahtevu",
        type: "table",
        rows: [
          { label: "Tip", value: request.earnerType },
          { label: "Ime", value: request.earnerName },
          { label: "Iznos", value: request.iznos },
          { label: "Status", value: request.status },
          { label: "Napomena", value: request.napomena || "-" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Promena statusa",
        type: "custom",
        content: "payout-request-status-actions",
        data: { requestId: request.id, actions: actionsByStatus[request.statusRaw] || [] },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Zatraženo", value: request.vreme.zatrazeno },
          { label: "Odobreno", value: request.vreme.odobreno || "-" },
          { label: "Isplaćeno", value: request.vreme.isplaceno || "-" },
          { label: "Odbijeno", value: request.vreme.odbijeno || "-" },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Isplate", url: "/admin/isplate" },
      { label: request.earnerName, url: null },
    ],
  };
}