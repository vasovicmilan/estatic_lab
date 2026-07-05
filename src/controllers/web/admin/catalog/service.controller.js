import * as serviceService from "../../../../services/service.service.js";
import * as categoryService from "../../../../services/category.service.js";
import * as tagService from "../../../../services/tag.service.js";
import * as employeeService from "../../../../services/employee.service.js";
import {
  prepareServiceListData,
  prepareServiceDetailsData,
  prepareServiceFormData,
  prepareServiceSeoFormData,
} from "../../../../presenters/admin/catalog/service.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";

// complex nested arrays (packages, features, comparisonTable, faq) are submitted as
// JSON from the dynamic form-builder widgets rather than flat form fields
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
  const [categories, tags, employees] = await Promise.all([
    categoryService.getCategoriesForSelect("service"),
    tagService.getTagsForSelect("service"),
    employeeService.listEmployees({ limit: 200 }),
  ]);

  return {
    categoryOptions: categories,
    tagOptions: tags,
    employeeOptions: employees.data.map((e) => ({ value: e.id, label: e.imePrezime })),
  };
}

function buildServicePayload(req, existing = {}) {
  const data = { ...req.body };

  // imageDesc is required whenever a new image is uploaded — enforced by
  // validateServiceCreate/validateServiceUpdate before this code ever runs.
  data.image = req.uploadedFiles?.serviceImage
    ? { img: req.uploadedFiles.serviceImage.img, imgDesc: req.body.imageDesc.trim() }
    : existing.image || null;

  data.gallery = req.uploadedFiles?.gallery
    ? req.uploadedFiles.gallery.map((f) => ({ img: f.img, imgDesc: f.imgDesc || "" }))
    : existing.gallery || [];

  data.categories = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : req.body.categories ? [req.body.categories] : [];
  data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean) : req.body.tags ? [req.body.tags] : [];
  data.employees = Array.isArray(req.body.employees) ? req.body.employees.filter(Boolean) : req.body.employees ? [req.body.employees] : [];

  data.features = parseJsonField(req.body.features, existing.features || []);
  data.packages = parseJsonField(req.body.packages, existing.packages || []);
  data.comparisonColumns = req.body.comparisonColumnsCsv
    ? req.body.comparisonColumnsCsv.split(",").map((c) => c.trim()).filter(Boolean)
    : existing.comparisonColumns || [];
  data.comparisonTable = parseJsonField(req.body.comparisonTable, existing.comparisonTable || []);
  data.faq = parseJsonField(req.body.faq, existing.faq || []);

  data.highlight = req.body.highlight === "true" || req.body.highlight === true || req.body.highlight === "on";
  data.isActive = req.body.isActive === "true" || req.body.isActive === true || req.body.isActive === "on";

  return data;
}

