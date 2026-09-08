import mongoose from "mongoose";
import eventEmitter from "../events/event.emitter.js";
import packagePurchaseRepo from "../repositories/package-purchase.repository.js";
import packageService from "./package.service.js";
import serviceService from "./service.service.js";
import userService from "./user.service.js";
import couponService from "./coupon.service.js";
import { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail } from "../mappers/package-purchase.mapper.js";
import { validationError, notFound, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo, logWarn } from "../utils/logger.util.js";

const adminPopulate = [
  { path: "package", select: "name" },
  { path: "user", select: "firstName lastName email" },
  { path: "items.service", select: "name packages" }, // packages needed to resolve the variant name in the mapper
];

// resolves each item's current a la carte unit price by fetching its service and
// finding the matching variant - deduplicates service fetches since a package
// could include the same service more than once (different variants) or
// reference several distinct services across its items
async function resolveItemUnitPrices(items, pkg) {
  const uniqueServiceIds = [...new Set(items.map((item) => item.service.toString()))];
  const services = await Promise.all(uniqueServiceIds.map((id) => serviceService.getServiceByIdRaw(id)));
  const serviceById = new Map(uniqueServiceIds.map((id, i) => [id, services[i]]));

  // used only as a fallback below - an even split across every session in the
  // package, for the (hopefully rare) case where a specific variant reference
  // has gone stale since the package was created
  const totalSessions = items.reduce((sum, item) => sum + (item.sessions || 1), 0);
  const fallbackUnitPrice = totalSessions > 0 ? pkg.totalPrice / totalSessions : pkg.totalPrice;

  return items.map((item) => {
    const service = serviceById.get(item.service.toString());
    const variant = service?.packages?.find((p) => p._id.toString() === item.servicePackageId.toString());

    if (!variant) {
      // granting the customer their package is the actual business action here -
      // a stale variant reference (e.g. the underlying service was edited since
      // this package was created) must not block that just to get a more precise
      // commission number. Falls back to an even per-session split instead.
      logWarn("Package purchase: exact variant not found for pro-rating, falling back to even split", {
        packageId: pkg._id,
        serviceId: item.service,
        servicePackageId: item.servicePackageId,
        fallbackUnitPrice,
      });
      return { ...item, unitPrice: fallbackUnitPrice };
    }

    return { ...item, unitPrice: variant.totalPrice };
  });
}

// Admin action: grant a user a package they paid for outside the system (cash, card
// terminal, bank transfer). This is the ONLY way a PackagePurchase comes into
// existence - there is no self-serve purchase flow, by design (no payment integration).
export async function createPurchaseForUser(userId, packageId, adminId, { expiresAt = null, pricePaid = null, notes = "", couponCode = null } = {}) {
  if (!userId) validationError("userId");
  if (!packageId) validationError("packageId");
  if (!adminId) validationError("adminId");

  const pkg = await packageService.getPackageByIdRaw(packageId);
  if (!pkg) notFound("Paket");

  const originalPrice = pricePaid ?? pkg.totalPrice;
  let discountApplied = 0;
  let couponResult = null;

  if (couponCode) {
    couponResult = await couponService.validateCouponForPackagePurchase(couponCode, { userId, packageId, purchaseValue: originalPrice });
    discountApplied = couponResult.discountAmount;
  }

  const itemsWithPrices = await resolveItemUnitPrices(pkg.items, pkg);
  const items = itemsWithPrices.map((item) => ({
    service: item.service,
    servicePackageId: item.servicePackageId,
    sessionsTotal: item.sessions,
    sessionsUsed: 0,
    sessionsReserved: 0,
    unitPrice: item.unitPrice,
  }));

  const buyer = await userService.findUserById(userId);

  // BUG FIX: creating the purchase and redeeming its coupon used to be two
  // separate, unrelated writes - if redeemCoupon failed after the purchase had
  // already been created (a DB blip, or - since the fix in
  // coupon.repository.js's redeemCoupon - someone else's concurrent redemption
  // winning a maxUses race in the moments between this function's earlier
  // validateCouponForPackagePurchase() read and this point), the customer would
  // end up with a real, usable package that the coupon's usedCount/usageHistory
  // never reflects. Wrapping both writes in one transaction means either both
  // happen or neither does - a failed coupon redemption now aborts the whole
  // purchase rather than silently under-tracking coupon usage.
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      created = await packagePurchaseRepo.createPackagePurchase(
        {
          user: userId,
          userSnapshot: { firstName: buyer?.firstName || null, lastName: buyer?.lastName || null },
          package: packageId,
          items,
          originalPrice,
          discountApplied,
          pricePaid: Math.max(0, originalPrice - discountApplied),
          coupon: couponResult?.coupon._id || null,
          expiresAt,
          purchasedBy: adminId,
          notes,
        },
        { session }
      );

      if (couponResult) {
        await couponService.redeemCoupon(
          couponResult.coupon._id,
          { userId, packagePurchaseId: created._id, discountAmount: discountApplied },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
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

/**
 * Raw (unmapped) package purchase for commission.service.js's internal use only -
 * needs pricePaid and the coupon's partner, neither of which the mapped
 * admin-detail shape exposes in the right form. Same reasoning as
 * appointment.service.js's getAppointmentForCommission.
 */
export async function getPurchaseForCommission(packagePurchaseId) {
  return packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, {
    populateFields: [{ path: "coupon", populate: "partner" }],
  });
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
  const updated = await packagePurchaseRepo.reserveSessionAtomic(packagePurchaseId, servicePackageId, { session });
  if (updated) {
    logInfo("Package purchase session reserved", { packagePurchaseId, servicePackageId });
    return updated;
  }

  // The atomic update matched nothing - it's ambiguous WHY (purchase missing,
  // variant not covered, or genuinely no sessions left), so this read is purely
  // to produce the right error message. It plays no part in the actual
  // reserve-or-not decision, which the atomic update above already made safely.
  const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");
  const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
  if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");
  badRequest("Nema više preostalih seansi za ovu varijantu u paketu");
}

// Gives a reserved-but-undelivered session back - called when a package-covered
// appointment is cancelled or rejected before ever being completed.
//
// BUG FIX: used to read the whole document, mutate sessionsReserved in JS with
// Math.max(0, ...), then .save() it - a read-modify-write race under concurrency
// (see releaseSessionAtomic's own comment in package-purchase.repository.js).
// Now delegates to the atomic conditional update, same pattern as reserveSession
// above: the atomic update either succeeds outright, or - only to produce the
// right error message, playing no part in the actual decision - a read
// distinguishes "purchase missing" from "item missing" from "nothing reserved to
// release" (the last one silently returning the purchase unchanged, matching the
// old "nothing to release - shouldn't normally happen" behavior exactly).
export async function releaseSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const updated = await packagePurchaseRepo.releaseSessionAtomic(packagePurchaseId, servicePackageId, { session });
  if (updated) {
    logInfo("Package purchase session released", { packagePurchaseId, servicePackageId });
    return updated;
  }

  const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, { session });
  if (!purchase) notFound("Kupljeni paket");
  const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
  if (!item) return purchase; // nothing to release - shouldn't normally happen
  return purchase; // item exists but sessionsReserved was already 0 - nothing to release
}

