import { body } from "express-validator";
import { PERMISSIONS } from "../../models/role.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

// matches the schema-level format check in role.model.js — kept in sync deliberately
// so a bad name fails here with a clean validation message instead of a raw
// Mongoose ValidationError further down
const ROLE_NAME_FORMAT = /^[a-z][a-z0-9_-]{1,31}$/;
const ROLE_NAME_FORMAT_MESSAGE =
  "Naziv mora počinjati slovom i sadržati samo mala slova, brojeve, crtice ili donje crte (2-32 karaktera)";

export const validateRoleCreate = [
  body("name")
    .trim()
    .toLowerCase()
    .notEmpty().withMessage("Naziv role je obavezan")
    .matches(ROLE_NAME_FORMAT).withMessage(ROLE_NAME_FORMAT_MESSAGE),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Opis može imati najviše 300 karaktera"),

  body("permissions")
    .optional()
    .isArray().withMessage("Permisije moraju biti niz"),

  body("permissions.*")
    .optional()
    .isIn(PERMISSIONS).withMessage("Neispravna permisija"),

  booleanishField("isDefault"),

  body("priority")
    .optional()
    .isInt({ min: 0 }).withMessage("Prioritet mora biti pozitivan broj"),

  collectValidationErrors,
];

export const validateRoleUpdate = [
  body("name")
    .optional()
    .trim()
    .toLowerCase()
    .matches(ROLE_NAME_FORMAT).withMessage(ROLE_NAME_FORMAT_MESSAGE),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Opis može imati najviše 300 karaktera"),

  body("permissions")
    .optional()
    .isArray().withMessage("Permisije moraju biti niz"),

  body("permissions.*")
    .optional()
    .isIn(PERMISSIONS).withMessage("Neispravna permisija"),

  booleanishField("isDefault"),

  body("priority")
    .optional()
    .isInt({ min: 0 }).withMessage("Prioritet mora biti pozitivan broj"),

  collectValidationErrors,
];

export const validateRoleId = mongoIdParamValidator("roleId", "role");

export default { validateRoleCreate, validateRoleUpdate, validateRoleId };