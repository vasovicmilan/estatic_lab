import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";
import { LEAD_SEGMENTS } from "../../models/lead.model.js";

// the generic admin form posts a hidden "0" next to every checkbox
const isCheckedOrOne = (value) => (Array.isArray(value) ? value.includes("1") || value.includes("true") : value === true || value === "1" || value === "true" || value === "on");
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

const toList = (value) => {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean);
};

// full prize form (add + edit). Business rules (one fallback, active count, stock >= awarded...) live in the service.
const prizeFormRules = [
  body("label").trim().notEmpty().withMessage("Naziv nagrade je obavezan").isLength({ max: 80 }).withMessage("Naziv može imati najviše 80 karaktera"),
  body("shortLabel").trim().notEmpty().withMessage("Kratak naziv je obavezan").isLength({ max: 18 }).withMessage("Kratak naziv može imati najviše 18 karaktera"),
  body("discountType").isIn(["percentage", "fixed"]).withMessage("Izaberite tip popusta"),
  body("discountValue").isFloat({ gt: 0, max: 1000000 }).withMessage("Vrednost popusta mora biti veća od 0").toFloat(),
  body("maxDiscountAmount").optional({ values: "falsy" }).isFloat({ min: 0, max: 1000000 }).withMessage("Gornja granica mora biti broj 0 ili veći").toFloat(),
  body("weight").isFloat({ min: 0, max: 100000 }).withMessage("Šansa mora biti broj 0 ili veći").toFloat(),
  body("stock").optional({ values: "falsy" }).isInt({ min: 0, max: 100000 }).withMessage("Zaliha mora biti ceo broj 0 ili veći").toInt(),
  body("validDays").isInt({ min: 1, max: 365 }).withMessage("Rok važenja je 1-365 dana").toInt(),
  body("order").optional({ values: "falsy" }).isInt({ min: -1000, max: 1000 }).withMessage("Redosled mora biti ceo broj").toInt(),
  body("color").optional({ values: "falsy" }).trim().matches(/^#[0-9a-f]{6}$/i).withMessage("Boja mora biti u obliku #rrggbb"),
  body("serviceSlugs").customSanitizer(toList),
  body("includeProducts").optional().customSanitizer(isCheckedOrOne),
  body("isActive").optional().customSanitizer(isCheckedOrOne),
  body("isFallback").optional().customSanitizer(isCheckedOrOne),
  collectValidationErrors,
];

export const validatePrizeCreate = prizeFormRules;
export const validatePrizeFullUpdate = prizeFormRules;

export const validatePrizeId = mongoIdParamValidator("prizeId", "nagrade");
export const validateLeadId = mongoIdParamValidator("leadId", "kontakta");

export default { validateWheelSpin, validatePrizeCreate, validatePrizeFullUpdate, validatePrizeUpdate, validatePrizeId, validateLeadId };
