import partnerService from "../../../services/partner.service.js";
import payoutRequestService from "../../../services/payout-request.service.js";
import couponService from "../../../services/coupon.service.js";
import commissionService from "../../../services/commission.service.js";
import serviceService from "../../../services/service.service.js";
import packageService from "../../../services/package.service.js";
import * as productService from "../../../services/product.service.js";
import * as categoryService from "../../../services/category.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { BUSINESS } from "../../../config/business.config.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";
import { createEarnerListHandler } from "../../../utils/earner-listing.util.js";

const BASE_URL = BUSINESS.siteUrl;

// Mirrors controllers/web/partner/partner-account.controller.js - same services,
// same referral-link construction, same audit log actor shape (req.user).

async function getOwnPartnerId(req) {
  const partner = await partnerService.findPartnerByUserId(req.user.id);
  return partner?._id?.toString();
}

export async function dashboard(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    const partner = await partnerService.getPartnerById(partnerId, "partner", "detail");
    const balance = await payoutRequestService.getBalance("partner", partnerId);
    const coupons = await couponService.listCouponsForPartner(partnerId);
    const recentCommissions = await commissionService.listCommissionsForEarner({ partner: partnerId, limit: 5 });
    const payoutRequests = await payoutRequestService.listPayoutRequestsForEarner({ partner: partnerId, limit: 3 });

    // Same lazy name-lookup reasoning as the web controller - only resolved when a
    // coupon actually restricts itself to specific services/packages/categories.
    const needsNameLookup = coupons.some((c) => c.applicableServices.length > 0 || c.applicablePackages.length > 0);
    let serviceNamesById = {};
    let packageNamesById = {};
    if (needsNameLookup) {
      const [allServices, allPackagesResult] = await Promise.all([serviceService.getServicesForSelect(), packageService.listPackages({ limit: 200 })]);
      serviceNamesById = Object.fromEntries(allServices.map((s) => [s.id, s.naziv]));
      packageNamesById = Object.fromEntries(allPackagesResult.data.map((p) => [p.id, p.naziv]));
    }

    let categoryNamesById = {};
    const excludedCategoryIds = [...new Set(coupons.flatMap((c) => c.productDiscount?.excludedCategories || []))];
    if (excludedCategoryIds.length > 0) {
      const categories = await categoryService.getCategoriesByIds(excludedCategoryIds);
      categoryNamesById = Object.fromEntries(categories.map((c) => [c.id, c.naziv]));
    }

    return res.json({
      success: true,
      data: {
        partner,
        balance,
        coupons,
        serviceNamesById,
        packageNamesById,
        categoryNamesById,
        recentCommissions: recentCommissions.data,
        payoutRequests: payoutRequests.data,
      },
    });
  } catch (error) {
    logError("[api/partner/dashboard] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export const listCommissions = createEarnerListHandler({
  logPrefix: "api/partner",
  actionName: "listCommissions",
  earnerKind: "partner",
  resolveEarnerId: getOwnPartnerId,
  listFn: commissionService.listCommissionsForEarner,
  includeSourceType: true,
});

export const listPayouts = createEarnerListHandler({
  logPrefix: "api/partner",
  actionName: "listPayouts",
  earnerKind: "partner",
  resolveEarnerId: getOwnPartnerId,
  listFn: payoutRequestService.listPayoutRequestsForEarner,
});

export async function requestPayout(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    await payoutRequestService.requestPayout("partner", partnerId, Number(req.body.amount));

    logInfo("[api/partner/requestPayout] Partner zatražio isplatu", { partnerId, amount: req.body.amount });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "PAYOUT_REQUESTED",
      entity: { type: "Partner", id: partnerId },
      changes: { amount: { old: null, new: Number(req.body.amount) } },
    });

    return res.status(201).json({ success: true, data: { message: "Zahtev za isplatu je poslat." } });
  } catch (error) {
    logError("[api/partner/requestPayout] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function catalog(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    const coupons = await couponService.listCouponsForPartner(partnerId);
    const code = coupons[0]?.code || null;

    const productCoupon = coupons.find((c) => c.productDiscount);
    const hasProductDiscount = !!productCoupon;
    const productCode = productCoupon?.code || null;

    const eligibility = productCoupon ? await couponService.resolveProductCouponEligibility(productCoupon.productDiscount) : null;
    const productFilters = {};
    if (eligibility?.applicableProductIds) productFilters.ids = [...eligibility.applicableProductIds];
    if (eligibility?.excludedCategoryIds.size) productFilters.excludedCategories = [...eligibility.excludedCategoryIds];

    const { search = "", servicesPage = 1, packagesPage = 1, productsPage = 1 } = req.query;

    const [services, packages, products] = await Promise.all([
      serviceService.listServices({ search, limit: 10, page: parseInt(servicesPage, 10) || 1 }),
      packageService.listPackages({ search, limit: 10, page: parseInt(packagesPage, 10) || 1 }),
      hasProductDiscount
        ? productService.listPublicProducts({ search, filters: productFilters, limit: 10, page: parseInt(productsPage, 10) || 1 })
        : Promise.resolve({ data: [], page: 1, totalPages: 1 }),
    ]);

    const withLink = (items, path, linkCode) =>
      items.map((item) => ({ ...item, referralLink: linkCode ? `${BASE_URL}${path}/${item.slug}?code=${encodeURIComponent(linkCode)}` : null }));

    return res.json({
      success: true,
      data: {
        hasCode: !!code,
        hasProductDiscount,
        services: withLink(services.data, "/usluge", code),
        servicesMeta: { page: services.page, totalPages: services.totalPages },
        packages: withLink(packages.data, "/paketi", code),
        packagesMeta: { page: packages.page, totalPages: packages.totalPages },
        products: withLink(products.data, "/prodavnica", productCode),
        productsMeta: { page: products.page, totalPages: products.totalPages },
      },
    });
  } catch (error) {
    logError("[api/partner/catalog] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export default { dashboard, listCommissions, listPayouts, requestPayout, catalog };
