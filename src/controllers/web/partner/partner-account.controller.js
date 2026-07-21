import partnerService from "../../../services/partner.service.js";
import payoutRequestService from "../../../services/payout-request.service.js";
import couponRepo from "../../../repositories/coupon.repository.js";
import commissionRepo from "../../../repositories/commission-entry.repository.js";
import serviceService from "../../../services/service.service.js";
import packageService from "../../../services/package.service.js";
import * as productService from "../../../services/product.service.js";
import {
  preparePartnerDashboardData,
  preparePartnerCommissionsTabData,
} from "../../../presenters/partner/partner-account.presenter.js";
import { logError, logInfo, logWarn } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

const BASE_URL = process.env.BASE_URL || "https://beautymedica.rs";

async function getOwnPartnerId(req) {
  const partner = await partnerService.findPartnerByUserId(req.session.user.id);
  return partner?._id?.toString();
}

export async function dashboard(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    const partner = await partnerService.getPartnerById(partnerId, "partner", "detail");
    const balance = await payoutRequestService.getBalance("partner", partnerId);
    const coupons = await couponRepo.findCoupons({ filters: { partner: partnerId }, limit: 10 });
    const recentCommissions = await commissionRepo.findCommissionEntries({ filters: { partner: partnerId }, limit: 5 });

    const viewData = preparePartnerDashboardData({ partner, balance, coupons: coupons.data, recentCommissions: recentCommissions.data });

    return res.render("partner/dashboard", {
      pageTitle: "Moj partnerski nalog",
      pageDescription: "Pregled provizije i referalnog linka",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[dashboard] Greška pri učitavanju partnerskog dashboard-a", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function commissions(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    const { page = 1, limit = 10 } = req.query;

    const result = await commissionRepo.findCommissionEntries({
      filters: { partner: partnerId },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePartnerCommissionsTabData(result, req.query);

    return res.render("partner/commissions", {
      pageTitle: "Moja provizija",
      pageDescription: "Istorija zarađene provizije",
      data: viewData,
    });
  } catch (error) {
    logError("[commissions] Greška pri učitavanju istorije provizije", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function requestPayout(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);

    if (req.validationErrors) {
      logWarn("[requestPayout] Validacione greške", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), "/moj-partner-nalog");
    }

    await payoutRequestService.requestPayout("partner", partnerId, Number(req.body.amount));
    logInfo(`[requestPayout] Partner zatražio isplatu`, { partnerId, amount: req.body.amount });
    return flashAndRedirect(req, res, "success", "Zahtev za isplatu je poslat", "/moj-partner-nalog");
  } catch (error) {
    logError("[requestPayout] Greška pri slanju zahteva za isplatu", error, { userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/moj-partner-nalog");
    }
    next(error);
  }
}

// the "catalog" - browsable services/packages/products, each with a ready-to-copy
// referral link so the partner doesn't have to manually append ?code= themselves
export async function catalog(req, res, next) {
  try {
    const partnerId = await getOwnPartnerId(req);
    const coupons = await couponRepo.findCoupons({ filters: { partner: partnerId }, limit: 1 });
    const code = coupons.data[0]?.code || null;

    const [services, packages, products] = await Promise.all([
      serviceService.listServices({ limit: 50 }),
      packageService.listPackages({ limit: 50 }),
      productService.listPublicProducts({ limit: 50 }),
    ]);

    const withLink = (items, path) =>
      items.map((item) => ({ ...item, referralLink: code ? `${BASE_URL}${path}/${item.slug}?code=${encodeURIComponent(code)}` : null }));

    return res.render("partner/catalog", {
      pageTitle: "Katalog za deljenje",
      pageDescription: "Usluge, paketi i proizvodi sa vašim referalnim linkom",
      data: {
        hasCode: !!code,
        services: withLink(services.data, "/usluge"),
        packages: withLink(packages.data, "/paketi"),
        products: withLink(products.data, "/prodavnica"),
      },
    });
  } catch (error) {
    logError("[catalog] Greška pri učitavanju kataloga za partnera", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export default { dashboard, commissions, requestPayout, catalog };