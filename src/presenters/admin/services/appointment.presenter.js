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
  const allowedNextStatuses = {
    pending: ["confirmed", "rejected", "cancelled"],
    confirmed: ["completed", "cancelled", "rejected"],
    rejected: ["pending"],
    cancelled: ["pending"],
    completed: [],
  }[appointment.statusRaw] || [];

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
        content: "status-change-form",
        data: {
          appointmentId: appointment.id,
          currentStatus: appointment.statusRaw,
          statuses: allowedNextStatuses,
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

export function prepareEmployeeAppointmentListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "klijent", label: "Klijent" },
      { key: "usluga", label: "Usluga" },
      { key: "datum", label: "Termin" },
      { key: "status", label: "Status" },
      { key: "cena", label: "Cena" },
    ],
    actions: [{ type: "view", url: "/moji-termini/detalji/", icon: "eye" }],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moji-termini",
      query,
    },
    breadcrumbs: [{ label: "Moji termini", url: null }],
    topbar: {
      searchUrl: "/moji-termini/pretraga",
      search: query.search || "",
    },
  };
}