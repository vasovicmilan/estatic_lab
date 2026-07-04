import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateBookingConfirm = [
  body("serviceId")
    .notEmpty().withMessage("Usluga je obavezna")
    .isMongoId().withMessage("Neispravan ID usluge"),

  body("servicePackageId")
    .notEmpty().withMessage("Varijanta usluge je obavezna")
    .isMongoId().withMessage("Neispravna varijanta usluge"),

  body("employeeId")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan ID terapeuta"),

  body("startTime")
    .notEmpty().withMessage("Termin je obavezan")
    .isISO8601().withMessage("Neispravan format termina"),

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
    .isLength({ min: 6, max: 30 }).withMessage("Telefon nije validan"),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  body("couponCode")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 50 }).withMessage("Kod kupona nije validan"),

  collectValidationErrors,
];

export default { validateBookingConfirm };
