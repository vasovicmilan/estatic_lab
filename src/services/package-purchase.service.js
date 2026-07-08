import packagePurchaseRepo from "../repositories/package-purchase.repository.js";
import packageRepo from "../repositories/package.repository.js";
import couponService from "./coupon.service.js";
import { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail } from "../mappers/package-purchase.mapper.js";
import { validationError, notFound, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const adminPopulate = [
  { path: "package", select: "name" },
  { path: "user", select: "firstName lastName" },
  { path: "items.service", select: "name" },
];

// Admin action: grant a user a package they paid for outside the system (cash, card
// terminal, bank transfer). This is the ONLY way a PackagePurchase comes into
// existence — there is no self-serve purchase flow, by design (no payment integration).
export async function createPurchaseForUser(userId, packageId, adminId, { expiresAt = null, pricePaid = null, notes = "", couponCode = null } = {}) {
  if (!userId) validationError("userId");
  if (!packageId) validationError("packageId");
  if (!adminId) validationError("adminId");

  const pkg = await packageRepo.findPackageById(packageId);
  if (!pkg) notFound("Paket");

  const originalPrice = pricePaid ?? pkg.totalPrice;
  let discountApplied = 0;
  let couponResult = null;

  if (couponCode) {
    couponResult = await couponService.validateCouponForPackagePurchase(couponCode, { userId, packageId, purchaseValue: originalPrice });
    discountApplied = couponResult.discountAmount;
  }

  const items = pkg.items.map((item) => ({
    service: item.service,
    sessionsTotal: item.sessions,
    sessionsUsed: 0,
  }));

  const created = await packagePurchaseRepo.createPackagePurchase({
    user: userId,
    package: packageId,
    items,
    originalPrice,
    discountApplied,
    pricePaid: Math.max(0, originalPrice - discountApplied),
    coupon: couponResult?.coupon._id || null,
    expiresAt,
    purchasedBy: adminId,
    notes,
  });

  if (couponResult) {
    await couponService.redeemCoupon(couponResult.coupon._id, {
      userId,
      packagePurchaseId: created._id,
      discountAmount: discountApplied,
    });
  }

  logInfo("Package purchase recorded", { packagePurchaseId: created._id, userId, packageId, adminId });
  return getPurchaseById(created._id);
}

export async function getPurchaseById(packagePurchaseId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, { populateFields: adminPopulate });
  if (!purchase) notFound("Kupljeni paket");
  return mapPackagePurchaseForAdminDetail(purchase);
}

export async function listPurchasesForUser(userId) {
  if (!userId) validationError("userId");
  const purchases = await packagePurchaseRepo.findPurchasesByUser(userId, { populateFields: adminPopulate });
  return mapPackagePurchasesForAdminList(purchases);
}

export async function listPurchases({ filters = {}, limit = 10, page = 1 } = {}) {
  const result = await packagePurchaseRepo.findPackagePurchases({ filters, limit, page, populateFields: adminPopulate });
  return { data: mapPackagePurchasesForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

function isUsable(purchase, now = new Date()) {
  if (purchase.status !== "active") return false;
  if (purchase.expiresAt && new Date(purchase.expiresAt) < now) return false;
  return true;
}

// Suggests a default for the booking UI (soonest-expiring first, nulls last; then
// oldest-purchased first) — the client still sends back a specific packagePurchaseId,
// which assertUsablePurchase() below re-validates server-side. Never trust this
// suggestion alone as authorization.
export async function findUsablePurchaseForService(userId, serviceId) {
  const candidates = await packagePurchaseRepo.findActivePurchasesForUserAndService(userId, serviceId);
  const now = new Date();

  const usable = candidates.filter((p) => {
    if (!isUsable(p, now)) return false;
    const item = p.items.find((i) => String(i.service) === String(serviceId));
    return item && item.sessionsUsed < item.sessionsTotal;
  });

  usable.sort((a, b) => {
    if (a.expiresAt && b.expiresAt) return new Date(a.expiresAt) - new Date(b.expiresAt);
    if (a.expiresAt) return -1;
    if (b.expiresAt) return 1;
    return new Date(a.purchasedAt) - new Date(b.purchasedAt);
  });

  return usable[0] || null;
}

// The actual server-side authorization check — called from appointment.service.js's
// bookAppointment with whatever packagePurchaseId the client submitted (whether that
// came from findUsablePurchaseForService's suggestion or a manual pick in the UI).
export async function assertUsablePurchase(packagePurchaseId, userId, serviceId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId);
  if (!purchase) notFound("Kupljeni paket");
  if (String(purchase.user) !== String(userId)) forbidden("Ovaj paket ne pripada vama");
  if (!isUsable(purchase)) badRequest("Ovaj paket više nije aktivan ili mu je istekao rok važenja");

  const item = purchase.items.find((i) => String(i.service) === String(serviceId));
  if (!item) badRequest("Ovaj paket ne pokriva izabranu uslugu");
  if (item.sessionsUsed >= item.sessionsTotal) badRequest("Nema više preostalih seansi za ovu uslugu u paketu");

  return purchase;
}

// Called ONLY from appointment.service.js's transitionStatus, ONLY when an
// appointment moves into "completed" and only has a packagePurchase attached.
// "completed" is a terminal status in appointment-status-transitions.js, so this
// never needs a symmetric "release"/un-consume path.
export async function consumeSession(packagePurchaseId, serviceId, { session } = {}) {
  const purchase = await packagePurchaseRepo.findPackagePurchaseDocById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");

  const item = purchase.items.find((i) => String(i.service) === String(serviceId));
  if (!item) badRequest("Ovaj paket ne pokriva izabranu uslugu");
  if (item.sessionsUsed >= item.sessionsTotal) badRequest("Nema više preostalih seansi za ovu uslugu u paketu");

  item.sessionsUsed += 1;
  if (purchase.items.every((i) => i.sessionsUsed >= i.sessionsTotal)) {
    purchase.status = "completed";
  }

  await purchase.save({ session });
  logInfo("Package purchase session consumed", { packagePurchaseId, serviceId, status: purchase.status });
  return purchase;
}

export async function cancelPurchase(packagePurchaseId, adminId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const updated = await packagePurchaseRepo.updatePackagePurchaseById(packagePurchaseId, { status: "cancelled" });
  if (!updated) notFound("Kupljeni paket");
  logInfo("Package purchase cancelled", { packagePurchaseId, adminId });
  return getPurchaseById(updated._id);
}

export default {
  createPurchaseForUser,
  getPurchaseById,
  listPurchasesForUser,
  listPurchases,
  findUsablePurchaseForService,
  assertUsablePurchase,
  consumeSession,
  cancelPurchase,
};