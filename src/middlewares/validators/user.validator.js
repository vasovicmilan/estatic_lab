import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateUserStatus = [
  body("status")
    .trim()
    .notEmpty().withMessage("Status je obavezan")
    .isIn(["guest", "pending", "active", "inactive", "suspended"]).withMessage("Neispravan status"),

  collectValidationErrors,
];

export const validateUserRole = [
  body("role")
    .trim()
    .notEmpty().withMessage("Rola je obavezna")
    .isMongoId().withMessage("Neispravan ID role"),

  collectValidationErrors,
];

export const validateUserId = mongoIdParamValidator("userId", "korisnika");

export const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 30 }).withMessage("Telefon nije validan"),

  collectValidationErrors,
];

export const validateAddressCreate = [
  body("label")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 50 }).withMessage("Naziv adrese može imati najviše 50 karaktera"),

  body("city")
    .trim()
    .notEmpty().withMessage("Grad je obavezan"),

  body("postalCode")
    .trim()
    .notEmpty().withMessage("Poštanski broj je obavezan"),

  body("street")
    .trim()
    .notEmpty().withMessage("Ulica je obavezna"),

  body("number")
    .trim()
    .notEmpty().withMessage("Broj je obavezan"),

  collectValidationErrors,
];

export const validateAddressId = mongoIdParamValidator("addressId", "adrese");

export default { validateUserStatus, validateUserRole, validateUserId, validateProfileUpdate, validateAddressCreate, validateAddressId };