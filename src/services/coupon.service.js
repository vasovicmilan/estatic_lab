import couponRepo from "../repositories/coupon.repository.js";
import productService from "./product.service.js";
import categoryService from "./category.service.js";
import { mapCouponsForAdminList, mapCouponForAdminDetail, mapCouponForEdit } from "../mappers/coupon.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { WELCOME_COUPON_CODE, WELCOME_COUPON_DISCOUNT_VALUE } from "../config/marketing.config.js";
import { formatMoney } from "../utils/price.util.js";

export async function listCoupons({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await couponRepo.findCoupons({ search, limit, page, filters });
  return { data: mapCouponsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getCouponById(couponId) {
  if (!couponId) validationError("couponId");
  const coupon = await couponRepo.findCouponById(couponId);
  if (!coupon) notFound("Kupon");
  const mapped = mapCouponForAdminDetail(coupon);

  // Enrich each excluded category with how much of the catalog it actually
  // reaches once subcategories are expanded (see resolveProductCouponEligibility's
  // own descendant expansion) - a broad parent category can silently exclude
  // far more than an admin reading just its name would expect. Only bothers
  // with the extra queries when the coupon actually has exclusions configured.
  if (mapped.iskljuceneKategorijeArtikala.length > 0) {
    const [totalActiveProducts, brojevi] = await Promise.all([
      productService.countAllActiveProducts(),
      Promise.all(
        mapped.iskljuceneKategorijeArtikala.map(async (cat) => {
          const descendantIds = await categoryService.getCategoryAndDescendantIds(cat.id, "product");
          return productService.countProductsInCategories(descendantIds);
        })
      ),
    ]);
    mapped.iskljuceneKategorijeArtikala = mapped.iskljuceneKategorijeArtikala.map((cat, i) => ({
      ...cat,
      brojIskljucenihProizvoda: brojevi[i],
      ukupnoProizvodaUProdavnici: totalActiveProducts,
    }));
  }

  return mapped;
}

export async function getCouponForEdit(couponId) {
  if (!couponId) validationError("couponId");
  const coupon = await couponRepo.findCouponById(couponId);
  if (!coupon) notFound("Kupon");
  return mapCouponForEdit(coupon);
}

export async function createCoupon(data) {
  if (!data) validationError("data");
  if (!data.code) validationError("code");
  if (!data.discountType) validationError("discountType");
  if (data.discountValue == null) validationError("discountValue");

  const existing = await couponRepo.findCouponByCode(data.code);
  if (existing) conflict("Kupon sa ovim kodom već postoji");

  const created = await couponRepo.createCoupon({ ...data, code: data.code.toUpperCase().trim() });
  logInfo("Coupon created", { couponId: created._id, code: created.code });
  return getCouponById(created._id);
}

export async function updateCouponById(couponId, data) {
  if (!couponId) validationError("couponId");
  const existing = await couponRepo.findCouponById(couponId);
  if (!existing) notFound("Kupon");

  if (data.code && data.code.toUpperCase() !== existing.code) {
    const conflicting = await couponRepo.findCouponByCode(data.code);
    if (conflicting) conflict("Kupon sa ovim kodom već postoji");
  }

  const updated = await couponRepo.updateCouponById(couponId, data.code ? { ...data, code: data.code.toUpperCase().trim() } : data);
  logInfo("Coupon updated", { couponId, updatedFields: Object.keys(data) });
  return getCouponById(updated._id);
}

export async function deleteCouponById(couponId) {
  if (!couponId) validationError("couponId");
  const existing = await couponRepo.findCouponById(couponId);
  if (!existing) notFound("Kupon");
  await couponRepo.deleteCouponById(couponId);
  logInfo("Coupon deleted", { couponId });
  return { success: true };
}

/**
 * Idempotently makes sure the shared "welcome" coupon (WELCOME_COUPON_CODE)
 * exists, creating it with sane defaults on first call and doing nothing on
 * every call after that. Called from email.listener.js right before a
 * registration welcome email goes out - lazily-on-first-use rather than a
 * seed script, so it self-heals if the coupon is ever deleted by mistake.
 *
 * One shared code for every new user, not a unique code minted per user: the
 * existing maxUsesPerUser (default 1, see coupon.model.js) already enforces
 * "once per person" at redemption time via usageHistory, which makes a
 * per-user code unnecessary - it would just be the same protection with more
 * documents to manage. Deliberately created with productDiscount left null
 * and applicableServices/applicablePackages left empty, so it applies to
 * every service/package but, per coupon.model.js's restrictive-by-default
 * rule, never to product orders - matching the "usluge i paketi" scope this
 * coupon is meant for. If that scope is ever wrong for an already-created
 * coupon, edit it directly in the admin panel (Marketing > Kuponi) - this
 * function only ever sets the initial defaults, it never overwrites an
 * existing coupon on later calls.
 */
export async function ensureWelcomeCoupon() {
  const existing = await couponRepo.findCouponByCode(WELCOME_COUPON_CODE);
  if (existing) return existing;

  const created = await couponRepo.createCoupon({
    code: WELCOME_COUPON_CODE,
    discountType: "percentage",
    discountValue: WELCOME_COUPON_DISCOUNT_VALUE,
    maxDiscountAmount: null,
    minValue: 0,
    maxUses: null,
    maxUsesPerUser: 1,
    applicableServices: [],
    applicablePackages: [],
    productDiscount: null,
    isActive: true,
  });
  logInfo("Welcome coupon auto-created on first use", { couponId: created._id, code: created.code });
  return created;
}

/**
 * Read-only validation shared by both redemption paths (appointment booking, package
 * purchase). Returns { coupon, discountAmount } on success, throws AppError otherwise.
 * `userId` may be null (a brand-new guest hasn't been created yet at this point) - in
 * that case the per-user limit simply can't be checked yet and is skipped; it's re-verified
 * implicitly by `redeemCoupon`'s atomic push once the user does exist, so a determined
 * double-submit still can't bypass the global `maxUses` cap, only (in the rare
 * brand-new-guest edge case) the per-user cap on their very first booking.
 */
/**
 * Read-only validation shared by both redemption paths (appointment booking, package
 * purchase). Returns { coupon, discountAmount } on success, throws AppError otherwise.
 * `userId` may be null (a brand-new guest hasn't been created yet at this point) - in
 * that case the per-user limit simply can't be checked yet and is skipped; it's re-verified
 * implicitly by `redeemCoupon`'s atomic push once the user does exist, so a determined
 * double-submit still can't bypass the global `maxUses` cap, only (in the rare
 * brand-new-guest edge case) the per-user cap on their very first booking.
 *
 * "order" (products/shop) is handled on a completely separate rule set from
 * "appointment"/"packagePurchase" (services/packages) - see coupon.model.js's
 * productDiscount block. A coupon with no productDiscount configured simply
 * cannot be redeemed for an order at all, regardless of what its main
 * discountType/discountValue says - there is no fallback to the services/
 * packages rules for a product purchase.
 */
async function validateCoupon(code, { userId = null, kind, targetId, value } = {}) {
  if (!code) validationError("code");

  const coupon = await couponRepo.findCouponByCode(code);
  if (!coupon) badRequest("Kupon ne postoji");
  if (!coupon.isActive) badRequest("Kupon nije aktivan");

  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) badRequest("Kupon još nije aktivan");
  if (coupon.validUntil && now > new Date(coupon.validUntil)) badRequest("Kupon je istekao");

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    badRequest("Kupon je dostigao maksimalan broj upotreba");
  }

  if (userId && coupon.maxUsesPerUser) {
    const userUsageCount = await couponRepo.countCouponUsagesByUser(coupon._id, userId);
    if (userUsageCount >= coupon.maxUsesPerUser) {
      badRequest("Već ste iskoristili ovaj kupon maksimalan broj puta");
    }
  }

  if (kind === "order") {
    return await validateProductDiscount(coupon, { targetId, value });
  }
  return validateServiceOrPackageDiscount(coupon, { kind, targetId, value });
}

function computeDiscount(discountType, discountValue, maxDiscountAmount, value) {
  const discountAmount = discountType === "percentage" ? Math.round((value * discountValue) / 100) : discountValue;
  const capped = maxDiscountAmount != null ? Math.min(discountAmount, maxDiscountAmount) : discountAmount;
  return Math.min(capped, value);
}

function validateServiceOrPackageDiscount(coupon, { kind, targetId, value }) {
  if (coupon.minValue && value < coupon.minValue) {
    badRequest(`Kupon važi za iznos od najmanje ${formatMoney(coupon.minValue)}`);
  }

  if (kind === "appointment") {
    if (coupon.applicableServices?.length && !coupon.applicableServices.some((s) => String(s) === String(targetId))) {
      badRequest("Kupon ne važi za izabranu uslugu");
    }
  } else if (kind === "packagePurchase") {
    if (coupon.applicablePackages?.length && !coupon.applicablePackages.some((p) => String(p) === String(targetId))) {
      badRequest("Kupon ne važi za izabrani paket");
    }
  }

  const discountAmount = computeDiscount(coupon.discountType, coupon.discountValue, coupon.maxDiscountAmount, value);
  return { coupon, discountAmount };
}

/**
 * Resolves a coupon's product-discount targeting rules into ready-to-check sets:
 * the applicable-products whitelist (null = no restriction, every product is
 * covered) and the full excluded-category id set, expanded to include every
 * DESCENDANT of each category the admin picked - so excluding a parent like
 * "Aparati i oprema" also excludes everything underneath it without the admin
 * having to individually list every child category, same expansion
 * category.service.js's getCategoryAndDescendantIds already provides
 * everywhere else category hierarchy matters in this app.
 *
 * Shared by both checkout validation (validateProductDiscount below) and the
 * partner catalog (partner-account.controller.js's catalog()), so a product's
 * eligibility is computed identically in both places - a partner should never
 * see a shareable-looking referral link for something checkout would actually
 * reject at the register.
 */
export async function resolveProductCouponEligibility(productDiscount) {
  if (!productDiscount) return { applicableProductIds: new Set(), excludedCategoryIds: new Set() };

  const applicableProductIds = productDiscount.applicableProducts?.length
    ? new Set(productDiscount.applicableProducts.map((p) => (typeof p === "object" ? (p._id || p).toString() : String(p))))
    : null;

  let excludedCategoryIds = new Set();
  if (productDiscount.excludedCategories?.length) {
    const rawIds = productDiscount.excludedCategories.map((c) => (typeof c === "object" ? (c._id || c).toString() : String(c)));
    const expanded = await Promise.all(rawIds.map((catId) => categoryService.getCategoryAndDescendantIds(catId, "product")));
    excludedCategoryIds = new Set(expanded.flat().map(String));
  }

  return { applicableProductIds, excludedCategoryIds };
}

/**
 * Pure check against the sets resolveProductCouponEligibility produced - whether
 * ONE product (by id + its own category ids) is actually covered. Category
 * exclusion is checked FIRST and wins unconditionally, even over an explicit
 * applicableProducts match - see coupon.model.js's own comment on
 * excludedCategories for why: an expensive device the admin flagged as "needs
 * its own negotiation" should never become discountable by accident just
 * because someone also whitelisted it individually.
 */
export function isProductCouponEligible({ id, categoryIds = [] }, { applicableProductIds, excludedCategoryIds }) {
  if (categoryIds.some((c) => excludedCategoryIds.has(String(c)))) return false;
  if (applicableProductIds && !applicableProductIds.has(String(id))) return false;
  return true;
}

async function validateProductDiscount(coupon, { targetId, value }) {
  const productDiscount = coupon.productDiscount;
  if (!productDiscount) badRequest("Kupon ne važi za proizvode");

  if (productDiscount.minOrderValue && value < productDiscount.minOrderValue) {
    badRequest(`Kupon važi za porudžbine od najmanje ${formatMoney(productDiscount.minOrderValue)}`);
  }

  // targetId is an array of product ids for an order (multiple line items,
  // unlike appointment/packagePurchase which only ever have one target)
  const targetIds = Array.isArray(targetId) ? targetId : [targetId];
  const eligibility = await resolveProductCouponEligibility(productDiscount);

  // Category exclusion is checked against what's ACTUALLY in the cart, not
  // just the coupon's configured category list - so the error can name the
  // specific category the flagged item is really in (its own, most specific
  // category - not necessarily the parent the admin excluded), instead of a
  // vague "this code doesn't work" the customer has to guess the reason for.
  if (eligibility.excludedCategoryIds.size > 0) {
    const products = await productService.findProductsForCouponCheck(targetIds);
    const matchedCategoryIds = new Set();
    for (const product of products) {
      for (const catId of product.categoryIds) {
        if (eligibility.excludedCategoryIds.has(catId)) matchedCategoryIds.add(catId);
      }
    }
    if (matchedCategoryIds.size > 0) {
      const categories = await categoryService.getCategoriesByIds([...matchedCategoryIds]);
      const names = categories.map((c) => c.naziv).join(", ") || "izabranu kategoriju";
      badRequest(`Kupon ne važi za sledeće artikle u korpi (kategorija: ${names}) - uklonite ih iz korpe ili nas kontaktirajte za poseban dogovor.`);
    }
  }

  // valid if productDiscount has no restriction, or at least one item in the cart matches
  if (eligibility.applicableProductIds) {
    const matches = targetIds.some((id) => eligibility.applicableProductIds.has(String(id)));
    if (!matches) badRequest("Kupon ne važi ni za jedan proizvod u porudžbini");
  }

  const discountAmount = computeDiscount(
    productDiscount.discountType,
    productDiscount.discountValue,
    productDiscount.maxDiscountAmount,
    value
  );
  return { coupon, discountAmount };
}

// unchanged external behavior/signature from before - every existing caller/test keeps working
export async function validateCouponForBooking(code, { userId = null, serviceId, appointmentValue } = {}) {
  return validateCoupon(code, { userId, kind: "appointment", targetId: serviceId, value: appointmentValue });
}

export async function validateCouponForPackagePurchase(code, { userId = null, packageId, purchaseValue } = {}) {
  return validateCoupon(code, { userId, kind: "packagePurchase", targetId: packageId, value: purchaseValue });
}

export async function validateCouponForOrder(code, { userId = null, productIds = [], orderValue } = {}) {
  return validateCoupon(code, { userId, kind: "order", targetId: productIds, value: orderValue });
}

// atomic redemption - called from inside appointment.service.js's booking transaction,
// package-purchase.service.js when a coupon discounts a package purchase, or
// order.service.js when a coupon discounts an order
export async function redeemCoupon(
  couponId,
  { userId, appointmentId = null, packagePurchaseId = null, orderId = null, discountAmount },
  { session } = {}
) {
  const updated = await couponRepo.redeemCoupon(
    couponId,
    { userId, appointmentId, packagePurchaseId, orderId, discountAmount },
    { session }
  );
  // The repository's query now conditions the update on usedCount < maxUses (see its
  // own comment) - null here means either the coupon no longer exists, or - the case
  // this is actually guarding against - someone else's concurrent redemption won the
  // race and used up the last available slot between this caller's earlier
  // validateCoupon() check and this call. Either way, the caller's whole operation
  // (booking, package purchase, order) must abort rather than proceed as if the
  // discount was actually applied.
  if (!updated) {
    conflict("Kupon je upravo dostigao maksimalan broj upotreba - pokušajte ponovo bez kupona ili osvežite stranicu");
  }
  return updated;
}

/**
 * A partner's own referral coupon(s), in a clean minimal shape - not the
 * Serbian admin-display shape mapCouponsForAdminList produces (translated
 * strings, pre-formatted discount text), since the callers here need the raw
 * code for building URLs and raw discountType/discountValue for their own
 * formatting. Used by both the admin's partner detail page and the partner's
 * own dashboard/catalog, so neither has to import coupon.repository.js directly.
 */
export async function listCouponsForPartner(partnerId) {
  if (!partnerId) validationError("partnerId");
  const result = await couponRepo.findCoupons({ filters: { partner: partnerId }, limit: 20 });
  return result.data.map((c) => ({
    id: c._id.toString(),
    code: c.code,
    discountType: c.discountType,
    discountValue: c.discountValue,
    // empty array = "applies to every service/package" (see coupon.model.js's
    // own comment) - the raw ObjectId lists are resolved into readable names
    // one layer up (partner-account.controller.js), same reasoning as
    // FAQPage JSON-LD being assembled at the controller layer elsewhere: this
    // service function shouldn't need to know about service.service.js/
    // package.service.js just to label a coupon's own scope for display.
    applicableServices: (c.applicableServices || []).map((s) => s.toString()),
    applicablePackages: (c.applicablePackages || []).map((p) => p.toString()),
    // null when this coupon doesn't cover product/shop orders at all (see
    // coupon.model.js's own comment on productDiscount - absence, not an
    // empty object, is the "not enabled for this coupon" signal). Exposed
    // here so the partner dashboard/catalog can show artikli-specific info
    // (and links) only for coupons that actually discount them, instead of
    // always showing a products section that might not apply any discount.
    productDiscount: c.productDiscount
      ? {
          discountType: c.productDiscount.discountType,
          discountValue: c.productDiscount.discountValue,
          // raw ids, not resolved names - partner-account.controller.js's
          // catalog() feeds these straight into resolveProductCouponEligibility
          // to filter the browsable product list down to what's actually
          // discountable, exactly the same way checkout validation does
          applicableProducts: (c.productDiscount.applicableProducts || []).map((p) => (p._id || p).toString()),
          excludedCategories: (c.productDiscount.excludedCategories || []).map((cat) => (cat._id || cat).toString()),
        }
      : null,
    validUntil: c.validUntil,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    isActive: c.isActive,
  }));
}

export default {
  listCoupons,
  getCouponById,
  getCouponForEdit,
  createCoupon,
  updateCouponById,
  deleteCouponById,
  ensureWelcomeCoupon,
  validateCouponForBooking,
  validateCouponForPackagePurchase,
  validateCouponForOrder,
  redeemCoupon,
  listCouponsForPartner,
  resolveProductCouponEligibility,
  isProductCouponEligible,
};