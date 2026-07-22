import * as partnerService from "../../../../services/partner.service.js";
import * as userService from "../../../../services/user.service.js";
import partnerRepo from "../../../../repositories/partner.repository.js";
import payoutRequestService from "../../../../services/payout-request.service.js";
import couponService from "../../../../services/coupon.service.js";
import commissionService from "../../../../services/commission.service.js";
import { preparePartnerListData, preparePartnerDetailsData, preparePartnerFormData } from "../../../../presenters/admin/auth/partner.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

async function loadFormOptions() {
  const [users, existingPartnerUserIds] = await Promise.all([
    userService.listUsers({ role: undefined, status: "active", limit: 200 }),
    partnerRepo.findAllPartnerUserIds(),
  ]);

  // exclude users who already have a Partner profile - not because an employee or
  // admin can't also be a partner (the role-priority safeguard in
  // partnerService.createPartner handles that fine), but so admin doesn't select
  // someone here and immediately hit the duplicate-profile conflict error
  const existingSet = new Set(existingPartnerUserIds);
  const userOptions = users.data.filter((u) => !existingSet.has(u.id)).map((u) => ({ value: u.id, label: `${u.imePrezime} (${u.email})` }));

  return { userOptions };
}

export async function listPartners(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await partnerService.listPartners({
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePartnerListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Partneri",
      pageDescription: "Pregled svih partnera",
      data: viewData,
    });
  } catch (error) {
    logError("[listPartners] Greška pri učitavanju liste partnera", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function partnerDetails(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await partnerService.getPartnerById(partnerId, "admin", "detail");
    const balance = await payoutRequestService.getBalance("partner", partnerId);
    const coupons = await couponService.listCouponsForPartner(partnerId);
    const commissionsResult = await commissionService.listCommissionsForEarner({ partner: partnerId, limit: 10 });
    const viewData = preparePartnerDetailsData(partner, balance, coupons, commissionsResult.data);

    return res.render("admin/_details", {
      pageTitle: `Partner - ${partner.korisnik.imePrezime}`,
      pageDescription: partner.korisnik.email,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[partnerDetails] Greška pri učitavanju detalja partnera", error, {
      partnerId: req.params.partnerId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newPartnerForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = preparePartnerFormData(null, options);
    return res.render("admin/_form", {
      pageTitle: "Novi partner",
      pageDescription: "Kreiraj profil partnera",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newPartnerForm] Greška pri prikazu forme za novog partnera", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editPartnerForm(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await partnerService.getPartnerForEdit(partnerId);
    const options = await loadFormOptions();
    const formData = preparePartnerFormData(partner, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${partner.imePrezime}`,
      pageDescription: partner.email,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editPartnerForm] Greška pri učitavanju forme za izmenu partnera", error, {
      partnerId: req.params.partnerId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function createPartner(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createPartner] Validacione greške pri kreiranju partnera", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = preparePartnerFormData(null, options);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi partner",
        pageDescription: "Kreiraj profil partnera",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const partner = await partnerService.createPartner({ ...req.body, commissionRate: Number(req.body.commissionRate) });
    logInfo(`[createPartner] Partner kreiran za korisnika #${req.body.userId}`, { partnerId: partner.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Partner je uspešno kreiran", `/admin/partneri/detalji/${partner.id}`);
  } catch (error) {
    logError("[createPartner] Greška pri kreiranju partnera", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const options = await loadFormOptions();
      const formData = preparePartnerFormData(null, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi partner",
        pageDescription: "Kreiraj profil partnera",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updatePartner(req, res, next) {
  try {
    const { partnerId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updatePartner] Validacione greške za partnerId=${partnerId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const partner = await partnerService.getPartnerForEdit(partnerId);
      const options = await loadFormOptions();
      const formData = preparePartnerFormData(partner, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${partner.imePrezime}`,
        pageDescription: partner.email,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const updated = await partnerService.updatePartnerById(partnerId, {
      ...req.body,
      ...(req.body.commissionRate !== undefined ? { commissionRate: Number(req.body.commissionRate) } : {}),
    });
    logInfo(`[updatePartner] Partner #${partnerId} ažuriran`, { partnerId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Partner je uspešno ažuriran", `/admin/partneri/detalji/${updated.id}`);
  } catch (error) {
    logError("[updatePartner] Greška pri ažuriranju partnera", error, {
      partnerId: req.params.partnerId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const partner = await partnerService.getPartnerForEdit(req.params.partnerId).catch(() => null);
      const options = await loadFormOptions();
      const formData = preparePartnerFormData(partner, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: partner ? `Izmena - ${partner.imePrezime}` : "Izmena partnera",
        pageDescription: partner?.email || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deletePartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    await partnerService.deletePartnerById(partnerId);
    logInfo(`[deletePartner] Partner #${partnerId} obrisan`, { partnerId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Partner je uspešno obrisan", "/admin/partneri");
  } catch (error) {
    logError("[deletePartner] Greška pri brisanju partnera", error, { partnerId: req.params.partnerId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/partneri");
    }
    next(error);
  }
}

export default {
  listPartners,
  partnerDetails,
  newPartnerForm,
  editPartnerForm,
  createPartner,
  updatePartner,
  deletePartner,
};