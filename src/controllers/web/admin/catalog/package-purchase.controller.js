import * as packagePurchaseService from "../../../../services/package-purchase.service.js";
import * as userService from "../../../../services/user.service.js";
import * as packageService from "../../../../services/package.service.js";
import {
  preparePackagePurchaseListData,
  preparePackagePurchaseDetailsData,
  preparePackagePurchaseFormData,
} from "../../../../presenters/admin/marketing/package-purchase.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

async function loadFormOptions() {
  const [users, packages] = await Promise.all([
    userService.listUsers({ status: "active", limit: 200 }),
    packageService.listPackages({ limit: 200 }),
  ]);

  return {
    userOptions: users.data.map((u) => ({ value: u.id, label: `${u.imePrezime} (${u.email})` })),
    packageOptions: packages.data.map((p) => ({ value: p.id, label: p.naziv })),
  };
}

export async function listPackagePurchases(req, res, next) {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;

    const result = await packagePurchaseService.listPurchases({
      filters: { userId: userId || undefined, status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePackagePurchaseListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: "Kupljeni paketi",
      pageDescription: "Pregled svih kupljenih paketa",
      data: viewData,
    });
  } catch (error) {
    logError("[listPackagePurchases] Greška pri učitavanju liste kupljenih paketa", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function packagePurchaseDetails(req, res, next) {
  try {
    const { packagePurchaseId } = req.params;
    const purchase = await packagePurchaseService.getPurchaseById(packagePurchaseId);
    const viewData = preparePackagePurchaseDetailsData(purchase);

    return res.render("admin/_details", {
      pageTitle: `Kupljeni paket — ${purchase.paket}`,
      pageDescription: purchase.korisnik,
      data: viewData,
    });
  } catch (error) {
    logError("[packagePurchaseDetails] Greška pri učitavanju detalja kupljenog paketa", error, {
      packagePurchaseId: req.params.packagePurchaseId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newPackagePurchaseForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = preparePackagePurchaseFormData({ ...options, prefillUserId: req.query.userId || "" });
    return res.render("admin/_form", {
      pageTitle: "Dodeli paket",
      pageDescription: "Dodeli kupljeni paket korisniku",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newPackagePurchaseForm] Greška pri prikazu forme za dodelu paketa", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function createPackagePurchase(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createPackagePurchase] Validacione greške pri dodeli paketa", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = preparePackagePurchaseFormData({ ...options, prefillUserId: req.body.userId || "" });
      return res.status(400).render("admin/_form", {
        pageTitle: "Dodeli paket",
        pageDescription: "Dodeli kupljeni paket korisniku",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const { userId, packageId, expiresAt, pricePaid, couponCode, notes } = req.body;
    const purchase = await packagePurchaseService.createPurchaseForUser(userId, packageId, req.session?.user?.id, {
      expiresAt: expiresAt || null,
      pricePaid: pricePaid ? parseFloat(pricePaid) : null,
      couponCode: couponCode || null,
      notes: notes || "",
    });

    logInfo(`[createPackagePurchase] Paket dodeljen korisniku #${userId}`, { packagePurchaseId: purchase.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Paket je uspešno dodeljen korisniku", `/admin/kupljeni-paketi/detalji/${purchase.id}`);
  } catch (error) {
    logError("[createPackagePurchase] Greška pri dodeli paketa", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404) {
      const options = await loadFormOptions();
      const formData = preparePackagePurchaseFormData({ ...options, prefillUserId: req.body.userId || "" });
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Dodeli paket",
        pageDescription: "Dodeli kupljeni paket korisniku",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function cancelPackagePurchase(req, res, next) {
  try {
    const { packagePurchaseId } = req.params;
    await packagePurchaseService.cancelPurchase(packagePurchaseId, req.session?.user?.id);
    logInfo(`[cancelPackagePurchase] Kupljeni paket #${packagePurchaseId} otkazan`, { packagePurchaseId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Kupljeni paket je otkazan", `/admin/kupljeni-paketi/detalji/${packagePurchaseId}`);
  } catch (error) {
    logError("[cancelPackagePurchase] Greška pri otkazivanju kupljenog paketa", error, {
      packagePurchaseId: req.params.packagePurchaseId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/kupljeni-paketi/detalji/${req.params.packagePurchaseId}`);
    }
    next(error);
  }
}

export default {
  listPackagePurchases,
  packagePurchaseDetails,
  newPackagePurchaseForm,
  createPackagePurchase,
  cancelPackagePurchase,
};