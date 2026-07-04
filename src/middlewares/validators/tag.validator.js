import { body, param } from "express-validator";
import { CATEGORY_DOMAINS } from "../../models/category.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateTagCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv taga je obavezan")
    .isLength({ min: 2, max: 50 }).withMessage("Naziv mora imati između 2 i 50 karaktera"),

  // optional — auto-generated from name/title if omitted (see slug.util.js + the
  // corresponding create*() service function)
  body("slug")
    .optional({ values: "falsy" })
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("domain")
    .trim()
    .notEmpty().withMessage("Domen je obavezan")
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validateTagUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Naziv mora imati između 2 i 50 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("domain")
    .optional()
    .isIn(CATEGORY_DOMAINS).withMessage(`Domen mora biti jedan od: ${CATEGORY_DOMAINS.join(", ")}`),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validateTagId = [
  param("tagId").isMongoId().withMessage("Neispravan ID taga"),
  collectValidationErrors,
];

export default { validateTagCreate, validateTagUpdate, validateTagId };