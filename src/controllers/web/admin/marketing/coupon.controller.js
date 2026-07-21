import * as couponService from "../../../../services/coupon.service.js";
import * as serviceService from "../../../../services/service.service.js";
import * as packageService from "../../../../services/package.service.js";
import * as productService from "../../../../services/product.service.js";
import partnerService from "../../../../services/partner.service.js";
import { prepareCouponListData, prepareCouponDetailsData, prepareCouponFormData } from "../../../../presenters/admin/marketing/coupon.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

async function loadFormOptions() {
  const [services, packages, products, partners] = await Promise.all([
    serviceService.listServices({ limit: 200 }),
    packageService.listPackages({ limit: 200 }),
    productService.listProducts({ limit: 200 }),
    partnerService.listPartners({ limit: 200, filters: { isActive: true } }),
  ]);

  return {
    serviceOptions: services.data.map((s) => ({ value: s.id, label: s.naziv })),
    packageOptions: packages.data.map((p) => ({ value: p.id, label: p.naziv })),
    productOptions: products.data.map((p) => ({ value: p.id, label: p.naziv })),
    partnerOptions: partners.data.map((p) => ({ value: p.id, label: p.imePrezime })),
  };
}

function toIdArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function buildCouponPayload(req) {
  const data = { ...req.body };
  data.applicableServices = toIdArray(req.body.applicableServices);
  data.applicablePackages = toIdArray(req.body.applicablePackages);
  data.applicableProducts = toIdArray(req.body.applicableProducts);
  data.partner = req.body.partner || null;
  data.discountValue = req.body.discountValue != null ? Number(req.body.discountValue) : undefined;
  data.minAppointmentValue = req.body.minAppointmentValue ? Number(req.body.minAppointmentValue) : 0;
  // 0 and blank both mean "no limit" - normalized to null here so there's one
  // canonical "unlimited" representation everywhere downstream. Previously this
  // used a plain truthy check (`req.body.maxUses ? ... : null`), which mishandled
  // a literal "0": the string "0" is truthy in JS, so it got stored as the number
  // 0 instead of null - and coupon.service.js's check (`usedCount >= maxUses`) is
  // always true once maxUses is 0, since usedCount starts at 0 too. That made the
  // coupon completely unusable from its very first redemption attempt.
  data.maxUses = req.body.maxUses && Number(req.body.maxUses) > 0 ? Number(req.body.maxUses) : null;
  data.maxUsesPerUser = req.body.maxUsesPerUser && Number(req.body.maxUsesPerUser) > 0 ? Number(req.body.maxUsesPerUser) : null;
  data.validUntil = req.body.validUntil || null;
  data.isActive = parseCheckbox(req.body.isActive, true);
  return data;
}

export async function listCoupons(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await couponService.listCoupons({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareCouponListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Kuponi",
      pageDescription: "Pregled svih kupona",
      data: viewData,
    });
  } catch (error) {
    logError("[listCoupons] Greška pri učitavanju liste kupona", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function couponDetails(req, res, next) {
  try {
    const { couponId } = req.params;
    const coupon = await couponService.getCouponById(couponId);
    const viewData = prepareCouponDetailsData(coupon);

    return res.render("admin/_details", {
      pageTitle: `Kupon - ${coupon.osnovno.kod}`,
      pageDescription: coupon.osnovno.popust,
      data: viewData,
    });
  } catch (error) {
    logError("[couponDetails] Greška pri učitavanju detalja kupona", error, { couponId: req.params.couponId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newCouponForm(req, res, next) {
  try {
    const formOptions = await loadFormOptions();
    const formData = prepareCouponFormData(null, formOptions);
    return res.render("admin/_form", {
      pageTitle: "Novi kupon",
      pageDescription: "Kreiraj novi kupon za popust",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newCouponForm] Greška pri prikazu forme za novi kupon", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editCouponForm(req, res, next) {
  try {
    const { couponId } = req.params;
    const coupon = await couponService.getCouponForEdit(couponId);
    const formOptions = await loadFormOptions();
    const formData = prepareCouponFormData(coupon, formOptions);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${coupon.code}`,
      pageDescription: coupon.code,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editCouponForm] Greška pri učitavanju forme za izmenu kupona", error, { couponId: req.params.couponId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createCoupon(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createCoupon] Validacione greške pri kreiranju kupona", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formOptions = await loadFormOptions();
      const formData = prepareCouponFormData(null, formOptions);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi kupon",
        pageDescription: "Kreiraj novi kupon za popust",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildCouponPayload(req);
    const coupon = await couponService.createCoupon(data);
    logInfo(`[createCoupon] Kupon "${coupon.osnovno.kod}" kreiran`, { couponId: coupon.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Kupon je uspešno kreiran", `/admin/kuponi/detalji/${coupon.id}`);
  } catch (error) {
    logError("[createCoupon] Greška pri kreiranju kupona", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const formOptions = await loadFormOptions();
      const formData = prepareCouponFormData(null, formOptions);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi kupon",
        pageDescription: "Kreiraj novi kupon za popust",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateCoupon(req, res, next) {
  try {
    const { couponId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateCoupon] Validacione greške za couponId=${couponId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const coupon = await couponService.getCouponForEdit(couponId);
      const formOptions = await loadFormOptions();
      const formData = prepareCouponFormData(coupon, formOptions);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${coupon.code}`,
        pageDescription: coupon.code,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildCouponPayload(req);
    const updated = await couponService.updateCouponById(couponId, data);
    logInfo(`[updateCoupon] Kupon #${couponId} ažuriran`, { couponId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Kupon je uspešno ažuriran", `/admin/kuponi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateCoupon] Greška pri ažuriranju kupona", error, { couponId: req.params.couponId, body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const coupon = await couponService.getCouponForEdit(req.params.couponId).catch(() => null);
      const formOptions = await loadFormOptions();
      const formData = prepareCouponFormData(coupon, formOptions);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: coupon ? `Izmena - ${coupon.code}` : "Izmena kupona",
        pageDescription: coupon?.code || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    await couponService.deleteCouponById(couponId);
    logInfo(`[deleteCoupon] Kupon #${couponId} obrisan`, { couponId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Kupon je uspešno obrisan", "/admin/kuponi");
  } catch (error) {
    logError("[deleteCoupon] Greška pri brisanju kupona", error, { couponId: req.params.couponId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/kuponi");
    }
    next(error);
  }
}

export default {
  listCoupons,
  couponDetails,
  newCouponForm,
  editCouponForm,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};