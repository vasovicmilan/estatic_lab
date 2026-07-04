import { getAllowedStatuses } from "../../../models/appointment-status-transitions.js";

export function prepareAppointmentListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "korisnik", label: "Korisnik" },
      { key: "usluga", label: "Usluga" },
      { key: "datum", label: "Termin" },
      { key: "status", label: "Status" },
      { key: "konacnaCena", label: "Cena" },
    ],
    actions: [
      { type: "view", url: "/admin/termini/detalji/", icon: "eye" },
      { type: "delete", url: "/admin/termini/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/termini",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Termini", url: null },
    ],
    topbar: {
      searchUrl: "/admin/termini/pretraga",
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
            { value: "confirmed", label: "Potvrđeno" },
            { value: "rejected", label: "Odbijeno" },
            { value: "cancelled", label: "Otkazano" },
            { value: "completed", label: "Završeno" },
          ],
        },
        { type: "text", name: "dateFrom", label: "Od datuma", value: query.dateFrom || "" },
        { type: "text", name: "dateTo", label: "Do datuma", value: query.dateTo || "" },
      ],
    },
  };
}

export function prepareAppointmentDetailsData(appointment) {
  const allowedNextStatuses = getAllowedStatuses(appointment.statusRaw, "admin");

  const actionMap = {
    confirmed: { label: "Potvrdi termin", url: `/admin/termini/${appointment.id}/potvrdi`, variant: "success", needsReason: false },
    rejected: { label: "Odbij termin", url: `/admin/termini/${appointment.id}/odbij`, variant: "danger", needsReason: true },
    cancelled: { label: "Otkaži termin", url: `/admin/termini/${appointment.id}/otkazi`, variant: "warning", needsReason: true },
    completed: { label: "Označi kao završen", url: `/admin/termini/${appointment.id}/zavrsi`, variant: "primary", needsReason: false },
    // NOTE: "pending" is a valid transition target from rejected/cancelled per
    // appointment-status-transitions.js, but no "reopen" route exists yet — omitted
    // here rather than pointed at the wrong endpoint. Add a route + this entry together.
  };
  const statusActions = allowedNextStatuses.map((status) => actionMap[status]).filter(Boolean);

  return {
    backUrl: "/admin/termini",
    sections: [
      {
        title: "Korisnik",
        type: "table",
        rows: [
          { label: "Ime", value: appointment.korisnik.ime },
          { label: "Email", value: appointment.korisnik.email },
          { label: "Telefon", value: appointment.korisnik.telefon || "-" },
        ],
      },
      {
        title: "Usluga i termin",
        type: "table",
        rows: [
          { label: "Usluga", value: appointment.usluga.naziv },
          { label: "Trajanje", value: appointment.usluga.trajanje },
          { label: "Cena usluge", value: appointment.usluga.cena },
          { label: "Početak", value: appointment.termin.pocetak },
          { label: "Kraj", value: appointment.termin.kraj },
          { label: "Terapeut", value: appointment.terapeut || "Nije dodeljen" },
          { label: "Dodeljeni terapeut (sistem)", value: appointment.dodeljenTerapeut || "-" },
        ],
      },
      {
        title: "Cena i popust",
        type: "table",
        rows: [
          { label: "Kupon", value: appointment.kupon || "-" },
          { label: "Popust", value: appointment.popust || "-" },
          { label: "Konačna cena", value: appointment.konacnaCena },
        ],
      },
    ],
    sidebar: [
      {
        title: "Promena statusa",
        type: "custom",
        content: "appointment-status-actions",
        data: {
          appointmentId: appointment.id,
          currentStatus: appointment.status,
          actions: statusActions,
        },
      },
      {
        title: "Istorija",
        type: "table",
        rows: [
          { label: "Potvrdio", value: appointment.potvrdio || "-" },
          { label: "Potvrđen u", value: appointment.potvrdjenU || "-" },
          { label: "Odbio", value: appointment.odbio || "-" },
          { label: "Razlog odbijanja", value: appointment.razlogOdbijanja || "-" },
          { label: "Otkazao", value: appointment.otkazao || "-" },
          { label: "Razlog otkazivanja", value: appointment.razlogOtkazivanja || "-" },
          { label: "Dodelio", value: appointment.dodelio || "-" },
        ],
      },
      {
        title: "Napomena",
        type: "table",
        rows: [{ label: "Napomena korisnika", value: appointment.napomena || "-" }],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: appointment.createdAt },
          { label: "Ažuriran", value: appointment.updatedAt },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Termini", url: "/admin/termini" },
      { label: appointment.korisnik.ime, url: null },
    ],
  };
}
