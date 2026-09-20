import * as serviceService from "../../../services/service.service.js";
import * as packageService from "../../../services/package.service.js";
import * as productService from "../../../services/product.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Mirrors controllers/web/admin/catalog/{service,package,product}.controller.js -
// same services, same audit log entries. Image handling: neither Service.image nor
// Product.image is required at the DB level (unlike Expert.image), so these can be
// created/updated with no image at all and simply stay unpublishable until one is
// set - same as the web wizard's own draft-first design. When a client does provide
// one, it's a { img, imgDesc } object pointing at an already-hosted file (this API
// doesn't handle multipart upload - see admin-people.controller.js's header comment
// for the same reasoning applied to Expert.image).
//
// Services/products are built server-side as a 3-phase wizard on the web (a big
// form split across pages) - collapsed here into a single create call per resource,
// same "client sends everything it has in one shot" reasoning already applied to
// booking/checkout. Packages/products already have a genuine single-step service
// function each (createPackage, createProduct) reused directly, no phases to collapse.

// ---- Services ----

export async function listServices(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await serviceService.listServices({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listServices] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getService(req, res, next) {
  try {
    const service = await serviceService.getServiceById(req.params.serviceId);
    return res.json({ success: true, data: service });
  } catch (error) {
    logError("[api/admin/getService] Greška", error, { serviceId: req.params.serviceId });
    next(error);
  }
}

// getService (above) returns mapServiceForAdminDetail's display shape - formatted
// strings like duration: "60 min", Serbian field names - built for a read-only detail
// view. A form needs the OTHER shape: mapServiceForEdit's raw, English-keyed, directly
// re-editable values (duration: 60, not "60 min") - exactly what createService/
// updateService below already accept back and what the web admin's editServiceForm
// already uses via serviceService.getServiceForEdit (see controllers/web/admin/catalog/
// service.controller.js). The web app gets this split "for free" by having two routes
// (/detalji/:id vs /izmena/:id) render two different templates; an API client has no
// template to pick a shape for it, so it needs both shapes exposed explicitly. This is
// purely additive - getService's existing response is unchanged.
export async function getServiceForEdit(req, res, next) {
  try {
    const service = await serviceService.getServiceForEdit(req.params.serviceId);
    return res.json({ success: true, data: service });
  } catch (error) {
    logError("[api/admin/getServiceForEdit] Greška", error, { serviceId: req.params.serviceId });
    next(error);
  }
}

export async function createService(req, res, next) {
  try {
    // Phase 1 (createDraftService) always starts isActive:false with no packages -
    // phases 2/3 below then fill in the rest of what the client sent, in one request.
    let service = await serviceService.createDraftService(req.body);
    const serviceId = service.id;

    if (req.body.packages?.length) {
      service = await serviceService.addPackagesToService(serviceId, req.body.packages);
    }

    // Always runs, even with nothing extra to add - this is what actually applies
    // image/features/isActive and returns the final admin-detail shape (phase 1/2
    // alone return the lighter "edit" shape). isActive:true here throws a clear
    // "mora imati sliku"/"bar jednu varijantu" 400 if those aren't in place yet -
    // not a bug, matches assertPublishable's rule for the web flow too.
    service = await serviceService.addExtrasAndPublish(serviceId, req.body);

    logInfo(`[api/admin/createService] Usluga kreirana: "${service.naziv}"`, { serviceId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "SERVICE_CREATED", entity: { type: "Service", id: serviceId } });

    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    logError("[api/admin/createService] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateService(req, res, next) {
  try {
    const { serviceId } = req.params;
    const service = await serviceService.updateServiceById(serviceId, req.body);
    logInfo(`[api/admin/updateService] Usluga #${serviceId} ažurirana`, { serviceId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "SERVICE_UPDATED", entity: { type: "Service", id: serviceId } });
    return res.json({ success: true, data: service });
  } catch (error) {
    logError("[api/admin/updateService] Greška", error, { serviceId: req.params.serviceId, body: req.body });
    next(error);
  }
}

export async function updateServiceSeo(req, res, next) {
  try {
    const { serviceId } = req.params;
    const service = await serviceService.updateServiceSeo(serviceId, req.body.seoKeywords);
    return res.json({ success: true, data: service });
  } catch (error) {
    logError("[api/admin/updateServiceSeo] Greška", error, { serviceId: req.params.serviceId });
    next(error);
  }
}

export async function deleteService(req, res, next) {
  try {
    const { serviceId } = req.params;
    await serviceService.deleteServiceById(serviceId);
    logInfo(`[api/admin/deleteService] Usluga #${serviceId} obrisana`, { serviceId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "SERVICE_DELETED", entity: { type: "Service", id: serviceId } });
    return res.json({ success: true, data: { message: "Usluga je obrisana." } });
  } catch (error) {
    logError("[api/admin/deleteService] Greška", error, { serviceId: req.params.serviceId });
    next(error);
  }
}

// ---- Packages ----
// A package's items[] reference a real Service + one of its packages[] (variant
// slugs/ids) - see package.service.js's validateItems. `description` is required at
// the DB level (PackageSchema) even though createPackage's own explicit checks don't
// mention it - omitting it throws a raw Mongoose validation error, not a clean
// badRequest, so it's worth remembering as a genuinely required field.

export async function listPackages(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await packageService.listPackages({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listPackages] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPackage(req, res, next) {
  try {
    const pkg = await packageService.getPackageById(req.params.packageId);
    return res.json({ success: true, data: pkg });
  } catch (error) {
    logError("[api/admin/getPackage] Greška", error, { packageId: req.params.packageId });
    next(error);
  }
}

// Same reasoning as getServiceForEdit above: getPackage's mapPackageForAdminDetail
// shape is Serbian-keyed, pre-formatted DISPLAY data (formatted prices, `stavke`
// entries carrying resolved service/variant NAMES) - not re-postable as an update
// body. packageService.getPackageForEdit already existed (mapPackageForEdit,
// English-keyed, raw values) but had no route wired to it - this is purely
// additive, getPackage's existing response is unchanged.
export async function getPackageForEdit(req, res, next) {
  try {
    const pkg = await packageService.getPackageForEdit(req.params.packageId);
    return res.json({ success: true, data: pkg });
  } catch (error) {
    logError("[api/admin/getPackageForEdit] Greška", error, { packageId: req.params.packageId });
    next(error);
  }
}

export async function createPackage(req, res, next) {
  try {
    const pkg = await packageService.createPackage(req.body);
    logInfo(`[api/admin/createPackage] Paket kreiran: "${pkg.naziv}"`, { packageId: pkg.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PACKAGE_CREATED", entity: { type: "Package", id: pkg.id } });
    return res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    logError("[api/admin/createPackage] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updatePackage(req, res, next) {
  try {
    const { packageId } = req.params;
    const pkg = await packageService.updatePackageById(packageId, req.body);
    logInfo(`[api/admin/updatePackage] Paket #${packageId} ažuriran`, { packageId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PACKAGE_UPDATED", entity: { type: "Package", id: packageId } });
    return res.json({ success: true, data: pkg });
  } catch (error) {
    logError("[api/admin/updatePackage] Greška", error, { packageId: req.params.packageId, body: req.body });
    next(error);
  }
}

export async function deletePackage(req, res, next) {
  try {
    const { packageId } = req.params;
    await packageService.deletePackageById(packageId);
    logInfo(`[api/admin/deletePackage] Paket #${packageId} obrisan`, { packageId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PACKAGE_DELETED", entity: { type: "Package", id: packageId } });
    return res.json({ success: true, data: { message: "Paket je obrisan." } });
  } catch (error) {
    logError("[api/admin/deletePackage] Greška", error, { packageId: req.params.packageId });
    next(error);
  }
}

// ---- Products ----

export async function listProducts(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await productService.listProducts({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listProducts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.productId);
    return res.json({ success: true, data: product });
  } catch (error) {
    logError("[api/admin/getProduct] Greška", error, { productId: req.params.productId });
    next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    // createProduct (not the createDraftProduct wizard) - a genuine single-step
    // function that already accepts the full payload (variations included) at once.
    const product = await productService.createProduct(req.body);
    logInfo(`[api/admin/createProduct] Proizvod kreiran: "${product.naziv}"`, { productId: product.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PRODUCT_CREATED", entity: { type: "Product", id: product.id } });
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    logError("[api/admin/createProduct] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.updateProductById(productId, req.body);
    logInfo(`[api/admin/updateProduct] Proizvod #${productId} ažuriran`, { productId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PRODUCT_UPDATED", entity: { type: "Product", id: productId } });
    return res.json({ success: true, data: product });
  } catch (error) {
    logError("[api/admin/updateProduct] Greška", error, { productId: req.params.productId, body: req.body });
    next(error);
  }
}

export async function updateProductSeo(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await productService.updateProductSeo(productId, req.body.seoKeywords);
    return res.json({ success: true, data: product });
  } catch (error) {
    logError("[api/admin/updateProductSeo] Greška", error, { productId: req.params.productId });
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { productId } = req.params;
    await productService.deleteProductById(productId);
    logInfo(`[api/admin/deleteProduct] Proizvod #${productId} obrisan`, { productId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PRODUCT_DELETED", entity: { type: "Product", id: productId } });
    return res.json({ success: true, data: { message: "Proizvod je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteProduct] Greška", error, { productId: req.params.productId });
    next(error);
  }
}

export default {
  listServices, getService, getServiceForEdit, createService, updateService, updateServiceSeo, deleteService,
  listPackages, getPackage, getPackageForEdit, createPackage, updatePackage, deletePackage,
  listProducts, getProduct, createProduct, updateProduct, updateProductSeo, deleteProduct,
};
