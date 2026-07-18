import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

// Phase 1 - core info + image. No `variations` rule here: that's phase 2's job.
export const validateProductStep1 = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv proizvoda je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("sku")
    .trim()
    .notEmpty().withMessage("SKU je obavezan")
    .isLength({ min: 2, max: 60 }).withMessage("SKU mora imati između 2 i 60 karaktera"),

  slugField(true),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("categories")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni tagovi"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.productImage)),

  collectValidationErrors,
];

// Phase 2 - variations. The one field that's actually required to publish.
export const validateProductVariationsStep = [
  body("variations")
    .notEmpty().withMessage("Proizvod mora imati bar jednu varijantu")
    .custom(isJsonArrayOrArray).withMessage("Varijante nisu u ispravnom formatu"),

  collectValidationErrors,
];

// Phase 3 - everything optional, plus the publish toggle.
export const validateProductExtrasStep = [
  body("relatedProducts")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni povezani proizvodi"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

// Kept for the existing single-shot edit flow (PUT /:productId).
export const validateProductUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("sku")
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage("SKU mora imati između 2 i 60 karaktera"),

  slugField(false),

  body("categories")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni tagovi"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.productImage)),

  collectValidationErrors,
];

export const validateProductSeo = [
  body("seoKeywords")
    .optional(),
  collectValidationErrors,
];

export const validateProductId = mongoIdParamValidator("productId", "proizvoda");

export default {
  validateProductStep1,
  validateProductVariationsStep,
  validateProductExtrasStep,
  validateProductUpdate,
  validateProductSeo,
  validateProductId,
};