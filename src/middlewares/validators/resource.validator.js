import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateResourceCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv resursa je obavezan")
    .isLength({ min: 2, max: 80 }).withMessage("Naziv mora imati između 2 i 80 karaktera"),

  body("capacity")
    .notEmpty().withMessage("Kapacitet je obavezan")
    .isInt({ min: 1 }).withMessage("Kapacitet mora biti ceo broj veći ili jednak 1")
    .toInt(),

  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateResourceUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage("Naziv mora imati između 2 i 80 karaktera"),

  body("capacity")
    .optional()
    .isInt({ min: 1 }).withMessage("Kapacitet mora biti ceo broj veći ili jednak 1")
    .toInt(),

  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateResourceId = mongoIdParamValidator("resourceId", "resursa");

export default { validateResourceCreate, validateResourceUpdate, validateResourceId };