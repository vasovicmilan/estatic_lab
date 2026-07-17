import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

// Phase 1 - core info + image. No `packages` rule here anymore: that's phase 2's job.
export const validateServiceStep1 = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv usluge je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

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

  body("defaultDuration")
    .optional()
    .isInt({ min: 5 }).withMessage("Trajanje mora biti najmanje 5 minuta"),

  body("ctaText")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("CTA tekst može imati najviše 50 karaktera"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

// Phase 2 - packages/variants. The one field that's actually required to publish.
export const validateServicePackagesStep = [
  body("packages")
    .notEmpty().withMessage("Usluga mora imati bar jednu varijantu")
    .custom(isJsonArrayOrArray).withMessage("Varijante nisu u ispravnom formatu"),

  collectValidationErrors,
];

// Phase 3 - everything optional, plus the publish toggle.
export const validateServiceExtrasStep = [
  body("features")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Karakteristike nisu u ispravnom formatu"),

  body("comparisonTable")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Tabela poređenja nije u ispravnom formatu"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  body("employees")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni zaposleni"),

  booleanishField("highlight", true),

  // default true when the field is present-but-empty-ish is handled in the controller
  // (nullish coalescing to `true`) - this rule just validates the shape if it's sent.
  booleanishField("isActive", true),

  collectValidationErrors,
];

// Kept for the existing single-shot edit flow (PUT /:serviceId) - editing an
// already-published service isn't the pain point, only first-time creation was.
export const validateServiceUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(false),
  
  body("defaultDuration")
    .optional()
    .isInt({ min: 5 }).withMessage("Trajanje mora biti najmanje 5 minuta"),

  body("packages")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Varijante nisu u ispravnom formatu"),

  body("features")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Karakteristike nisu u ispravnom formatu"),

  body("comparisonTable")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Tabela poređenja nije u ispravnom formatu"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  booleanishField("highlight", true),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

export const validateServiceSeo = [
  body("seoKeywords")
    .optional(),
  collectValidationErrors,
];

export const validateServiceId = mongoIdParamValidator("serviceId", "usluge");

export default {
  validateServiceStep1,
  validateServicePackagesStep,
  validateServiceExtrasStep,
  validateServiceUpdate,
  validateServiceSeo,
  validateServiceId,
};