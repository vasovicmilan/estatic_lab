import { body, param } from "express-validator";
import { collectValidationErrors } from "../collect-validation-errors.js";

export function isJsonArrayOrArray(value) {
  if (Array.isArray(value)) return true;
  if (typeof value !== "string") return false;
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

export function isArrayOrString(value) {
  return Array.isArray(value) || typeof value === "string";
}

export function slugField(isCreate = false) {
  return body("slug")
    .optional(isCreate ? { values: "falsy" } : undefined)
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice");
}

export function booleanishField(fieldName, allowCheckbox = false) {
  const allowed = allowCheckbox ? ["true", "false", true, false, "on"] : ["true", "false", true, false];
  return body(fieldName)
    .optional()
    .isIn(allowed).withMessage("Neispravna vrednost");
}

export function mongoIdParamValidator(paramName, label) {
  return [
    param(paramName).isMongoId().withMessage(`Neispravan ID ${label}`),
    collectValidationErrors,
  ];
}

export default { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator };