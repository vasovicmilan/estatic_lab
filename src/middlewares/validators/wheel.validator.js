import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";
import { LEAD_SEGMENTS } from "../../models/lead.model.js";

const isChecked = (value) => value === true || value === "true" || value === "on";

export const validateWheelSpin = [
  body("firstName").trim().notEmpty().withMessage("Ime je obavezno").isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),
  body("lastName").trim().notEmpty().withMessage("Prezime je obavezno").isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),
  body("phone")
    .trim()
    .notEmpty().withMessage("Telefon je obavezan")
    .custom((value) => /^\+?[\d\s/().-]{8,20}$/.test(value) && value.replace(/\D/g, "").length >= 8)
    .withMessage("Unesite ispravan broj telefona"),
  body("segment").isIn(LEAD_SEGMENTS).withMessage("Izaberite šta vas zanima"),
  body("source").optional({ values: "falsy" }).trim().matches(/^[a-z0-9_-]{1,60}$/i).withMessage("Neispravan izvor"),
  body("consentContact").custom(isChecked).withMessage("Morate prihvatiti da vas kontaktiramo u vezi nagrade"),
  body("consentMarketing").optional().custom((v) => v === undefined || v === "" || v === "false" || isChecked(v)),
  collectValidationErrors,
];

export const validatePrizeUpdate = [
  body("weight").isFloat({ min: 0, max: 100000 }).withMessage("Šansa mora biti broj 0 ili veći").toFloat(),
  body("stock")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 100000 }).withMessage("Zaliha mora biti ceo broj 0 ili veći")
    .toInt(),
  body("validDays").isInt({ min: 1, max: 365 }).withMessage("Rok važenja je 1-365 dana").toInt(),
  body("isActive").optional().customSanitizer(isChecked),
  collectValidationErrors,
];

export const validatePrizeId = mongoIdParamValidator("prizeId", "nagrade");
export const validateLeadId = mongoIdParamValidator("leadId", "kontakta");

export default { validateWheelSpin, validatePrizeUpdate, validatePrizeId, validateLeadId };
