import { formatDateTime } from "../../../utils/date.time.util.js";

export function prepareAuditLogListData(result, query = {}, availableActions = []) {
  return {
    items: result.data.map(mapAuditLogRow),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/logovi/audit",
      query,
    },
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
    entitet: entry.entity?.type ? `${entity_label(entry.entity.type)} #${entry.entity.id}` : "-",
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
    Coupon: "Kupon",
    Partner: "Partner",
    Employee: "Zaposleni",
    PayoutRequest: "Zahtev za isplatu",
    User: "Korisnik",
    Role: "Rola",
  };
  return map[type] || type;
}

// renders each changed field as "polje: staro -> novo" on its own line
function formatChanges(changes) {
  if (!changes) return null;
  return Object.entries(changes)
    .map(([field, { old: oldVal, new: newVal }]) => `${field}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`)
    .join("\n");
}

export default { prepareAuditLogListData };