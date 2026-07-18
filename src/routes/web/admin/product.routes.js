import { Router } from "express";
import * as ProductController from "../../../controllers/web/admin/catalog/product.controller.js";
import {
  validateProductStep1,
  validateProductDetailsMediaStep,
  validateProductSeoPublishStep,
  validateProductUpdate,
  validateProductSeo,
  validateProductId,
} from "../../../middlewares/validators/product.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { validateMediaUpdate } from "../../../middlewares/validators/media.validator.js";
import { parseJsonFields } from "../../../middlewares/parse-json-fields.middleware.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const productUploads = processMultipleUploads([{ name: "productImage", maxCount: 1, type: "products" }]);

// phase 2 handles the main image AND gallery/video in one submission
const productDetailsMediaUploads = processMultipleUploads([
  { name: "productImage", maxCount: 1, type: "products" },
  { name: "gallery", maxCount: 10, type: "products" },
  { name: "video", maxCount: 5, type: "products" },
]);

const productGalleryUploads = processMultipleUploads([
  { name: "gallery", maxCount: 10, type: "products" },
  { name: "video", maxCount: 5, type: "products" },
]);

router.get("/", validateSearch, ProductController.listProducts);
router.get("/detalji/:productId", validateProductId, ProductController.productDetails);
router.get("/izmena/:productId", validateProductId, ProductController.editProductForm);
router.get("/:productId/seo", validateProductId, ProductController.editProductSeoForm);

// --- 3-phase creation wizard ---

// Phase 1: bare minimum (name + sku only) - no file upload, no image required, so
// no multer needed here at all; normal CSRF middleware applies.
router.get("/dodavanje", ProductController.newProductForm);
router.post("/dodavanje", validateProductStep1, ProductController.createProductDraft);

// Phase 2: variations + content + media - this is now where the main image, gallery,
// and video get uploaded, so multer runs before CSRF here instead of on phase 1.
router.get("/:productId/dodavanje/detalji", validateProductId, ProductController.newProductDetailsMediaForm);
router.post(
  "/:productId/dodavanje/detalji",
  validateProductId,
  ...productDetailsMediaUploads,
  csrfAfterMulter,
  validateProductDetailsMediaStep,
  ProductController.addProductDetailsMedia
);

// Phase 3: SEO + remaining optional bits + publish (no file upload)
router.get("/:productId/dodavanje/seo", validateProductId, ProductController.newProductSeoPublishForm);
router.post(
  "/:productId/dodavanje/seo",
  validateProductId,
  validateProductSeoPublishStep,
  ProductController.publishProductStep
);

// --- existing single-shot edit flow ---
router.put(
  "/:productId",
  validateProductId,
  ...productUploads,
  csrfAfterMulter,
  validateProductUpdate,
  ProductController.updateProduct
);

router.put("/:productId/seo", validateProductId, validateProductSeo, ProductController.updateProductSeo);

// --- gallery & video (post-creation standalone edit) ---
router.get("/:productId/galerija", validateProductId, ProductController.editProductGalleryForm);
router.put(
  "/:productId/galerija",
  validateProductId,
  ...productGalleryUploads,
  csrfAfterMulter,
  parseJsonFields("videos"),
  validateMediaUpdate,
  ProductController.updateProductGallery
);

router.delete("/:productId", validateProductId, ProductController.deleteProduct);

export default router;