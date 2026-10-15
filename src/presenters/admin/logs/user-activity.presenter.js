import { formatDateTime } from "../../../utils/date.time.util.js";
import { buildAdminPagination } from "../../../utils/admin-list.util.js";
import { getAdminActionLabel } from "../../../utils/activity-labels.util.js";

const ENTITY_LABELS = {
  Product: "Proizvod",
  Service: "Usluga",
  Order: "Porudžbina",
  TemporaryOrder: "Porudžbina (na potvrdi)",
  Appointment: "Termin",
  PackagePurchase: "Kupljen paket",
  PayoutRequest: "Zahtev za isplatu",
  Employee: "Zaposleni",
  Partner: "Partner",
  User: "Korisnik",
};

function formatEntity(entity) {
  if (!entity?.type) return "-";
  const label = ENTITY_LABELS[entity.type] || entity.type;
  const id = entity.id == null ? "" : String(entity.id);
  return id && id !== "singleton" ? `${label} #${id}` : label;
}

// meta is { key: value } of non-personal facts; one "key: value" per line
function formatMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  const lines = Object.entries(meta)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  return lines.length ? lines.join("\n") : null;
}

const MAX_VALUE_LENGTH = 200;
function formatChanges(changes) {
  if (!changes) return null;
  const cut = (value) => {
    const text = JSON.stringify(value);
    if (text === undefined) return "-";
    return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
  };
  return Object.entries(changes)
    .map(([field, pair]) => `${field}: ${cut(pair?.old)} → ${cut(pair?.new)}`)
    .join("\n");
}

function mapRow(item) {
  return {
    id: item.id,
    izvor: item.source === "audit" ? "Audit" : "Aktivnost",
    vreme: formatDateTime(item.timestamp),
    akcija: item.action,
    opis: getAdminActionLabel(item.action),
    rola: item.actor?.role || "-",
    korisnik: item.actor?.email || (item.actor?.id ? `#${item.actor.id}` : "Gost"),
    entitet: formatEntity(item.entity),
    detalji: formatChanges(item.changes) || formatMeta(item.meta),
    ip: item.ip || "-",
    uspesno: item.success ? "Da" : "Ne",
    greska: item.errorMessage || null,
  };
}

/** Global admin list: /admin/logovi/aktivnost */
export function prepareActivityListData(result, query = {}, availableActions = [], summary = null) {
  return {
    items: result.data.map((entry) => ({
      ...mapRow({ source: "activity", id: String(entry._id), timestamp: entry.timestamp, action: entry.action, actor: { id: entry.userId, role: entry.role }, entity: entry.entity, meta: entry.meta, success: entry.success !== false, errorMessage: entry.errorMessage, ip: entry.ip }),
      korisnikId: entry.userId ? String(entry.userId) : null,
    })),
    pagination: buildAdminPagination(result, { basePath: "/admin/logovi/aktivnost", query }),
    summary,
    filters: {
      action: { value: query.action || "", options: [{ value: "", label: "Sve akcije" }, ...availableActions.map((a) => ({ value: a, label: getAdminActionLabel(a) === a ? a : `${getAdminActionLabel(a)} (${a})` }))] },
      role: {
        value: query.role || "",
        options: [
          { value: "", label: "Sve role" },
          { value: "guest", label: "Gost (nije prijavljen)" },
          { value: "user", label: "Korisnik" },
          { value: "employee", label: "Zaposleni" },
          { value: "partner", label: "Partner" },
          { value: "admin", label: "Admin" },
        ],
      },
      success: { value: query.success ?? "", options: [{ value: "", label: "Sve" }, { value: "true", label: "Uspešno" }, { value: "false", label: "Neuspešno" }] },
      search: { value: query.search || "" },
      userId: { value: query.userId || "" },
      dateFrom: { value: query.dateFrom || "" },
      dateTo: { value: query.dateTo || "" },
      sortOrder: { value: query.sortOrder === "asc" ? "asc" : "desc" },
    },
  };
}

/** Per-user merged history: /admin/korisnici/:userId/istorija */
export function prepareUserHistoryData(user, result, userId, query = {}) {
  return {
    user: { id: userId, ime: user.imePrezime, email: user.email },
    backUrl: `/admin/korisnici/detalji/${encodeURIComponent(userId)}`,
    items: result.data.map(mapRow),
    pagination: buildAdminPagination(result, { basePath: `/admin/korisnici/${encodeURIComponent(userId)}/istorija`, query }),
  };
}

export default { prepareActivityListData, prepareUserHistoryData };
