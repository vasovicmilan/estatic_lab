import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { isJsonArrayOrArray, booleanishField } from "./helpers/common.validator.js";

// Existing gallery images are round-tripped as parallel arrays (img URL + alt
// text), since ImageSchema entries have no _id to key off (see image.schema.js,
// { _id: false }) - index position is how the controller matches them back up.
export const validateMediaUpdate = [
  body("existingGalleryImg")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Neispravan format postojeće galerije"),

  body("existingGalleryDesc")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Neispravan format opisa galerije"),

  body("removeGallery")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Neispravan format liste za uklanjanje"),

  body("newGalleryDesc")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 200 }).withMessage("Opis nove slike može imati najviše 200 karaktera"),

  // NOTE: parseJsonFields("videos") must run before this validator so `videos`
  // arrives as an actual array, not a JSON string, by the time we get here.
  body("videos")
    .optional()
    .isArray().withMessage("Videi moraju biti niz"),

  body("videos.*.url")
    .notEmpty().withMessage("URL videa je obavezan")
    .isLength({ max: 500 }).withMessage("URL videa je predugačak"),

  body("videos.*.title")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 150 }).withMessage("Naslov videa može imati najviše 150 karaktera"),

  body("videos.*.thumbnail")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 }).withMessage("URL thumbnail-a je predugačak"),

  booleanishField("videos.*.isExternal", true),

  collectValidationErrors,
];

export default { validateMediaUpdate };