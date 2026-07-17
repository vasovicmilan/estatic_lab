import * as expertService from "../../../../services/expert.service.js";
import * as serviceService from "../../../../services/service.service.js";
import { prepareExpertListData, prepareExpertDetailsData, prepareExpertFormData } from "../../../../presenters/admin/auth/expert.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";

async function loadServiceOptions() {
  const services = await serviceService.listServices({ limit: 200 });
  return services.data.map((s) => ({ value: s.id, label: s.naziv }));
}

export async function listExperts(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const result = await expertService.listExperts({
      search: search || "",
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareExpertListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Eksperti",
      pageDescription: "Pregled svih eksperata",
      data: viewData,
    });
  } catch (error) {
    logError("[listExperts] Greška pri učitavanju liste eksperata", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function expertDetails(req, res, next) {
  try {
    const { expertId } = req.params;
    const expert = await expertService.getExpertById(expertId);
    const viewData = prepareExpertDetailsData(expert);

    return res.render("admin/_details", {
      pageTitle: `Ekspert - ${expert.osnovno.ime} ${expert.osnovno.prezime}`,
      pageDescription: expert.osnovno.titula || "",
      data: viewData,
    });
  } catch (error) {
    logError("[expertDetails] Greška pri učitavanju detalja eksperta", error, {
      expertId: req.params.expertId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newExpertForm(req, res, next) {
  try {
    const serviceOptions = await loadServiceOptions();
    const formData = prepareExpertFormData(null, { serviceOptions });
    return res.render("admin/_form", {
      pageTitle: "Novi ekspert",
      pageDescription: "Kreiraj novi ekspert profil",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newExpertForm] Greška pri prikazu forme za novog eksperta", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editExpertForm(req, res, next) {
  try {
    const { expertId } = req.params;
    const expert = await expertService.getExpertForEdit(expertId);
    const serviceOptions = await loadServiceOptions();
    const formData = prepareExpertFormData(expert, { serviceOptions });

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${expert.firstName} ${expert.lastName}`,
      pageDescription: expert.title || "",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editExpertForm] Greška pri učitavanju forme za izmenu eksperta", error, {
      expertId: req.params.expertId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

function parseSpecializations(csv) {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildImageFromUpload(req, existingImage) {
  if (req.uploadedFile) {
    // imageDesc is required whenever a new image is uploaded - enforced by
    // validateExpertCreate/validateExpertUpdate before this code ever runs, so
    // req.body.imageDesc is guaranteed non-empty here. No silent "" fallback.
    return { img: req.uploadedFile.img, imgDesc: req.body.imageDesc.trim() };
  }
  return existingImage || null;
}

export async function createExpert(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createExpert] Validacione greške pri kreiranju eksperta", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const serviceOptions = await loadServiceOptions();
      const formData = prepareExpertFormData(null, { serviceOptions });
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi ekspert",
        pageDescription: "Kreiraj novi ekspert profil",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = { ...req.body };
    data.image = buildImageFromUpload(req, null);
    data.services = Array.isArray(req.body.services) ? req.body.services.filter(Boolean) : req.body.services ? [req.body.services] : [];
    data.specializations = parseSpecializations(req.body.specializationsCsv);

    const expert = await expertService.createExpert(data);
    logInfo(`[createExpert] Ekspert kreiran: "${expert.osnovno.ime} ${expert.osnovno.prezime}"`, { expertId: expert.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Ekspert je uspešno kreiran", `/admin/eksperti/detalji/${expert.id}`);
  } catch (error) {
    logError("[createExpert] Greška pri kreiranju eksperta", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const serviceOptions = await loadServiceOptions();
      const formData = prepareExpertFormData(null, { serviceOptions });
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Novi ekspert",
        pageDescription: "Kreiraj novi ekspert profil",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateExpert(req, res, next) {
  try {
    const { expertId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateExpert] Validacione greške za expertId=${expertId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const expert = await expertService.getExpertForEdit(expertId);
      const serviceOptions = await loadServiceOptions();
      const formData = prepareExpertFormData(expert, { serviceOptions });
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${expert.firstName} ${expert.lastName}`,
        pageDescription: expert.title || "",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await expertService.getExpertForEdit(expertId);
    const data = { ...req.body };
    data.image = buildImageFromUpload(req, existing.image);
    data.services = Array.isArray(req.body.services) ? req.body.services.filter(Boolean) : req.body.services ? [req.body.services] : [];
    data.specializations = parseSpecializations(req.body.specializationsCsv);

    const updated = await expertService.updateExpertById(expertId, data);
    logInfo(`[updateExpert] Ekspert #${expertId} ažuriran`, { expertId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Ekspert je uspešno ažuriran", `/admin/eksperti/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateExpert] Greška pri ažuriranju eksperta", error, {
      expertId: req.params.expertId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const expert = await expertService.getExpertForEdit(req.params.expertId).catch(() => null);
      const serviceOptions = await loadServiceOptions();
      const formData = prepareExpertFormData(expert, { serviceOptions });
      return res.status(statusCode).render("admin/_form", {
        pageTitle: expert ? `Izmena - ${expert.firstName} ${expert.lastName}` : "Izmena eksperta",
        pageDescription: expert?.title || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteExpert(req, res, next) {
  try {
    const { expertId } = req.params;
    await expertService.deleteExpertById(expertId);
    logInfo(`[deleteExpert] Ekspert #${expertId} obrisan`, { expertId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Ekspert je uspešno obrisan", "/admin/eksperti");
  } catch (error) {
    logError("[deleteExpert] Greška pri brisanju eksperta", error, { expertId: req.params.expertId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/eksperti");
    }
    next(error);
  }
}

export default {
  listExperts,
  expertDetails,
  newExpertForm,
  editExpertForm,
  createExpert,
  updateExpert,
  deleteExpert,
};