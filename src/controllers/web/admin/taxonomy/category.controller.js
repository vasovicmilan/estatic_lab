import * as categoryService from "../../../../services/category.service.js";
import { prepareCategoryListData, prepareCategoryDetailsData, prepareCategoryFormData } from "../../../../presenters/admin/taxonomy/category.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

async function loadParentOptions(domain, excludeId = null) {
  const options = await categoryService.getCategoriesForSelect(domain || "service");
  return options.filter((c) => c.id !== excludeId);
}

export async function listCategories(req, res, next) {
  try {
    const { search, domain, parent, isActive, page = 1, limit = 10 } = req.query;

    const result = await categoryService.listCategories({
      search: search || "",
      domain: domain || undefined,
      parent: parent || undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareCategoryListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Kategorije",
      pageDescription: "Pregled svih kategorija",
      data: viewData,
    });
  } catch (error) {
    logError("[listCategories] Greška pri učitavanju liste kategorija", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function categoryDetails(req, res, next) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.getCategoryById(categoryId);
    const viewData = prepareCategoryDetailsData(category);

    return res.render("admin/_details", {
      pageTitle: `Kategorija - ${category.naziv}`,
      pageDescription: category.kratakOpis || category.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[categoryDetails] Greška pri učitavanju detalja kategorije", error, {
      categoryId: req.params.categoryId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newCategoryForm(req, res, next) {
  try {
    const parentOptions = await loadParentOptions(req.query.domain);
    const formData = prepareCategoryFormData(null, { parentOptions });
    return res.render("admin/_form", {
      pageTitle: "Nova kategorija",
      pageDescription: "Kreiraj novu kategoriju",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newCategoryForm] Greška pri prikazu forme za novu kategoriju", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editCategoryForm(req, res, next) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.getCategoryForEdit(categoryId);
    const parentOptions = await loadParentOptions(category.domain, categoryId);
    const formData = prepareCategoryFormData(category, { parentOptions });

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${category.name}`,
      pageDescription: category.shortDescription || category.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editCategoryForm] Greška pri učitavanju forme za izmenu kategorije", error, {
      categoryId: req.params.categoryId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

function buildFeatureImage(req, existing) {
  if (req.uploadedFile) {
    // categoryImageDesc is required whenever a new image is uploaded - enforced by
    // validateCategoryCreate/validateCategoryUpdate before this code ever runs.
    return { img: req.uploadedFile.img, imgDesc: req.body.categoryImageDesc.trim() };
  }
  return existing || null;
}

export async function createCategory(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createCategory] Validacione greške pri kreiranju kategorije", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const parentOptions = await loadParentOptions(req.body.domain);
      const formData = prepareCategoryFormData(null, { parentOptions });
      return res.status(400).render("admin/_form", {
        pageTitle: "Nova kategorija",
        pageDescription: "Kreiraj novu kategoriju",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = { ...req.body };
    data.featureImage = buildFeatureImage(req, null);
    data.parent = data.parent || null;
    data.isIndexable = parseCheckbox(req.body.isIndexable, true);
    // isActive is stored at meta.isActive in the schema, not top-level - the form
    // field is flattened for display (see mapCategoryForEdit) but has to be written
    // back to its real nested path
    data.meta = { isActive: parseCheckbox(req.body.isActive, true) };
    delete data.isActive;

    const category = await categoryService.createCategory(data);
    logInfo(`[createCategory] Kategorija kreirana: "${category.naziv}"`, { categoryId: category.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Kategorija je uspešno kreirana", `/admin/kategorije/detalji/${category.id}`);
  } catch (error) {
    logError("[createCategory] Greška pri kreiranju kategorije", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const parentOptions = await loadParentOptions(req.body.domain);
      const formData = prepareCategoryFormData(null, { parentOptions });
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Nova kategorija",
        pageDescription: "Kreiraj novu kategoriju",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { categoryId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateCategory] Validacione greške za categoryId=${categoryId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const category = await categoryService.getCategoryForEdit(categoryId);
      const parentOptions = await loadParentOptions(category.domain, categoryId);
      const formData = prepareCategoryFormData(category, { parentOptions });
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${category.name}`,
        pageDescription: category.shortDescription || category.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await categoryService.getCategoryForEdit(categoryId);
    const data = { ...req.body };
    data.featureImage = buildFeatureImage(req, existing.featureImage);
    data.parent = data.parent || null;
    data.isIndexable = parseCheckbox(req.body.isIndexable, existing.isIndexable);
    // isActive lives at meta.isActive in the schema. Using the dot-notation key here
    // (rather than data.meta = {...}) means Mongoose's $set only touches that one
    // nested field - setting a plain data.meta object would replace the whole meta
    // subdocument and silently wipe meta.priority back to its default.
    data["meta.isActive"] = parseCheckbox(req.body.isActive, existing.isActive);
    delete data.isActive;

    const updated = await categoryService.updateCategoryById(categoryId, data);
    logInfo(`[updateCategory] Kategorija #${categoryId} ažurirana`, { categoryId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Kategorija je uspešno ažurirana", `/admin/kategorije/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateCategory] Greška pri ažuriranju kategorije", error, {
      categoryId: req.params.categoryId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const category = await categoryService.getCategoryForEdit(req.params.categoryId).catch(() => null);
      const parentOptions = await loadParentOptions(category?.domain, req.params.categoryId);
      const formData = prepareCategoryFormData(category, { parentOptions });
      return res.status(statusCode).render("admin/_form", {
        pageTitle: category ? `Izmena - ${category.name}` : "Izmena kategorije",
        pageDescription: category?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const { categoryId } = req.params;
    await categoryService.deleteCategoryById(categoryId);
    logInfo(`[deleteCategory] Kategorija #${categoryId} obrisana`, { categoryId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Kategorija je uspešno obrisana", "/admin/kategorije");
  } catch (error) {
    logError("[deleteCategory] Greška pri brisanju kategorije", error, { categoryId: req.params.categoryId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/kategorije");
    }
    next(error);
  }
}

export default {
  listCategories,
  categoryDetails,
  newCategoryForm,
  editCategoryForm,
  createCategory,
  updateCategory,
  deleteCategory,
};