import * as packageService from "../../../../services/package.service.js";
import * as serviceService from "../../../../services/service.service.js";
import * as categoryService from "../../../../services/category.service.js";
import * as tagService from "../../../../services/tag.service.js";
import { preparePackageListData, preparePackageDetailsData, preparePackageFormData } from "../../../../presenters/admin/catalog/package.presenter.js";
import { prepareMediaFormData } from "../../../../presenters/admin/media-form.presenter.js";
import { buildGalleryPayload, buildVideosPayload } from "../../../../utils/media-form.util.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";
import auditLogService from "../../../../services/audit-log.service.js";

function parseJsonField(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// The items repeater can't do cascading "pick a service, then pick one of ITS
// variants" dropdowns - so each row is one flattened select over every active
// service's variants, encoded as "serviceId::servicePackageId". This splits that
// back into the real {service, servicePackageId, sessions} shape the service layer
// expects.
function splitVariantKeys(items) {
  return items.map((item) => {
    if (item.variantKey) {
      const [service, servicePackageId] = item.variantKey.split("::");
      return { service, servicePackageId, sessions: Number(item.sessions) };
    }
    return item;
  });
}

async function loadFormOptions() {
  const [servicesList, categories, tags] = await Promise.all([
    serviceService.listServices({ limit: 200 }),
    categoryService.getCategoriesForSelect("service"),
    tagService.getTagsForSelect("service"),
  ]);

  // listServices() returns the admin-list shape (no variant details) - fetching each
  // service's full detail is the only way to get its actual variant list/pricing.
  // Admin-only, rarely-loaded form, so the N+1 cost here is fine.
  const fullServices = await Promise.all(servicesList.data.map((s) => serviceService.getServiceById(s.id)));

  const variantOptions = fullServices.flatMap((service) =>
    (service.varijante || []).map((variant) => ({
      value: `${service.id}::${variant.id}`,
      label: `${service.naziv} - ${variant.naziv} (${variant.cena} RSD)`,
    }))
  );

  return {
    variantOptions,
    categoryOptions: categories,
    tagOptions: tags,
  };
}

function buildPackagePayload(req, existing = {}) {
  const data = { ...req.body };

  data.image = req.uploadedFiles?.packageImage
    ? { img: req.uploadedFiles.packageImage.img, imgDesc: req.body.imageDesc.trim() }
    : existing.image || null;

  data.gallery = req.uploadedFiles?.gallery
    ? req.uploadedFiles.gallery.map((f) => ({ img: f.img, imgDesc: f.imgDesc || "" }))
    : existing.gallery || [];

  data.items = splitVariantKeys(parseJsonField(req.body.items, existing.items || []));
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
      pageTitle: `Paket - ${pkg.naziv}`,
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
      pageTitle: `Izmena - ${pkg.name}`,
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
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PACKAGE_CREATED",
      entity: { type: "Package", id: pkg.id },
      changes: { totalPrice: { old: null, new: data.totalPrice } },
      req,
      success: true,
    });

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
        pageTitle: `Izmena - ${pkg.name}`,
        pageDescription: pkg.shortDescription || pkg.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await packageService.getPackageForEdit(packageId);
    const data = buildPackagePayload(req, existing);
    const updated = await packageService.updatePackageById(packageId, data);
    logInfo(`[updatePackage] Paket #${packageId} ažuriran`, { packageId, adminId: req.session?.user?.id });

    const afterUpdate = await packageService.getPackageForEdit(packageId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["name", "totalPrice", "isActive"]);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PACKAGE_UPDATED",
      entity: { type: "Package", id: packageId },
      changes,
      req,
      success: true,
    });

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
        pageTitle: pkg ? `Izmena - ${pkg.name}` : "Izmena paketa",
        pageDescription: pkg?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Galerija i video - separate page from the main edit form (see admin/_details.ejs)
// ---------------------------------------------------------------------------
export async function editPackageGalleryForm(req, res, next) {
  try {
    const { packageId } = req.params;
    const pkg = await packageService.getPackageForEdit(packageId);
    const formData = prepareMediaFormData(pkg, {
      entityLabel: "paketa",
        listUrl: "/admin/paketi",
        listLabel: "Paketi",
      backUrl: `/admin/paketi/detalji/${packageId}`,
      submitUrl: `/admin/paketi/${packageId}/galerija`,
    });

    return res.render("admin/_media-form", {
      pageTitle: `Galerija i video - ${pkg.name}`,
      pageDescription: pkg.shortDescription || pkg.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editPackageGalleryForm] Greška pri učitavanju forme za galeriju", error, {
      packageId: req.params.packageId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function updatePackageGallery(req, res, next) {
  const { packageId } = req.params;
  try {
    if (req.validationErrors) {
      logWarn(`[updatePackageGallery] Validacione greške za packageId=${packageId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const pkg = await packageService.getPackageForEdit(packageId);
      const formData = prepareMediaFormData(pkg, {
        entityLabel: "paketa",
        listUrl: "/admin/paketi",
        listLabel: "Paketi",
        backUrl: `/admin/paketi/detalji/${packageId}`,
        submitUrl: `/admin/paketi/${packageId}/galerija`,
      });
      return res.status(400).render("admin/_media-form", {
        pageTitle: `Galerija i video - ${pkg.name}`,
        pageDescription: pkg.shortDescription || pkg.name,
        data: { ...formData, errors: req.validationErrors, csrfToken: res.locals.csrfToken },
      });
    }

    const gallery = buildGalleryPayload(req);
    const videos = buildVideosPayload(req);

    const updated = await packageService.updatePackageById(packageId, { gallery, videos });
    logInfo(`[updatePackageGallery] Galerija/video paketa #${packageId} ažurirani`, { packageId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Galerija i video su uspešno ažurirani", `/admin/paketi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updatePackageGallery] Greška pri ažuriranju galerije/videa", error, {
      packageId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404) {
      const pkg = await packageService.getPackageForEdit(packageId).catch(() => null);
      if (pkg) {
        const formData = prepareMediaFormData(pkg, {
          entityLabel: "paketa",
        listUrl: "/admin/paketi",
        listLabel: "Paketi",
          backUrl: `/admin/paketi/detalji/${packageId}`,
          submitUrl: `/admin/paketi/${packageId}/galerija`,
        });
        return res.status(statusCode).render("admin/_media-form", {
          pageTitle: `Galerija i video - ${pkg.name}`,
          pageDescription: pkg.shortDescription || pkg.name,
          data: { ...formData, errors: { general: message }, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

export async function deletePackage(req, res, next) {
  try {
    const { packageId } = req.params;
    await packageService.deletePackageById(packageId);
    logInfo(`[deletePackage] Paket #${packageId} obrisan`, { packageId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PACKAGE_DELETED",
      entity: { type: "Package", id: packageId },
      req,
      success: true,
    });
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
  editPackageGalleryForm,
  updatePackageGallery,
  deletePackage,
};