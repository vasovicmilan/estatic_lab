import { body } from "express-validator";
import { PERMISSIONS, ROLE_NAMES } from "../../models/role.model.js";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateRoleCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv role je obavezan")
    .isIn(ROLE_NAMES).withMessage(`Naziv mora biti jedan od: ${ROLE_NAMES.join(", ")}`),

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
    .isIn(ROLE_NAMES).withMessage(`Naziv mora biti jedan od: ${ROLE_NAMES.join(", ")}`),

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