import { formatDateTime, formatDate } from "../utils/date.time.util.js";
import { formatMoney } from "../utils/price.util.js";
import { mapAppointmentForUserShort } from "./appointment.mapper.js";

const EXPIRING_SOON_DAYS = 14;

/**
 * Nothing flips a purchase to "expired" in the database, it only stays "active" with an
 * expiresAt in the past (booking already refuses it by date, see isUsable in the service).
 * Every list/detail therefore derives the status shown to people from the dates as well.
 */
export function effectiveStatus(p, now = new Date()) {
  if (p.status === "active" && p.expiresAt && new Date(p.expiresAt) < now) return "expired";
  return p.status;
}

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
        cena: formatMoney(p.pricePaid),
        status: translateStatus(effectiveStatus(p)),
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
    status: translateStatus(effectiveStatus(p)),
    statusRaw: p.status,
    napomena: p.notes || null,
    expiresAtRaw: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : "",
    vreme: {
      kupljeno: formatDateTime(p.purchasedAt),
      istice: p.expiresAt ? formatDateTime(p.expiresAt) : "Ne ističe",
    },
  };
}

function sessionTotals(items = []) {
  const totals = items.reduce(
    (acc, i) => {
      acc.ukupno += i.sessionsTotal || 0;
      acc.iskorisceno += i.sessionsUsed || 0;
      acc.rezervisano += i.sessionsReserved || 0;
      return acc;
    },
    { ukupno: 0, iskorisceno: 0, rezervisano: 0 }
  );
  totals.preostalo = Math.max(0, totals.ukupno - totals.iskorisceno - totals.rezervisano);
  // the bar shows what is already spent: used + booked ahead
  totals.procenat = totals.ukupno ? Math.round(((totals.iskorisceno + totals.rezervisano) / totals.ukupno) * 100) : 0;
  return totals;
}

function daysUntil(date, now = new Date()) {
  return Math.ceil((new Date(date) - now) / 86400000);
}

/** Customer's own view of one purchase (never exposes who recorded it, notes or commission data). */
export function mapPackagePurchaseForUser(p, now = new Date()) {
  if (!p) return null;
  const status = effectiveStatus(p, now);
  const totals = sessionTotals(p.items);
  const daysLeft = p.expiresAt && status === "active" ? daysUntil(p.expiresAt, now) : null;
  return {
    id: p._id.toString(),
    paket: p.package?.name || "Paket",
    status: translateStatus(status),
    statusRaw: status,
    isActive: status === "active",
    stavke: mapItems(p.items),
    ukupno: totals.ukupno,
    iskorisceno: totals.iskorisceno,
    rezervisano: totals.rezervisano,
    preostalo: totals.preostalo,
    procenat: totals.procenat,
    placeno: formatMoney(p.pricePaid),
    originalnaCena: p.discountApplied > 0 ? formatMoney(p.originalPrice) : null,
    popust: p.discountApplied > 0 ? formatMoney(p.discountApplied) : null,
    kupljeno: formatDate(p.purchasedAt),
    istice: p.expiresAt ? formatDate(p.expiresAt) : "Ne ističe",
    preostaloDana: daysLeft,
    istekaUskoro: daysLeft != null && daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS && totals.preostalo > 0,
    // sessions still unspent when time ran out (or the package was cancelled)
    propaloSeansi: status === "expired" || status === "cancelled" ? totals.preostalo : 0,
  };
}

export function mapPackagePurchasesForUser(purchases = [], now = new Date()) {
  return purchases.filter(Boolean).map((p) => mapPackagePurchaseForUser(p, now));
}

export function mapPackagePurchaseForUserDetail(p, appointments = [], now = new Date()) {
  const base = mapPackagePurchaseForUser(p, now);
  if (!base) return null;
  return {
    ...base,
    termini: appointments.map((a) => ({
      ...mapAppointmentForUserShort(a),
      statusRaw: a.status,
    })),
  };
}

export default { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail, mapPackagePurchaseForUser, mapPackagePurchasesForUser, mapPackagePurchaseForUserDetail, effectiveStatus };