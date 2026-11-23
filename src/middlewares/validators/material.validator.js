import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateMaterialCreate = [
  body("title")
    .trim()
    .notEmpty().withMessage("Naziv je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Opis može imati najviše 1000 karaktera"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateMaterialUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Opis može imati najviše 1000 karaktera"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateMaterialId = mongoIdParamValidator("materialId", "materijala");

export default { validateMaterialCreate, validateMaterialUpdate, validateMaterialId };
