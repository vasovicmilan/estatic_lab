import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateOrderCancel = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateOrderReturn = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateOrderContactUpdate = [
  body("phone")
    .optional()
    .trim()
    .isLength({ min: 6, max: 30 }).withMessage("Neispravan broj telefona"),

  body("address.city")
    .optional()
    .trim()
    .notEmpty().withMessage("Grad je obavezan"),

  body("address.postalCode")
    .optional()
    .trim()
    .notEmpty().withMessage("Poštanski broj je obavezan"),

  body("address.street")
    .optional()
    .trim()
    .notEmpty().withMessage("Ulica je obavezna"),

  body("address.number")
    .optional()
    .trim()
    .notEmpty().withMessage("Broj je obavezan"),

  collectValidationErrors,
];

export const validateManualOrderCreate = [
  // one row per product: items[0][productId], items[0][variantId], items[0][quantity] and an
  // optional items[0][price] (empty = the variant's catalog price)
  body("items").custom((value) => {
    const rows = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
    if (rows.length === 0) throw new Error("Dodajte bar jedan proizvod");
    if (rows.length > 20) throw new Error("Porudžbina može imati najviše 20 stavki");
    return true;
  }),
  body("items.*.productId").notEmpty().withMessage("Proizvod je obavezan").isMongoId().withMessage("Neispravan ID proizvoda"),
  body("items.*.variantId").notEmpty().withMessage("Varijanta je obavezna").isMongoId().withMessage("Neispravan ID varijante"),
  body("items.*.quantity").notEmpty().withMessage("Količina je obavezna").isInt({ min: 1 }).withMessage("Količina mora biti pozitivan ceo broj"),
  body("items.*.price").optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage("Cena proizvoda mora biti pozitivan broj"),
  body("existingUserId").optional({ checkFalsy: true }).isMongoId().withMessage("Neispravan ID korisnika"),
  // firstName/email are conditionally required client-side (see
  // admin-manual-order.js) depending on whether an existing user was picked -
  // not enforced strictly here, mirroring manual-appointment's same reasoning.
  body("firstName").optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage("Ime može imati najviše 100 karaktera"),
  body("lastName").optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage("Prezime može imati najviše 100 karaktera"),
  body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("Neispravna email adresa"),
  body("phone").notEmpty().withMessage("Telefon je obavezan").trim().isLength({ max: 30 }).withMessage("Neispravan broj telefona"),
  body("address.city").notEmpty().withMessage("Grad je obavezan").trim().isLength({ max: 100 }),
  body("address.street").notEmpty().withMessage("Ulica je obavezna").trim().isLength({ max: 150 }),
  body("address.number").notEmpty().withMessage("Broj je obavezan").trim().isLength({ max: 20 }),
  body("address.postalCode").notEmpty().withMessage("Poštanski broj je obavezan").trim().isLength({ max: 20 }),
  body("shipping").optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage("Cena dostave mora biti pozitivan broj"),
  body("note").optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).withMessage("Napomena može imati najviše 1000 karaktera"),
  // overrides every per-product price when given; "0" is a valid value (a gift) - only an
  // empty field means "automatic"
  body("finalTotal").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Finalna cena mora biti pozitivan broj"),

  collectValidationErrors,
];

export const validateOrderId = mongoIdParamValidator("orderId", "porudžbine");

export default {
  validateOrderCancel,
  validateOrderReturn,
  validateOrderContactUpdate,
  validateManualOrderCreate,
  validateOrderId,
};