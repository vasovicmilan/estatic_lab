import * as resourceService from "../../../../services/resource.service.js";
import {
  prepareResourceListData,
  prepareResourceDetailsData,
  prepareResourceFormData,
} from "../../../../presenters/admin/catalog/resource.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

export async function listResources(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await resourceService.listResources({
      search: search || "",
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareResourceListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Resursi",
      pageDescription: "Fizički kapaciteti (stolovi, aparati, prostorije) koje termini dele preko zaposlenih",
      data: viewData,
    });
  } catch (error) {
    logError("[listResources] Greška pri učitavanju liste resursa", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function resourceDetails(req, res, next) {
  try {
    const { resourceId } = req.params;
    const resource = await resourceService.getResourceById(resourceId);
    const viewData = prepareResourceDetailsData(resource);

    return res.render("admin/_details", {
      pageTitle: `Resurs - ${resource.naziv}`,
      pageDescription: resource.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[resourceDetails] Greška pri učitavanju detalja resursa", error, { resourceId: req.params.resourceId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newResourceForm(req, res, next) {
  try {
    const formData = prepareResourceFormData();
    return res.render("admin/_form", {
      pageTitle: "Novi resurs",
      pageDescription: "Kreiraj novi resurs",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newResourceForm] Greška pri prikazu forme za novi resurs", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editResourceForm(req, res, next) {
  try {
    const { resourceId } = req.params;
    const resource = await resourceService.getResourceForEdit(resourceId);
    const formData = prepareResourceFormData(resource);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${resource.name}`,
      pageDescription: resource.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editResourceForm] Greška pri učitavanju forme za izmenu resursa", error, { resourceId: req.params.resourceId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createResource(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createResource] Validacione greške pri kreiranju resursa", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareResourceFormData();
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi resurs",
        pageDescription: "Kreiraj novi resurs",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = { ...req.body, isActive: parseCheckbox(req.body.isActive, true) };
    const resource = await resourceService.createResource(data);
    logInfo(`[createResource] Resurs kreiran: "${resource.naziv}"`, { resourceId: resource.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Resurs je uspešno kreiran", `/admin/resursi/detalji/${resource.id}`);
  } catch (error) {
    logError("[createResource] Greška pri kreiranju resursa", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const formData = prepareResourceFormData();
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi resurs",
        pageDescription: "Kreiraj novi resurs",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateResource(req, res, next) {
  try {
    const { resourceId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateResource] Validacione greške za resourceId=${resourceId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const resource = await resourceService.getResourceForEdit(resourceId);
      const formData = prepareResourceFormData(resource);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${resource.name}`,
        pageDescription: resource.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await resourceService.getResourceForEdit(resourceId);
    const data = { ...req.body, isActive: parseCheckbox(req.body.isActive, existing.isActive) };
    const updated = await resourceService.updateResourceById(resourceId, data);
    logInfo(`[updateResource] Resurs #${resourceId} ažuriran`, { resourceId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Resurs je uspešno ažuriran", `/admin/resursi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateResource] Greška pri ažuriranju resursa", error, { resourceId: req.params.resourceId, body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const resource = await resourceService.getResourceForEdit(req.params.resourceId).catch(() => null);
      const formData = prepareResourceFormData(resource);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: resource ? `Izmena - ${resource.name}` : "Izmena resursa",
        pageDescription: resource?.name || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteResource(req, res, next) {
  try {
    const { resourceId } = req.params;
    await resourceService.deleteResourceById(resourceId);
    logInfo(`[deleteResource] Resurs #${resourceId} obrisan`, { resourceId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Resurs je uspešno obrisan", "/admin/resursi");
  } catch (error) {
    logError("[deleteResource] Greška pri brisanju resursa", error, { resourceId: req.params.resourceId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/resursi");
    }
    next(error);
  }
}

export default {
  listResources,
  resourceDetails,
  newResourceForm,
  editResourceForm,
  createResource,
  updateResource,
  deleteResource,
};