export async function listServices(req, res, next) {
  try {
    const { search, isActive, highlight, page = 1, limit = 10 } = req.query;

    const result = await serviceService.listServices({
      search: search || "",
      filters: {
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
        highlight: highlight === "true" ? true : highlight === "false" ? false : undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareServiceListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Usluge",
      pageDescription: "Pregled svih usluga",
      data: viewData,
    });
  } catch (error) {
    logError("[listServices] Greška pri učitavanju liste usluga", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function serviceDetails(req, res, next) {
  try {
    const { serviceId } = req.params;
    const service = await serviceService.getServiceById(serviceId);
    const viewData = prepareServiceDetailsData(service);

    return res.render("admin/_details", {
      pageTitle: `Usluga — ${service.naziv}`,
      pageDescription: service.kratakOpis || service.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[serviceDetails] Greška pri učitavanju detalja usluge", error, { serviceId: req.params.serviceId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newServiceForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = prepareServiceFormData(null, options);
    return res.render("admin/_form", {
      pageTitle: "Nova usluga",
      pageDescription: "Kreiraj novu uslugu",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newServiceForm] Greška pri prikazu forme za novu uslugu", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editServiceForm(req, res, next) {
  try {
    const { serviceId } = req.params;
    const service = await serviceService.getServiceForEdit(serviceId);
    const options = await loadFormOptions();
    const formData = prepareServiceFormData(service, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena — ${service.name}`,
      pageDescription: service.shortDescription || service.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editServiceForm] Greška pri učitavanju forme za izmenu usluge", error, {
      serviceId: req.params.serviceId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function createService(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createService] Validacione greške pri kreiranju usluge", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = prepareServiceFormData(null, options);
      return res.status(400).render("admin/_form", {
        pageTitle: "Nova usluga",
        pageDescription: "Kreiraj novu uslugu",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildServicePayload(req);
    const service = await serviceService.createService(data);
    logInfo(`[createService] Usluga kreirana: "${service.naziv}"`, { serviceId: service.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Usluga je uspešno kreirana", `/admin/usluge/detalji/${service.id}`);
  } catch (error) {
    logError("[createService] Greška pri kreiranju usluge", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const options = await loadFormOptions();
      const formData = prepareServiceFormData(null, options);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Nova usluga",
        pageDescription: "Kreiraj novu uslugu",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateService(req, res, next) {
  try {
    const { serviceId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateService] Validacione greške za serviceId=${serviceId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const service = await serviceService.getServiceForEdit(serviceId);
      const options = await loadFormOptions();
      const formData = prepareServiceFormData(service, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena — ${service.name}`,
        pageDescription: service.shortDescription || service.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await serviceService.getServiceForEdit(serviceId);
    const data = buildServicePayload(req, existing);
    const updated = await serviceService.updateServiceById(serviceId, data);
    logInfo(`[updateService] Usluga #${serviceId} ažurirana`, { serviceId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Usluga je uspešno ažurirana", `/admin/usluge/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateService] Greška pri ažuriranju usluge", error, {
      serviceId: req.params.serviceId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const service = await serviceService.getServiceForEdit(req.params.serviceId).catch(() => null);
      const options = await loadFormOptions();
      const formData = prepareServiceFormData(service, options);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: service ? `Izmena — ${service.name}` : "Izmena usluge",
        pageDescription: service?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function editServiceSeoForm(req, res, next) {
  try {
    const { serviceId } = req.params;
    const service = await serviceService.getServiceById(serviceId);
    const formData = prepareServiceSeoFormData(service);

    return res.render("admin/our-service/seo", {
      pageTitle: `SEO — ${service.naziv}`,
      pageDescription: service.naziv,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editServiceSeoForm] Greška pri učitavanju SEO forme", error, { serviceId: req.params.serviceId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateServiceSeo(req, res, next) {
  try {
    const { serviceId } = req.params;
    const keywords = Array.isArray(req.body.seoKeywords)
      ? req.body.seoKeywords.filter(Boolean)
      : (req.body.seoKeywords || "").split(",").map((k) => k.trim()).filter(Boolean);

    const updated = await serviceService.updateServiceSeo(serviceId, keywords);
    logInfo(`[updateServiceSeo] SEO usluge #${serviceId} ažuriran`, { serviceId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "SEO podaci su uspešno ažurirani", `/admin/usluge/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateServiceSeo] Greška pri ažuriranju SEO podataka", error, { serviceId: req.params.serviceId, userId: req.session?.user?.id });
    if (error.statusCode) {
      const service = await serviceService.getServiceById(req.params.serviceId).catch(() => null);
      if (service) {
        const formData = prepareServiceSeoFormData(service);
        return res.status(error.statusCode).render("admin/our-service/seo", {
          pageTitle: `SEO — ${service.naziv}`,
          pageDescription: service.naziv,
          data: { ...formData, errors: { general: error.message }, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

export async function deleteService(req, res, next) {
  try {
    const { serviceId } = req.params;
    await serviceService.deleteServiceById(serviceId);
    logInfo(`[deleteService] Usluga #${serviceId} obrisana`, { serviceId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Usluga je uspešno obrisana", "/admin/usluge");
  } catch (error) {
    logError("[deleteService] Greška pri brisanju usluge", error, { serviceId: req.params.serviceId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/usluge");
    }
    next(error);
  }
}

export default {
  listServices,
  serviceDetails,
  newServiceForm,
  editServiceForm,
  createService,
  updateService,
  editServiceSeoForm,
  updateServiceSeo,
  deleteService,
};