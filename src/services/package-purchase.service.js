import eventEmitter from "../events/event.emitter.js";
import packagePurchaseRepo from "../repositories/package-purchase.repository.js";
import packageRepo from "../repositories/package.repository.js";
import couponService from "./coupon.service.js";
import { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail } from "../mappers/package-purchase.mapper.js";
import { validationError, notFound, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const adminPopulate = [
  { path: "package", select: "name" },
  { path: "user", select: "firstName lastName email" },
  { path: "items.service", select: "name packages" }, // packages needed to resolve the variant name in the mapper
];

// Admin action: grant a user a package they paid for outside the system (cash, card
// terminal, bank transfer). This is the ONLY way a PackagePurchase comes into
// existence - there is no self-serve purchase flow, by design (no payment integration).
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
    servicePackageId: item.servicePackageId,
    sessionsTotal: item.sessions,
    sessionsUsed: 0,
    sessionsReserved: 0,
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
  const purchase = await getPurchaseById(created._id);
  eventEmitter.emit("package_purchase:created", { packagePurchaseId: created._id.toString() });
  return purchase;
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

function findItem(purchase, servicePackageId) {
  return purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
}

function availableSessions(item) {
  return item.sessionsTotal - item.sessionsUsed - (item.sessionsReserved || 0);
}

// Suggests a default for the booking UI - scoped to the EXACT variant being booked.
// Client still sends back a specific packagePurchaseId, which assertUsablePurchase()/
// reserveSession() below re-validate server-side. Never trust this alone as authorization.
export async function findUsablePurchaseForService(userId, servicePackageId) {
  const candidates = await packagePurchaseRepo.findActivePurchasesForUserAndVariant(userId, servicePackageId);
  const now = new Date();

  const usable = candidates.filter((p) => {
    if (!isUsable(p, now)) return false;
    const item = findItem(p, servicePackageId);
    return item && availableSessions(item) > 0;
  });

  usable.sort((a, b) => {
    if (a.expiresAt && b.expiresAt) return new Date(a.expiresAt) - new Date(b.expiresAt);
    if (a.expiresAt) return -1;
    if (b.expiresAt) return 1;
    return new Date(a.purchasedAt) - new Date(b.purchasedAt);
  });

  return usable[0] || null;
}

// Real server-side authorization check - called from appointment.service.js's
// bookAppointment (read-only, before the transaction).
export async function assertUsablePurchase(packagePurchaseId, userId, servicePackageId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId);
  if (!purchase) notFound("Kupljeni paket");
  if (String(purchase.user) !== String(userId)) forbidden("Ovaj paket ne pripada vama");
  if (!isUsable(purchase)) badRequest("Ovaj paket više nije aktivan ili mu je istekao rok važenja");

  const item = findItem(purchase, servicePackageId);
  if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");
  if (availableSessions(item) <= 0) badRequest("Nema više preostalih seansi za ovu varijantu u paketu");

  return purchase;
}

// Claims one session the moment a booking is actually made (pending/confirmed) -
// called INSIDE appointment.service.js's booking transaction, so a reservation and
// its Appointment always succeed or fail together. Doesn't touch sessionsUsed - that
// only happens on completion (commitSession). A cancelled/rejected booking calls
// releaseSession() to give the slot back.
export async function reserveSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const purchase = await packagePurchaseRepo.findPackagePurchaseDocById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");

  const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
  if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");
  if (availableSessions(item) <= 0) badRequest("Nema više preostalih seansi za ovu varijantu u paketu");

  item.sessionsReserved += 1;
  await purchase.save({ session });
  logInfo("Package purchase session reserved", { packagePurchaseId, servicePackageId });
  return purchase;
}

// Gives a reserved-but-undelivered session back - called when a package-covered
// appointment is cancelled or rejected before ever being completed.
export async function releaseSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const purchase = await packagePurchaseRepo.findPackagePurchaseDocById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");

  const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
  if (!item) return purchase; // nothing to release - shouldn't normally happen

  item.sessionsReserved = Math.max(0, item.sessionsReserved - 1);
  await purchase.save({ session });
  logInfo("Package purchase session released", { packagePurchaseId, servicePackageId });
  return purchase;
}

// Converts a reservation into an actually-delivered session - called ONLY when an
// appointment transitions into "completed". Moves 1 unit from reserved to used;
// marks the whole purchase "completed" once every item is fully used.
export async function commitSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const purchase = await packagePurchaseRepo.findPackagePurchaseDocById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");

  const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
  if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");

  item.sessionsReserved = Math.max(0, item.sessionsReserved - 1);
  item.sessionsUsed += 1;

  if (purchase.items.every((i) => i.sessionsUsed >= i.sessionsTotal)) {
    purchase.status = "completed";
  }

  await purchase.save({ session });
  logInfo("Package purchase session committed (delivered)", { packagePurchaseId, servicePackageId, status: purchase.status });
  return purchase;
}

export async function cancelPurchase(packagePurchaseId, adminId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const updated = await packagePurchaseRepo.updatePackagePurchaseById(packagePurchaseId, { status: "cancelled" });
  if (!updated) notFound("Kupljeni paket");
  logInfo("Package purchase cancelled", { packagePurchaseId, adminId });
  const purchase = await getPurchaseById(updated._id);
  eventEmitter.emit("package_purchase:cancelled", { packagePurchaseId: updated._id.toString() });
  return purchase;
}

export async function updatePurchase(packagePurchaseId, { expiresAt, notes } = {}) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const updateData = {};
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt || null;
  if (notes !== undefined) updateData.notes = notes;

  const updated = await packagePurchaseRepo.updatePackagePurchaseById(packagePurchaseId, updateData);
  if (!updated) notFound("Kupljeni paket");
  logInfo("Package purchase updated", { packagePurchaseId, updatedFields: Object.keys(updateData) });
  return getPurchaseById(updated._id);
}

export async function deletePurchase(packagePurchaseId, adminId) {
  if (!packagePurchaseId) validationError("packagePurchaseId");
  const existing = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId);
  if (!existing) notFound("Kupljeni paket");
  await packagePurchaseRepo.deletePackagePurchaseById(packagePurchaseId);
  logInfo("Package purchase deleted", { packagePurchaseId, adminId });
  return { success: true };
}

export default {
  createPurchaseForUser,
  getPurchaseById,
  listPurchasesForUser,
  listPurchases,
  findUsablePurchaseForService,
  assertUsablePurchase,
  reserveSession,
  releaseSession,
  commitSession,
  cancelPurchase,
  updatePurchase,
  deletePurchase,
};