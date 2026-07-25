import { formatDateTime, formatDate } from "../utils/date.time.util.js";

// Same fix as package.mapper.js's isPopulatedService: a raw (unpopulated) Mongoose
// ObjectId is ALSO typeof "object", so a plain typeof check can't tell it apart from
// a real populated document - checking for a field only the real document has (.name
// for Service, .firstName for User) is the actual distinguishing signal.
function isPopulatedService(service) {
  return Boolean(service && typeof service === "object" && typeof service.name === "string");
}

function getServiceName(item) {
  return isPopulatedService(item.service) ? item.service.name : null;
}

function getVariantName(item) {
  if (isPopulatedService(item.service) && Array.isArray(item.service.packages)) {
    const variant = item.service.packages.find((p) => String(p._id) === String(item.servicePackageId));
    return variant?.name || null;
  }
  return null;
}

// item.user is the live populated User doc when the query populated this path and
// the referenced User still exists. userSnapshot is frozen at purchase time (see
// package-purchase.service.js's createPurchaseForUser), so it's tried first - it
// survives both a truly-unpopulated ref AND a User that's since been anonymized or
// deleted (see user.service.js's anonymizeUser/deleteUser).
function getUserName(p) {
  if (p.userSnapshot?.firstName) return `${p.userSnapshot.firstName} ${p.userSnapshot.lastName || ""}`.trim();
  if (p.user && typeof p.user === "object" && p.user.firstName) return `${p.user.firstName} ${p.user.lastName || ""}`.trim();
  return p.user?.toString() || null;
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
    korisnik: getUserName(p),
    korisnikEmail: p.user?.email || null,
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