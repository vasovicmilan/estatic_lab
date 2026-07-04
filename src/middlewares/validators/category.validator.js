import { body, param } from "express-validator";
import { CATEGORY_DOMAINS } from "../../models/category.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateCategoryCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv kategorije je obavezan")
    .isLength({ min: 2, max: 100 }).withMessage("Naziv mora imati između 2 i 100 karaktera"),

  body("slug")
    .trim()
    .notEmpty().withMessage("Slug je obavezan")
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

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

  body("isIndexable")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost za indeksiranje"),

  body("priority")
    .optional()
    .isInt({ min: 0, max: 999 }).withMessage("Prioritet mora biti broj između 0 i 999"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost za aktivnost"),

  collectValidationErrors,
];

export const validateCategoryUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Naziv mora imati između 2 i 100 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

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

  body("isIndexable")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost za indeksiranje"),

  body("priority")
    .optional()
    .isInt({ min: 0, max: 999 }).withMessage("Prioritet mora biti broj između 0 i 999"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost za aktivnost"),

  collectValidationErrors,
];

export const validateCategoryId = [
  param("categoryId").isMongoId().withMessage("Neispravan ID kategorije"),
  collectValidationErrors,
];

export default { validateCategoryCreate, validateCategoryUpdate, validateCategoryId };
