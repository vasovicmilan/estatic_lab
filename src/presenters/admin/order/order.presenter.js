import { getAllowedStatuses } from "../../../models/order-status-transitions.js";

export function prepareOrderListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "korisnik", label: "Korisnik" },
      { key: "brojStavki", label: "Stavki" },
      { key: "ukupnaCena", label: "Ukupno" },
      { key: "status", label: "Status" },
      { key: "datum", label: "Datum" },
    ],
    actions: [{ type: "view", url: "/admin/porudzbine/detalji/", icon: "eye" }],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/porudzbine",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Porudžbine", url: null },
    ],
    topbar: {
      searchUrl: "/admin/porudzbine/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi statusi" },
            { value: "pending", label: "Na čekanju" },
            { value: "processing", label: "U obradi" },
            { value: "shipped", label: "Poslato" },
            { value: "delivered", label: "Dostavljeno" },
            { value: "completed", label: "Završeno" },
            { value: "cancelled", label: "Otkazano" },
            { value: "returned", label: "Vraćeno" },
            { value: "refunded", label: "Refundirano" },
          ],
        },
        { type: "text", name: "dateFrom", label: "Od datuma", value: query.dateFrom || "" },
        { type: "text", name: "dateTo", label: "Do datuma", value: query.dateTo || "" },
      ],
    },
  };
}

export function prepareOrderDetailsData(order) {
  const allowedNextStatuses = getAllowedStatuses(order.statusRaw, "admin");

  const actionMap = {
    processing: { label: "Označi kao u obradi", url: `/admin/porudzbine/${order.id}/obradi`, variant: "primary", needsReason: false },
    shipped: { label: "Označi kao poslato", url: `/admin/porudzbine/${order.id}/posalji`, variant: "primary", needsReason: false },
    delivered: { label: "Označi kao dostavljeno", url: `/admin/porudzbine/${order.id}/dostavi`, variant: "success", needsReason: false },
    completed: { label: "Označi kao završeno", url: `/admin/porudzbine/${order.id}/zavrsi`, variant: "success", needsReason: false },
    cancelled: { label: "Otkaži porudžbinu", url: `/admin/porudzbine/${order.id}/otkazi`, variant: "danger", needsReason: true },
    returned: { label: "Označi kao vraćeno", url: `/admin/porudzbine/${order.id}/vrati`, variant: "warning", needsReason: true },
    refunded: { label: "Označi kao refundirano", url: `/admin/porudzbine/${order.id}/refundiraj`, variant: "warning", needsReason: false },
    // "pending" is a valid re-open target from "cancelled" per order-status-transitions.js,
    // but no "reopen" route exists yet - omitted here rather than pointed at the wrong
    // endpoint, same convention as appointment.presenter.js's note on this exact gap.
  };
  const statusActions = allowedNextStatuses.map((status) => actionMap[status]).filter(Boolean);

  return {
    backUrl: "/admin/porudzbine",
    sections: [
      {
        title: "Korisnik",
        type: "table",
        rows: [
          { label: "Ime", value: order.korisnik.ime },
          { label: "Email", value: order.korisnik.email },
          { label: "Telefon", value: order.korisnik.telefon || "-" },
        ],
      },
      {
        title: "Adresa za dostavu",
        type: "table",
        rows: order.adresa
          ? [
              { label: "Grad", value: order.adresa.grad },
              { label: "Poštanski broj", value: order.adresa.postanskiBroj },
              { label: "Ulica i broj", value: `${order.adresa.ulica} ${order.adresa.broj}` },
            ]
          : [{ label: "Adresa", value: "-" }],
      },
      {
        title: "Stavke",
        type: "table",
        rows: order.stavke.map((s) => ({
          label: `${s.naziv} - ${s.varijanta}`,
          value: `${s.kolicina} x ${s.cena} RSD = ${s.ukupno} RSD`,
        })),
      },
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Subtotal", value: `${order.subtotal} RSD` },
          { label: "Dostava", value: `${order.dostava} RSD` },
          { label: "Kupon", value: order.kupon || "-" },
          { label: "Popust", value: `${order.popust} RSD` },
          { label: "Ukupno", value: order.ukupnaCena },
        ],
      },
    ],
    sidebar: [
      {
        title: "Promena statusa",
        type: "custom",
        content: "order-status-actions",
        data: {
          orderId: order.id,
          currentStatus: order.status,
          actions: statusActions,
        },
      },
      {
        title: "Otkazivanje/vraćanje",
        type: "table",
        rows: [
          { label: "Otkazao", value: order.otkazao || "-" },
          { label: "Otkazano u", value: order.otkazanoU || "-" },
          { label: "Razlog otkazivanja", value: order.razlogOtkazivanja || "-" },
          { label: "Razlog vraćanja", value: order.razlogVracanja || "-" },
        ],
      },
      {
        title: "Napomena",
        type: "table",
        rows: [{ label: "Napomena kupca", value: order.napomena || "-" }],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Naručeno", value: order.vreme.naruceno },
          { label: "U obradi od", value: order.vreme.uObradiOd || "-" },
          { label: "Poslato", value: order.vreme.poslatoU || "-" },
          { label: "Dostavljeno", value: order.vreme.dostavljenoU || "-" },
          { label: "Završeno", value: order.vreme.zavrsenoU || "-" },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Porudžbine", url: "/admin/porudzbine" },
      { label: order.korisnik.ime, url: null },
    ],
  };
}

export default {
  prepareOrderListData,
  prepareOrderDetailsData,
};