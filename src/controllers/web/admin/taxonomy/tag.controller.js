import * as tagService from "../../../../services/tag.service.js";
import { prepareTagListData, prepareTagDetailsData, prepareTagFormData } from "../../../../presenters/admin/taxonomy/tag.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listTags(req, res, next) {
  try {
    const { search, domain, isActive, page = 1, limit = 10 } = req.query;

    const result = await tagService.listTags({
      search: search || "",
      domain: domain || undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareTagListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Tagovi",
      pageDescription: "Pregled svih tagova",
      data: viewData,
    });
  } catch (error) {
    logError("[listTags] Greška pri učitavanju liste tagova", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function tagDetails(req, res, next) {
  try {
    const { tagId } = req.params;
    const tag = await tagService.getTagById(tagId);
    const viewData = prepareTagDetailsData(tag);

    return res.render("admin/_details", {
      pageTitle: `Tag — ${tag.naziv}`,
      pageDescription: tag.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[tagDetails] Greška pri učitavanju detalja taga", error, { tagId: req.params.tagId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newTagForm(req, res, next) {
  try {
    const formData = prepareTagFormData();
    return res.render("admin/_form", {
      pageTitle: "Novi tag",
      pageDescription: "Kreiraj novi tag",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newTagForm] Greška pri prikazu forme za novi tag", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editTagForm(req, res, next) {
  try {
    const { tagId } = req.params;
    const tag = await tagService.getTagForEdit(tagId);
    const formData = prepareTagFormData(tag);

    return res.render("admin/_form", {
      pageTitle: `Izmena — ${tag.name}`,
      pageDescription: tag.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editTagForm] Greška pri učitavanju forme za izmenu taga", error, { tagId: req.params.tagId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createTag(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createTag] Validacione greške pri kreiranju taga", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareTagFormData();
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi tag",
        pageDescription: "Kreiraj novi tag",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const tag = await tagService.createTag(req.body);
    logInfo(`[createTag] Tag kreiran: "${tag.naziv}"`, { tagId: tag.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Tag je uspešno kreiran", `/admin/tagovi/detalji/${tag.id}`);
  } catch (error) {
    logError("[createTag] Greška pri kreiranju taga", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const formData = prepareTagFormData();
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi tag",
        pageDescription: "Kreiraj novi tag",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateTag(req, res, next) {
  try {
    const { tagId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateTag] Validacione greške za tagId=${tagId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const tag = await tagService.getTagForEdit(tagId);
      const formData = prepareTagFormData(tag);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena — ${tag.name}`,
        pageDescription: tag.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const updated = await tagService.updateTagById(tagId, req.body);
    logInfo(`[updateTag] Tag #${tagId} ažuriran`, { tagId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Tag je uspešno ažuriran", `/admin/tagovi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateTag] Greška pri ažuriranju taga", error, { tagId: req.params.tagId, body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const tag = await tagService.getTagForEdit(req.params.tagId).catch(() => null);
      const formData = prepareTagFormData(tag);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: tag ? `Izmena — ${tag.name}` : "Izmena taga",
        pageDescription: tag?.name || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteTag(req, res, next) {
  try {
    const { tagId } = req.params;
    await tagService.deleteTagById(tagId);
    logInfo(`[deleteTag] Tag #${tagId} obrisan`, { tagId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Tag je uspešno obrisan", "/admin/tagovi");
  } catch (error) {
    logError("[deleteTag] Greška pri brisanju taga", error, { tagId: req.params.tagId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/tagovi");
    }
    next(error);
  }
}

export default {
  listTags,
  tagDetails,
  newTagForm,
  editTagForm,
  createTag,
  updateTag,
  deleteTag,
};
