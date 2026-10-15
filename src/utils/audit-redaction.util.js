// Personal data never goes into an audit/activity trail as a value.
//
// Why: those entries outlive the data they describe. Anonymizing or deleting a user
// erases their email/phone/address from the real documents, but a copy sitting in an
// audit entry for 1-2 years would defeat that. Phone numbers and street addresses are
// additionally encrypted at rest (see phone.util.js / address.schema.js) - writing the
// decrypted value into an unencrypted log would undo the encryption.
//
// So instead of trusting every call site to remember, recordAuditLog and recordActivity
// run everything through here: a value under a sensitive field name is replaced with
// REDACTED. The direction of the change is kept (set / cleared / changed), only the
// content is hidden - "[sakriveno] -> null" still tells you a phone number was removed.

export const REDACTED = "[sakriveno]";

// compared lowercase, exact match on the field name
const SENSITIVE_FIELDS = new Set([
  // contact data (phone + address are encrypted at rest, email is the login identity)
  "telefon",
  "phone",
  "phonenumber",
  "adresa",
  "address",
  "addresses",
  "ulica",
  "street",
  "email",
  // names of people
  "firstname",
  "lastname",
  "fullname",
  "ime",
  "prezime",
  "imeprezime",
  // free text typed by a person
  "napomena",
  "note",
  "message",
  "poruka",
  "comment",
  "komentar",
  // secrets
  "password",
  "lozinka",
  "token",
  "secret",
]);

// Records that describe the business, not a person: the salon's own email, phone and
// address in the site settings are exactly what an audit entry for them should show.
const EXEMPT_ENTITY_TYPES = new Set(["SiteSettings", "SiteContent"]);

export function isSensitiveField(name) {
  return SENSITIVE_FIELDS.has(String(name).toLowerCase());
}

export function isRedactionExempt(entityType) {
  return EXEMPT_ENTITY_TYPES.has(entityType);
}

function redactLeaf(value) {
  return value === null || value === undefined || value === "" ? null : REDACTED;
}

// walks plain objects/arrays and hides the value of every sensitive key found on the way
export function redactDeep(value) {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object" && !(value instanceof Date) && value.constructor === Object) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = isSensitiveField(key) ? redactLeaf(inner) : redactDeep(inner);
    }
    return out;
  }
  return value;
}

/**
 * `changes` is { field: { old, new } }. A sensitive field keeps its shape with both
 * sides hidden; every other field is searched for sensitive keys nested inside it.
 */
export function redactChanges(changes) {
  if (!changes || typeof changes !== "object") return changes ?? null;
  const out = {};
  for (const [field, pair] of Object.entries(changes)) {
    if (isSensitiveField(field)) {
      out[field] = { old: redactLeaf(pair?.old), new: redactLeaf(pair?.new) };
    } else if (pair && typeof pair === "object" && ("old" in pair || "new" in pair)) {
      out[field] = { old: redactDeep(pair.old), new: redactDeep(pair.new) };
    } else {
      out[field] = redactDeep(pair);
    }
  }
  return out;
}

export default { REDACTED, isSensitiveField, isRedactionExempt, redactDeep, redactChanges };
