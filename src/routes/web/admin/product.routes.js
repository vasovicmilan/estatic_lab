import { Router } from "express";
import * as ProductController from "../../../controllers/web/admin/catalog/product.controller.js";
import {
  validateProductStep1,
  validateProductVariationsStep,
  validateProductExtrasStep,
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

const productGalleryUploads = processMultipleUploads([
  { name: "gallery", maxCount: 10, type: "products" },
  { name: "video", maxCount: 5, type: "products" },
]);

router.get("/", validateSearch, ProductController.listProducts);
router.get("/detalji/:productId", validateProductId, ProductController.productDetails);
router.get("/izmena/:productId", validateProductId, ProductController.editProductForm);
router.get("/:productId/seo", validateProductId, ProductController.editProductSeoForm);

// --- 3-phase creation wizard ---
// Phase 1: core info + image (file upload -> needs multer before CSRF)
router.get("/dodavanje", ProductController.newProductForm);
router.post(
  "/dodavanje",
  ...productUploads,
  csrfAfterMulter,
  validateProductStep1,
  ProductController.createProductDraft
);

// Phase 2: variations (no file upload -> normal CSRF middleware applies)
router.get("/:productId/dodavanje/varijante", validateProductId, ProductController.newProductVariationsForm);
router.post(
  "/:productId/dodavanje/varijante",
  validateProductId,
  validateProductVariationsStep,
  ProductController.addProductVariations
);

// Phase 3: extras + publish (no file upload)
router.get("/:productId/dodavanje/detalji", validateProductId, ProductController.newProductExtrasForm);
router.post(
  "/:productId/dodavanje/detalji",
  validateProductId,
  validateProductExtrasStep,
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

// --- gallery & video ---
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