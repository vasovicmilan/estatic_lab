import { body } from "express-validator";
import { CATEGORY_DOMAINS } from "../../models/category.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, slugField, booleanishField, mongoIdParamValidator, contentBlocksHaveSafeUrls } from "./helpers/common.validator.js";

export const validateCategoryCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv kategorije je obavezan")
    .isLength({ min: 2, max: 100 }).withMessage("Naziv mora imati između 2 i 100 karaktera"),

  slugField(true),

  body("domain")
    .trim()
    .notEmpty().withMessage("Domen je obavezan")
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  body("parent")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan ID roditeljske kategorije"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("longDescription")
    .optional()
    .trim(),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu")
    .custom(contentBlocksHaveSafeUrls).withMessage("Link u sadržaju mora koristiti dozvoljenu šemu (http, https, mailto, tel ili relativnu putanju)"),

  booleanishField("isIndexable"),

  body("priority")
    .optional()
    .isInt({ min: 0, max: 999 }).withMessage("Prioritet mora biti broj između 0 i 999"),

  booleanishField("isActive"),

  body("categoryImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFile)),

  collectValidationErrors,
];

export const validateCategoryUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Naziv mora imati između 2 i 100 karaktera"),

  slugField(false),

  body("domain")
    .optional()
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  body("parent")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan ID roditeljske kategorije"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu")
    .custom(contentBlocksHaveSafeUrls).withMessage("Link u sadržaju mora koristiti dozvoljenu šemu (http, https, mailto, tel ili relativnu putanju)"),

  booleanishField("isIndexable"),

  body("priority")
    .optional()
    .isInt({ min: 0, max: 999 }).withMessage("Prioritet mora biti broj između 0 i 999"),

  booleanishField("isActive"),

  body("categoryImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFile)),

  collectValidationErrors,
];

export const validateCategoryId = mongoIdParamValidator("categoryId", "kategorije");

export default { validateCategoryCreate, validateCategoryUpdate, validateCategoryId };