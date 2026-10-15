import { formatDateTime } from "../../../utils/date.time.util.js";
import { buildAdminPagination } from "../../../utils/admin-list.util.js";

export function prepareAuditLogListData(result, query = {}, availableActions = []) {
  return {
    items: result.data.map(mapAuditLogRow),
    pagination: buildAdminPagination(result, { basePath: "/admin/logovi/audit", query }),
    filters: {
      action: {
        value: query.action || "",
        options: [{ value: "", label: "Sve akcije" }, ...availableActions.map((a) => ({ value: a, label: a }))],
      },
      success: {
        value: query.success ?? "",
        options: [
          { value: "", label: "Sve" },
          { value: "true", label: "Uspešno" },
          { value: "false", label: "Neuspešno" },
        ],
      },
      actorRole: {
        value: query.actorRole || "",
        options: [
          { value: "", label: "Sve role" },
          { value: "admin", label: "Admin" },
          { value: "employee", label: "Zaposleni" },
          { value: "partner", label: "Partner" },
          { value: "user", label: "Korisnik" },
          { value: "system", label: "Sistem (cron)" },
        ],
      },
      search: { value: query.search || "" },
      dateFrom: { value: query.dateFrom || "" },
      dateTo: { value: query.dateTo || "" },
      sortOrder: { value: query.sortOrder === "asc" ? "asc" : "desc" },
    },
  };
}

function mapAuditLogRow(entry) {
  return {
    id: entry._id.toString(),
    vreme: formatDateTime(entry.timestamp),
    korisnik: entry.actor?.email || "Sistem",
    rola: entry.actor?.role || "-",
    akcija: entry.action,
    entitet: formatEntity(entry.entity),
    izmene: formatChanges(entry.changes),
    ip: entry.ip || "-",
    userAgent: entry.userAgent || "-",
    uspesno: entry.success ? "Da" : "Ne",
    greska: entry.errorMessage || null,
  };
}

function entity_label(type) {
  const map = {
    Product: "Proizvod",
    Service: "Usluga",
    Package: "Paket",
    PackagePurchase: "Kupljen paket",
    Resource: "Resurs",
    Expert: "Stručnjak",
    Coupon: "Kupon",
    Partner: "Partner",
    BusinessPartner: "Poslovni partner",
    Employee: "Zaposleni",
    PayoutRequest: "Zahtev za isplatu",
    Commission: "Provizija",
    User: "Korisnik",
    Role: "Rola",
    Category: "Kategorija",
    Tag: "Tag",
    Post: "Blog objava",
    Order: "Porudžbina",
    TemporaryOrder: "Privremena porudžbina",
    Appointment: "Termin",
    Testimonial: "Utisak",
    Campaign: "Kampanja",
    NewsletterSubscriber: "Pretplatnik",
    Contact: "Poruka",
    SiteSettings: "Podešavanja sajta",
    SiteContent: "Sadržaj sajta",
    BusinessReport: "Poslovni izveštaj",
    Route: "Stranica",
  };
  return map[type] || type;
}

// singleton records (site settings/content) and route denials have no document id worth showing
function formatEntity(entity) {
  if (!entity?.type) return "-";
  const label = entity_label(entity.type);
  const id = entity.id == null ? "" : String(entity.id);
  return id && id !== "singleton" ? `${label} #${id}` : label;
}

const MAX_VALUE_LENGTH = 300;

function formatValue(value) {
  const text = JSON.stringify(value);
  if (text === undefined) return "-";
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

// renders each changed field as "polje: staro -> novo" on its own line. Reads
// { old, new } (what recordAuditLog stores) but also tolerates { before, after },
// so entries written before the shapes were unified still render properly; long
// values (a whole page of site content) are cut so one entry can't blow up the table.
function formatChanges(changes) {
  if (!changes) return null;
  return Object.entries(changes)
    .map(([field, pair]) => {
      const oldVal = pair && typeof pair === "object" ? (pair.old !== undefined ? pair.old : pair.before) : undefined;
      const newVal = pair && typeof pair === "object" ? (pair.new !== undefined ? pair.new : pair.after) : pair;
      return `${field}: ${formatValue(oldVal)} → ${formatValue(newVal)}`;
    })
    .join("\n");
}

export default { prepareAuditLogListData };