// Converts a reservation into an actually-delivered session - called ONLY when an
// appointment transitions into "completed". Moves 1 unit from reserved to used;
// marks the whole purchase "completed" once every item is fully used.
//
// BUG FIX: same read-modify-write race as releaseSession above, same fix - the
// $inc on sessionsReserved/sessionsUsed now happens atomically in one operation
// (commitSessionAtomic), and the "mark the whole purchase completed" check is a
// separate, idempotent conditional update run right after (see
// markCompletedIfAllSessionsUsed's own comment) rather than a mutation on a
// JS object that then gets saved.
export async function commitSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const updated = await packagePurchaseRepo.commitSessionAtomic(packagePurchaseId, servicePackageId, { session });
  if (!updated) {
    const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, { session });
    if (!purchase) notFound("Kupljeni paket");
    const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
    if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");
    badRequest("Nema rezervisanu sesiju za ovu varijantu u paketu - ništa ne može biti isporučeno");
  }

  const completed = await packagePurchaseRepo.markCompletedIfAllSessionsUsed(packagePurchaseId, { session });
  logInfo("Package purchase session committed (delivered)", {
    packagePurchaseId,
    servicePackageId,
    status: completed?.status || updated.status,
  });
  return completed || updated;
}

// Undoes a commitSession - specifically for an admin reopening a "no_show"
// appointment back to "pending" (see appointment.service.js's
// transitionStatus). A no-show consumes the session on the spot, same as an
// actually-delivered "completed" visit (business rule: unannounced no-show
// forfeits the session, a timely cancellation doesn't) - so undoing that
// admin correction has to put the session back into "reserved", not release
// it to the general pool the way reopening a cancelled/rejected appointment
// does (reserveSession above). Also reverts the purchase's own "completed"
// status if this was the session that had tipped it there - see
// revertCompletedStatus's own comment.
export async function uncommitSession(packagePurchaseId, servicePackageId, { session } = {}) {
  const updated = await packagePurchaseRepo.uncommitSessionAtomic(packagePurchaseId, servicePackageId, { session });
  if (!updated) {
    const purchase = await packagePurchaseRepo.findPackagePurchaseById(packagePurchaseId, { session });
    if (!purchase) notFound("Kupljeni paket");
    const item = purchase.items.find((i) => String(i.servicePackageId) === String(servicePackageId));
    if (!item) badRequest("Ovaj paket ne pokriva izabranu varijantu usluge");
    badRequest("Nema iskorišćenu sesiju za ovu varijantu u paketu da bi se poništila");
  }

  const reverted = await packagePurchaseRepo.revertCompletedStatus(packagePurchaseId, { session });
  logInfo("Package purchase session un-committed (no-show reopened)", {
    packagePurchaseId,
    servicePackageId,
    status: reverted?.status || updated.status,
  });
  return reverted || updated;
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
  getPurchaseForCommission,
  listPurchasesForUser,
  listPurchases,
  findUsablePurchaseForService,
  assertUsablePurchase,
  reserveSession,
  releaseSession,
  commitSession,
  uncommitSession,
  cancelPurchase,
  updatePurchase,
  deletePurchase,
};