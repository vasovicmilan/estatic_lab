import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function getServiceName(item) {
  if (item.service && typeof item.service === "object") return item.service.name;
  return null;
}

function getVariantName(item) {
  if (item.service && typeof item.service === "object" && Array.isArray(item.service.packages)) {
    const variant = item.service.packages.find((p) => String(p._id) === String(item.servicePackageId));
    return variant?.name || null;
  }
  return null;
}

function mapItems(items = []) {
  return items.map((item) => ({
    usluga: getServiceName(item) || item.service?.toString(),
    varijanta: getVariantName(item) || item.servicePackageId?.toString(),
    ukupnoSeansi: item.sessionsTotal,
    iskorisceno: item.sessionsUsed,
    rezervisano: item.sessionsReserved || 0,
    preostalo: item.sessionsTotal - item.sessionsUsed - (item.sessionsReserved || 0),
  }));
}

function translateStatus(status) {
  const map = { active: "Aktivan", completed: "Iskorišćen", expired: "Istekao", cancelled: "Otkazan" };
  return map[status] || status;
}

export function mapPackagePurchasesForAdminList(purchases = []) {
  return purchases
    .map((p) => {
      if (!p) return null;
      return {
        id: p._id.toString(),
        paket: p.package?.name || p.package?.toString(),
        stavke: mapItems(p.items),
        cena: `${p.pricePaid} RSD`,
        status: translateStatus(p.status),
        statusRaw: p.status,
        kupljeno: formatDate(p.purchasedAt),
        istice: p.expiresAt ? formatDate(p.expiresAt) : "Ne ističe",
      };
    })
    .filter(Boolean);
}

export function mapPackagePurchaseForAdminDetail(p) {
  if (!p) return null;
  return {
    id: p._id.toString(),
    korisnik: p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ""}`.trim() : p.user?.toString(),
    paket: p.package?.name || p.package?.toString(),
    stavke: mapItems(p.items),
    originalnaCena: p.originalPrice,
    popust: p.discountApplied,
    placeno: p.pricePaid,
    status: translateStatus(p.status),
    statusRaw: p.status,
    napomena: p.notes || null,
    expiresAtRaw: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : "",
    vreme: {
      kupljeno: formatDateTime(p.purchasedAt),
      istice: p.expiresAt ? formatDateTime(p.expiresAt) : "Ne ističe",
    },
  };
}

export default { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail };