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

// URL schemes a content-block link (a "cta"/"serviceReference"/"productReference"
// block's button.url, or a "video" block's video.url) is allowed to use. Anything
// else - most importantly "javascript:" and "data:" - would execute when the link
// is clicked (or, for a "javascript:" URI placed as a <video src>, in some
// contexts on load), so it's rejected at save time rather than left to whatever
// the admin form happens to submit.
const ALLOWED_CONTENT_URL_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * True for an absolute URL using one of ALLOWED_CONTENT_URL_SCHEMES, or a
 * root-relative path ("/usluge/masaza"). False for anything else, including a
 * bare relative path (no reliable way to tell "javascript:alert(1)" apart from
 * a relative path without a scheme, so only the unambiguous root-relative form
 * is allowed) and any other scheme ("javascript:", "data:", "vbscript:", ...).
 */
export function isSafeContentUrl(url) {
  if (typeof url !== "string") return false;
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true; // root-relative path (not a protocol-relative "//host/..." URL)
  try {
    return ALLOWED_CONTENT_URL_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Walks a content-blocks array (or its JSON-string form, as it arrives from the
 * admin form's repeater) and checks every block.button.url / block.video.url
 * against isSafeContentUrl. Used as a `.custom()` validator alongside
 * isJsonArrayOrArray on any "content"/"longDescription" field backed by
 * ContentBlogSchema (see content.blog.schema.js) - Post, BusinessPartner,
 * Campaign, Category.content, Product.longDescription.
 *
 * Malformed/non-array input is left to isJsonArrayOrArray to reject - this
 * only fails closed on urls it can actually see, and passes through anything
 * it can't parse as an array so error messages don't collide.
 */
export function contentBlocksHaveSafeUrls(value) {
  let blocks = value;
  if (typeof value === "string") {
    try {
      blocks = JSON.parse(value);
    } catch {
      return true;
    }
  }
  if (!Array.isArray(blocks)) return true;

  return blocks.every((block) => {
    if (!block || typeof block !== "object") return true;
    if (block.button?.url && !isSafeContentUrl(block.button.url)) return false;
    if (block.video?.url && !isSafeContentUrl(block.video.url)) return false;
    return true;
  });
}

export function slugField(isCreate = false) {
  return body("slug")
    .optional(isCreate ? { values: "falsy" } : undefined)
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice");
}

export function booleanishField(fieldName, allowCheckbox = false) {
  const allowed = allowCheckbox
    ? ["true", "false", true, false, "on", "1", "0"]
    : ["true", "false", true, false, "1", "0"];
  return body(fieldName)
    .optional()
    .customSanitizer((value) => {
      if (Array.isArray(value)) {
        return value[value.length - 1];
      }
      return value;
    })
    .isIn(allowed)
    .withMessage("Neispravna vrednost");
}

export function mongoIdParamValidator(paramName, label) {
  return [
    param(paramName).isMongoId().withMessage(`Neispravan ID ${label}`),
    collectValidationErrors,
  ];
}

export default { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator, isSafeContentUrl, contentBlocksHaveSafeUrls };