import { body } from "express-validator";
import { CATEGORY_DOMAINS } from "../../models/category.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateTagCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv taga je obavezan")
    .isLength({ min: 2, max: 50 }).withMessage("Naziv mora imati između 2 i 50 karaktera"),

  slugField(true),

  body("domain")
    .trim()
    .notEmpty().withMessage("Domen je obavezan")
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  booleanishField("isActive"),

  collectValidationErrors,
];

export const validateTagUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Naziv mora imati između 2 i 50 karaktera"),

  slugField(false),

  body("domain")
    .optional()
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  booleanishField("isActive"),

  collectValidationErrors,
];

export const validateTagId = mongoIdParamValidator("tagId", "taga");

export default { validateTagCreate, validateTagUpdate, validateTagId };