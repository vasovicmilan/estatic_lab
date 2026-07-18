import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateAddToCart = [
  body("productId")
    .notEmpty().withMessage("Proizvod je obavezan")
    .isMongoId().withMessage("Neispravan proizvod"),

  body("variantId")
    .notEmpty().withMessage("Varijanta je obavezna")
    .isMongoId().withMessage("Neispravna varijanta"),

  body("quantity")
    .optional()
    .isInt({ min: 1, max: 99 }).withMessage("Količina mora biti između 1 i 99"),

  collectValidationErrors,
];

export const validateUpdateCartItem = [
  body("quantity")
    .notEmpty().withMessage("Količina je obavezna")
    .isInt({ min: 0, max: 99 }).withMessage("Količina mora biti između 0 i 99"),

  body("cartItemId")
    .optional()
    .isMongoId().withMessage("Neispravna stavka korpe"),

  body("productId")
    .optional()
    .isMongoId().withMessage("Neispravan proizvod"),

  body("variantId")
    .optional()
    .isMongoId().withMessage("Neispravna varijanta"),

  collectValidationErrors,
];

export const validateRemoveCartItem = [
  body("cartItemId")
    .optional()
    .isMongoId().withMessage("Neispravna stavka korpe"),

  body("productId")
    .optional()
    .isMongoId().withMessage("Neispravan proizvod"),

  body("variantId")
    .optional()
    .isMongoId().withMessage("Neispravna varijanta"),

  collectValidationErrors,
];

export const validateCheckout = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("Ime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 50 }).withMessage("Prezime može imati najviše 50 karaktera"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("phone")
    .trim()
    .notEmpty().withMessage("Telefon je obavezan")
    .isLength({ min: 6, max: 30 }).withMessage("Neispravan broj telefona"),

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

  body("note")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  body("couponCode")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 50 }).withMessage("Neispravan kod kupona"),

  collectValidationErrors,
];

export default { validateAddToCart, validateUpdateCartItem, validateRemoveCartItem, validateCheckout };