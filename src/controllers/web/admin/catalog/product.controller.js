import * as productService from "../../../../services/product.service.js";
import * as categoryService from "../../../../services/category.service.js";
import * as tagService from "../../../../services/tag.service.js";
import {
  prepareProductListData,
  prepareProductDetailsData,
  prepareProductCreateStep1Data,
  prepareProductFormData,
  prepareProductDetailsMediaStepData,
  prepareProductSeoPublishStepData,
  prepareProductSeoFormData,
} from "../../../../presenters/admin/catalog/product.presenter.js";
import { prepareMediaFormData } from "../../../../presenters/admin/media-form.presenter.js";
import { buildGalleryPayload, buildVideosPayload } from "../../../../utils/media-form.util.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

// complex nested arrays (variations, faq, relatedProducts) are submitted as JSON
// from the dynamic form-builder widgets rather than flat form fields
function parseJsonField(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIdArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

async function loadFormOptions() {
  const [categories, tags] = await Promise.all([
    categoryService.getCategoriesForSelect("product"),
    tagService.getTagsForSelect("product"),
  ]);
  return { categoryOptions: categories, tagOptions: tags };
}

async function loadProductOptions(excludeId = null) {
  const result = await productService.listProducts({ limit: 100 });
  return result.data.filter((p) => p.id !== excludeId).map((p) => ({ id: p.id, naziv: p.naziv }));
}

function buildPhase2Payload(req, existing = {}) {
  const image = req.uploadedFiles?.productImage
    ? { img: req.uploadedFiles.productImage.img, imgDesc: (req.body.imageDesc || "").trim() }
    : existing.image || null;

  const newGalleryFiles = req.uploadedFiles?.gallery ? [].concat(req.uploadedFiles.gallery) : [];
  const newGallery = newGalleryFiles.map((f) => ({ img: f.img, imgDesc: (req.body.galleryDesc || "").trim() }));
  const gallery = [...(existing.gallery || []), ...newGallery];

  const newVideoFiles = req.uploadedFiles?.video ? [].concat(req.uploadedFiles.video) : [];
  const newVideos = newVideoFiles.map((v) => ({ url: v.url, title: "", thumbnail: v.thumbnail || "", isExternal: false }));
  const videos = [...(existing.videos || []), ...newVideos];

  return {
    categories: toIdArray(req.body.categories),
    tags: toIdArray(req.body.tags),
    shortDescription: req.body.shortDescription || "",
    longDescription: req.body.longDescription || "",
    variations: parseJsonField(req.body.variations, []),
    image,
    gallery,
    videos,
  };
}

function buildPhase3Payload(req) {
  const seoKeywords = (req.body.seoKeywordsCsv || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    seoKeywords,
    relatedProducts: toIdArray(req.body.relatedProducts),
    faq: parseJsonField(req.body.faq),
    isActive: parseCheckbox(req.body.isActive),
  };
}

// kept for the existing single-shot edit route (PUT /:productId)
function buildProductPayload(req, existing = {}) {
  const data = { ...req.body };

  data.image = req.uploadedFiles?.productImage
    ? { img: req.uploadedFiles.productImage.img, imgDesc: (req.body.imageDesc || "").trim() }
    : existing.image || null;

  data.categories = toIdArray(req.body.categories);
  data.tags = toIdArray(req.body.tags);
  data.faq = parseJsonField(req.body.faq, existing.faq || []);
  data.isActive = parseCheckbox(req.body.isActive, existing.isActive ?? false);

  return data;
}

export async function listProducts(req, res, next) {
  try {
    const { search, isActive, inStock, page = 1, limit = 10 } = req.query;

    const result = await productService.listProducts({
      search: search || "",
      filters: {
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
        inStock: inStock === "true" ? true : inStock === "false" ? false : undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareProductListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Proizvodi",
      pageDescription: "Pregled svih proizvoda",
      data: viewData,
    });
  } catch (error) {
    logError("[listProducts] Greška pri učitavanju liste proizvoda", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function productDetails(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductById(productId);
    const viewData = prepareProductDetailsData(product);

    return res.render("admin/_details", {
      pageTitle: `Proizvod - ${product.naziv}`,
      pageDescription: product.kratakOpis || product.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[productDetails] Greška pri učitavanju detalja proizvoda", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Phase 1: bare minimum - just enough to get a row in the DB
// ---------------------------------------------------------------------------
export async function newProductForm(req, res, next) {
  try {
    const formData = prepareProductCreateStep1Data();
    return res.render("admin/_form", {
      pageTitle: "Novi proizvod",
      pageDescription: "Kreiraj novi proizvod - korak 1 od 3",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newProductForm] Greška pri prikazu forme za novi proizvod", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function createProductDraft(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createProductDraft] Validacione greške u fazi 1", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareProductCreateStep1Data();
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi proizvod",
        pageDescription: "Kreiraj novi proizvod - korak 1 od 3",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const product = await productService.createDraftProduct({ name: req.body.name, sku: req.body.sku, slug: req.body.slug });
    logInfo(`[createProductDraft] Nacrt proizvoda kreiran: "${product.name}"`, { productId: product.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Proizvod kreiran - dodajte detalje, varijante i medije", `/admin/proizvodi/${product.id}/dodavanje/detalji`);
  } catch (error) {
    logError("[createProductDraft] Greška u fazi 1 kreiranja proizvoda", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const formData = prepareProductCreateStep1Data();
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Novi proizvod",
        pageDescription: "Kreiraj novi proizvod - korak 1 od 3",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Phase 2: variations + content + media
// ---------------------------------------------------------------------------
export async function newProductDetailsMediaForm(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductForEdit(productId);
    const options = await loadFormOptions();
    const formData = prepareProductDetailsMediaStepData(product, options);
    return res.render("admin/_form", {
      pageTitle: `${product.name} - detalji i medija`,
      pageDescription: "Varijante, sadržaj i slike - korak 2 od 3",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newProductDetailsMediaForm] Greška pri prikazu forme za detalje", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function addProductDetailsMedia(req, res, next) {
  try {
    const { productId } = req.params;

    if (req.validationErrors) {
      logWarn(`[addProductDetailsMedia] Validacione greške u fazi 2 za productId=${productId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const product = await productService.getProductForEdit(productId);
      const options = await loadFormOptions();
      const formData = prepareProductDetailsMediaStepData(product, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `${product.name} - detalji i medija`,
        pageDescription: "Varijante, sadržaj i slike - korak 2 od 3",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await productService.getProductForEdit(productId);
    const data = buildPhase2Payload(req, existing);
    const product = await productService.addDetailsAndMedia(productId, data);
    logInfo(`[addProductDetailsMedia] Detalji i medija sačuvani za proizvod #${productId}`, { productId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Detalji sačuvani - podesite SEO i objavite proizvod", `/admin/proizvodi/${product.id}/dodavanje/seo`);
  } catch (error) {
    logError("[addProductDetailsMedia] Greška u fazi 2 kreiranja proizvoda", error, { productId: req.params.productId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404) {
      const product = await productService.getProductForEdit(req.params.productId).catch(() => null);
      if (product) {
        const options = await loadFormOptions();
        const formData = prepareProductDetailsMediaStepData(product, options);
        return res.status(statusCode).render("admin/_form", {
          pageTitle: `${product.name} - detalji i medija`,
          pageDescription: "Varijante, sadržaj i slike - korak 2 od 3",
          data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: SEO + remaining optional bits + publish
// ---------------------------------------------------------------------------
export async function newProductSeoPublishForm(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductForEdit(productId);
    const productOptions = await loadProductOptions(productId);
    const formData = prepareProductSeoPublishStepData(product, { productOptions });
    return res.render("admin/_form", {
      pageTitle: `${product.name} - SEO i objava`,
      pageDescription: "SEO, dodatni detalji i objava - korak 3 od 3",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newProductSeoPublishForm] Greška pri prikazu forme za SEO i objavu", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function publishProductStep(req, res, next) {
  try {
    const { productId } = req.params;

    if (req.validationErrors) {
      logWarn(`[publishProductStep] Validacione greške u fazi 3 za productId=${productId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const product = await productService.getProductForEdit(productId);
      const productOptions = await loadProductOptions(productId);
      const formData = prepareProductSeoPublishStepData(product, { productOptions });
      return res.status(400).render("admin/_form", {
        pageTitle: `${product.name} - SEO i objava`,
        pageDescription: "SEO, dodatni detalji i objava - korak 3 od 3",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildPhase3Payload(req);
    const product = await productService.addSeoAndPublish(productId, data);
    const message = data.isActive === false ? "Sačuvano kao nacrt" : "Proizvod je uspešno objavljen";
    logInfo(`[publishProductStep] Proizvod #${productId} ${data.isActive === false ? "sačuvan kao nacrt" : "objavljen"}`, { productId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", message, `/admin/proizvodi/detalji/${product.id}`);
  } catch (error) {
    logError("[publishProductStep] Greška u fazi 3 kreiranja proizvoda", error, { productId: req.params.productId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404) {
      const product = await productService.getProductForEdit(req.params.productId).catch(() => null);
      if (product) {
        const productOptions = await loadProductOptions(req.params.productId);
        const formData = prepareProductSeoPublishStepData(product, { productOptions });
        return res.status(statusCode).render("admin/_form", {
          pageTitle: `${product.name} - SEO i objava`,
          pageDescription: "SEO, dodatni detalji i objava - korak 3 od 3",
          data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

export async function editProductForm(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductForEdit(productId);
    const options = await loadFormOptions();
    const formData = prepareProductFormData(product, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${product.name}`,
      pageDescription: product.shortDescription || product.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editProductForm] Greška pri učitavanju forme za izmenu proizvoda", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { productId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateProduct] Validacione greške za productId=${productId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const product = await productService.getProductForEdit(productId);
      const options = await loadFormOptions();
      const formData = prepareProductFormData(product, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${product.name}`,
        pageDescription: product.shortDescription || product.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await productService.getProductForEdit(productId);
    const data = buildProductPayload(req, existing);
    const updated = await productService.updateProductById(productId, data);
    logInfo(`[updateProduct] Proizvod #${productId} ažuriran`, { productId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Proizvod je uspešno ažuriran", `/admin/proizvodi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateProduct] Greška pri ažuriranju proizvoda", error, { productId: req.params.productId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const product = await productService.getProductForEdit(req.params.productId).catch(() => null);
      const options = await loadFormOptions();
      const formData = prepareProductFormData(product, options);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: product ? `Izmena - ${product.name}` : "Izmena proizvoda",
        pageDescription: product?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Galerija i video
// ---------------------------------------------------------------------------
export async function editProductGalleryForm(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductForEdit(productId);
    const formData = prepareMediaFormData(product, {
      entityLabel: "proizvoda",
      listUrl: "/admin/proizvodi",
      listLabel: "Proizvodi",
      backUrl: `/admin/proizvodi/detalji/${productId}`,
      submitUrl: `/admin/proizvodi/${productId}/galerija`,
    });

    return res.render("admin/_media-form", {
      pageTitle: `Galerija i video - ${product.name}`,
      pageDescription: product.shortDescription || product.name,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editProductGalleryForm] Greška pri učitavanju forme za galeriju", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateProductGallery(req, res, next) {
  const { productId } = req.params;
  try {
    if (req.validationErrors) {
      logWarn(`[updateProductGallery] Validacione greške za productId=${productId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const product = await productService.getProductForEdit(productId);
      const formData = prepareMediaFormData(product, {
        entityLabel: "proizvoda",
        listUrl: "/admin/proizvodi",
        listLabel: "Proizvodi",
        backUrl: `/admin/proizvodi/detalji/${productId}`,
        submitUrl: `/admin/proizvodi/${productId}/galerija`,
      });
      return res.status(400).render("admin/_media-form", {
        pageTitle: `Galerija i video - ${product.name}`,
        pageDescription: product.shortDescription || product.name,
        data: { ...formData, errors: req.validationErrors, csrfToken: res.locals.csrfToken },
      });
    }

    const gallery = buildGalleryPayload(req);
    const videos = buildVideosPayload(req);

    const updated = await productService.updateProductById(productId, { gallery, videos });
    logInfo(`[updateProductGallery] Galerija/video proizvoda #${productId} ažurirani`, { productId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Galerija i video su uspešno ažurirani", `/admin/proizvodi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateProductGallery] Greška pri ažuriranju galerije/videa", error, { productId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404) {
      const product = await productService.getProductForEdit(productId).catch(() => null);
      if (product) {
        const formData = prepareMediaFormData(product, {
          entityLabel: "proizvoda",
          listUrl: "/admin/proizvodi",
          listLabel: "Proizvodi",
          backUrl: `/admin/proizvodi/detalji/${productId}`,
          submitUrl: `/admin/proizvodi/${productId}/galerija`,
        });
        return res.status(statusCode).render("admin/_media-form", {
          pageTitle: `Galerija i video - ${product.name}`,
          pageDescription: product.shortDescription || product.name,
          data: { ...formData, errors: { general: message }, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

export async function editProductSeoForm(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.getProductById(productId);
    const formData = prepareProductSeoFormData(product);

    return res.render("admin/_form", {
      pageTitle: `SEO - ${product.naziv}`,
      pageDescription: product.naziv,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editProductSeoForm] Greška pri učitavanju SEO forme", error, { productId: req.params.productId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateProductSeo(req, res, next) {
  try {
    const { productId } = req.params;
    const keywords = Array.isArray(req.body.seoKeywords)
      ? req.body.seoKeywords.filter(Boolean)
      : (req.body.seoKeywords || "").split(",").map((k) => k.trim()).filter(Boolean);

    const updated = await productService.updateProductSeo(productId, keywords);
    logInfo(`[updateProductSeo] SEO proizvoda #${productId} ažuriran`, { productId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "SEO podaci su uspešno ažurirani", `/admin/proizvodi/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateProductSeo] Greška pri ažuriranju SEO podataka", error, { productId: req.params.productId, userId: req.session?.user?.id });
    if (error.statusCode) {
      const product = await productService.getProductById(req.params.productId).catch(() => null);
      if (product) {
        const formData = prepareProductSeoFormData(product);
        return res.status(error.statusCode).render("admin/_form", {
          pageTitle: `SEO - ${product.naziv}`,
          pageDescription: product.naziv,
          data: { ...formData, errors: { general: error.message }, csrfToken: res.locals.csrfToken },
        });
      }
    }
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { productId } = req.params;
    await productService.deleteProductById(productId);
    logInfo(`[deleteProduct] Proizvod #${productId} obrisan`, { productId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Proizvod je uspešno obrisan", "/admin/proizvodi");
  } catch (error) {
    logError("[deleteProduct] Greška pri brisanju proizvoda", error, { productId: req.params.productId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/proizvodi");
    }
    next(error);
  }
}

export default {
  listProducts,
  productDetails,
  newProductForm,
  createProductDraft,
  newProductDetailsMediaForm,
  addProductDetailsMedia,
  newProductSeoPublishForm,
  publishProductStep,
  editProductForm,
  updateProduct,
  editProductGalleryForm,
  updateProductGallery,
  editProductSeoForm,
  updateProductSeo,
  deleteProduct,
};