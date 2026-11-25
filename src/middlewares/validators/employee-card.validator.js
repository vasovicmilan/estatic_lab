import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

const FLAGS = ["isPublic", "showPhone", "showEmail", "showBio", "showInstagram", "showFacebook", "showWebsite", "showServices", "showProducts", "copyExpertPhoto", "removePhoto"];

export const validateEmployeeCard = [
  body("displayName").optional().trim().isLength({ max: 80 }).withMessage("Ime na vizitki može imati najviše 80 karaktera"),
  body("title").optional().trim().isLength({ max: 80 }).withMessage("Titula može imati najviše 80 karaktera"),
  body("bio").optional().trim().isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),
  body("instagram").optional().trim().isLength({ max: 200 }).withMessage("Instagram može imati najviše 200 karaktera"),
  body("facebook").optional().trim().isLength({ max: 200 }).withMessage("Facebook može imati najviše 200 karaktera"),
  body("website").optional().trim().isLength({ max: 200 }).withMessage("Sajt može imati najviše 200 karaktera"),
  body("categories.*").optional().isMongoId().withMessage("Neispravna kategorija"),
  body("pinnedServices.*").optional().isMongoId().withMessage("Neispravna usluga"),
  body("pinnedServices").optional().custom((value) => (Array.isArray(value) ? value.length : 1) <= 3).withMessage("Možete izdvojiti najviše 3 usluge"),
  body("pinnedProducts.*").optional().isMongoId().withMessage("Neispravan artikal"),
  body("pinnedProducts").optional().custom((value) => (Array.isArray(value) ? value.length : 1) <= 6).withMessage("Možete izdvojiti najviše 6 artikala"),
  body("materialId").optional({ values: "falsy" }).isMongoId().withMessage("Neispravan materijal"),
  ...FLAGS.map((name) => booleanishField(name, true)),
  collectValidationErrors,
];

export const validateEmployeeCardId = mongoIdParamValidator("cardId", "vizitke");

export default { validateEmployeeCard, validateEmployeeCardId };
