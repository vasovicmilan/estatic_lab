import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { isJsonArrayOrArray, isArrayOrString, mongoIdParamValidator } from "./helpers/common.validator.js";
// scheduledFor arrives as a naive "YYYY-MM-DDTHH:mm" datetime-local string with
// no timezone info - see post.validator.js's identical comment for why the
// "must be in the future" check needs zonedInputToUtcDate rather than a plain
// `new Date(value)`.
import { zonedInputToUtcDate } from "../../utils/date.time.util.js";

const NEWSLETTER_INTERESTS = ["general", "products", "partnership"];

export const validateCampaignCreate = [
  body("title")
    .trim()
    .notEmpty().withMessage("Naslov je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naslov mora imati između 2 i 150 karaktera"),

  body("subject")
    .trim()
    .notEmpty().withMessage("Predmet email-a je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Predmet mora imati između 2 i 150 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("targetInterests")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni segmenti"),

  body("targetInterests.*")
    .optional()
    .isIn(NEWSLETTER_INTERESTS).withMessage("Nepoznat segment"),

  body("status")
    .optional()
    .isIn(["draft", "scheduled"]).withMessage("Neispravan status"),

  body("scheduledFor")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Neispravan format datuma zakazivanja")
    .custom((value, { req }) => {
      if (req.body.status === "scheduled" && zonedInputToUtcDate(value) <= new Date()) {
        throw new Error("Datum zakazivanja mora biti u budućnosti");
      }
      return true;
    }),

  body("scheduledFor")
    .if(body("status").equals("scheduled"))
    .notEmpty().withMessage("Zakazana kampanja mora imati datum slanja"),

  collectValidationErrors,
];

export const validateCampaignUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naslov mora imati između 2 i 150 karaktera"),

  body("subject")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Predmet mora imati između 2 i 150 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("targetInterests")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni segmenti"),

  body("targetInterests.*")
    .optional()
    .isIn(NEWSLETTER_INTERESTS).withMessage("Nepoznat segment"),

  body("status")
    .optional()
    .isIn(["draft", "scheduled"]).withMessage("Neispravan status"),

  body("scheduledFor")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Neispravan format datuma zakazivanja")
    .custom((value, { req }) => {
      if (req.body.status === "scheduled" && zonedInputToUtcDate(value) <= new Date()) {
        throw new Error("Datum zakazivanja mora biti u budućnosti");
      }
      return true;
    }),

  body("scheduledFor")
    .if(body("status").equals("scheduled"))
    .notEmpty().withMessage("Zakazana kampanja mora imati datum slanja"),

  collectValidationErrors,
];

export const validateCampaignId = mongoIdParamValidator("campaignId", "kampanje");

export default { validateCampaignCreate, validateCampaignUpdate, validateCampaignId };
