import * as packageService from "../../../../services/package.service.js";
import * as serviceService from "../../../../services/service.service.js";
import * as categoryService from "../../../../services/category.service.js";
import * as tagService from "../../../../services/tag.service.js";
import { preparePackageListData, preparePackageDetailsData, preparePackageFormData } from "../../../../presenters/admin/catalog/package.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

function parseJsonField(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function loadFormOptions() {
  const [services, categories, tags] = await Promise.all([
    serviceService.listServices({ limit: 200 }),
    categoryService.getCategoriesForSelect("service"),
    tagService.getTagsForSelect("service"),
  ]);

  return {
    serviceOptions: services.data.map((s) => ({ value: s.id, label: s.naziv })),
    categoryOptions: categories,
    tagOptions: tags,
  };
}

function buildPackagePayload(req, existing = {}) {
  const data = { ...req.body };

  // imageDesc is required whenever a new image is uploaded — enforced by
  // validatePackageCreate/validatePackageUpdate before this code ever runs.
  data.image = req.uploadedFiles?.packageImage
    ? { img: req.uploadedFiles.packageImage.img, imgDesc: req.body.imageDesc.trim() }
    : existing.image || null;

  data.gallery = req.uploadedFiles?.gallery
    ? req.uploadedFiles.gallery.map((f) => ({ img: f.img, imgDesc: f.imgDesc || "" }))
    : existing.gallery || [];

  data.items = parseJsonField(req.body.items, existing.items || []);
  data.faq = parseJsonField(req.body.faq, existing.faq || []);
  data.categories = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : req.body.categories ? [req.body.categories] : [];
  data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean) : req.body.tags ? [req.body.tags] : [];

  data.isBest = parseCheckbox(req.body.isBest, existing.isBest ?? false);
  data.isActive = parseCheckbox(req.body.isActive, existing.isActive ?? true);
  data.totalPrice = req.body.totalPrice != null ? Number(req.body.totalPrice) : existing.totalPrice;
  data.basePrice = req.body.basePrice ? Number(req.body.basePrice) : null;
  data.totalDuration = req.body.totalDuration ? Number(req.body.totalDuration) : null;

  return data;
}

export async function listPackages(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await packageService.listPackages({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePackageListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Paketi",
      pageDescription: "Pregled svih paketa",
      data: viewData,
    });
  } catch (error) {
    logError("[listPackages] Greška pri učitavanju liste paketa", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function packageDetails(req, res, next) {
  try {
    const { packageId } = req.params;
    const pkg = await packageService.getPackageById(packageId);
    const viewData = preparePackageDetailsData(pkg);

    return res.render("admin/_details", {
      pageTitle: `Paket — ${pkg.naziv}`,
      pageDescription: pkg.kratakOpis || pkg.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[packageDetails] Greška pri učitavanju detalja paketa", error, { packageId: req.params.packageId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newPackageForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = preparePackageFormData(null, options);
    return res.render("admin/_form", {
      pageTitle: "Novi paket",
      pageDescription: "Kreiraj novi paket",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newPackageForm] Greška pri prikazu forme za novi paket", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editPackageForm(req, res, next) {
  try {
    const { packageId } = req.params;
    const pkg = await packageService.getPackageForEdit(packageId);
    const options = await loadFormOptions();
    const formData = preparePackageFormData(pkg, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena — ${pkg.name}`,
      pageDescription: pkg.shortDescription || pkg.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editPackageForm] Greška pri učitavanju forme za izmenu paketa", error, {
      packageId: req.params.packageId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function createPackage(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createPackage] Validacione greške pri kreiranju paketa", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = preparePackageFormData(null, options);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi paket",
        pageDescription: "Kreiraj novi paket",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildPackagePayload(req);
    const pkg = await packageService.createPackage(data);
    logInfo(`[createPackage] Paket kreiran: "${pkg.naziv}"`, { packageId: pkg.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Paket je uspešno kreiran", `/admin/paketi/detalji/${pkg.id}`);
  } catch (error) {
    logError("[createPackage] Greška pri kreiranju paketa", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const options = await loadFormOptions();
      const formData = preparePackageFormData(null, options);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Novi paket",
        pageDescription: "Kreiraj novi paket",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updatePackage(req, res, next) {
  try {
    const { packageId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updatePackage] Validacione greške za packageId=${packageId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const pkg = await packageService.getPackageForEdit(packageId);
      const options = await loadFormOptions();
      const formData = preparePackageFormData(pkg, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena — ${pkg.name}`,
        pageDescription: pkg.shortDescription || pkg.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await packageService.getPackageForEdit(packageId);
    const data = buildPackagePayload(req, existing);
    const updated = await packageService.updatePackageById(packageId, data);
    logInfo(`[updatePackage] Paket #${packageId} ažuriran`, { packageId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Paket je uspešno ažuriran", `/admin/paketi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updatePackage] Greška pri ažuriranju paketa", error, {
      packageId: req.params.packageId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const pkg = await packageService.getPackageForEdit(req.params.packageId).catch(() => null);
      const options = await loadFormOptions();
      const formData = preparePackageFormData(pkg, options);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: pkg ? `Izmena — ${pkg.name}` : "Izmena paketa",
        pageDescription: pkg?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deletePackage(req, res, next) {
  try {
    const { packageId } = req.params;
    await packageService.deletePackageById(packageId);
    logInfo(`[deletePackage] Paket #${packageId} obrisan`, { packageId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Paket je uspešno obrisan", "/admin/paketi");
  } catch (error) {
    logError("[deletePackage] Greška pri brisanju paketa", error, { packageId: req.params.packageId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/paketi");
    }
    next(error);
  }
}

export default {
  listPackages,
  packageDetails,
  newPackageForm,
  editPackageForm,
  createPackage,
  updatePackage,
  deletePackage,
};