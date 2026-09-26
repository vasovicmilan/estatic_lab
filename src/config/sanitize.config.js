function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  // Express's query-string parser (qs) builds req.query out of objects
  // created with Object.create(null) - no prototype at all - rather than
  // ordinary {} object literals. The original `value.constructor === Object`
  // check rejects those (constructor is undefined on a null-prototype
  // object), which silently skipped sanitization of req.query entirely.
  // Accept both a null prototype and the ordinary Object.prototype.
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

// A key is a MongoDB operator/path-injection vector if it starts with "$"
// (query/update operators like $gt, $where, $ne, $set...) or contains "."
// (dotted-path traversal into nested/embedded documents).
function isDangerousKey(key) {
  return key.startsWith("$") || key.includes(".");
}

// Recursively strips dangerous keys from an object/array IN PLACE and
// returns the same reference. Note: this only helps callers whose object
// reference is stable across reads (req.body, req.params). It must NOT be
// relied on for req.query under Express 5 - see setupSanitize below.
//
// Recursion is unconditional for every nested object/array, including ones
// found under fields like "email" or "password": the classic bypass for
// this kind of sanitizer is sending an object instead of a string for such
// a field (e.g. `{ email: { $ne: null } }`), so a field-name allowlist that
// skips recursion would defeat the whole point of this middleware.
function sanitizeObject(obj) {
  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const value = obj[i];
      if (Array.isArray(value) || isPlainObject(value)) {
        sanitizeObject(value);
      }
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    if (isDangerousKey(key)) {
      // Drop the key entirely rather than rename it: renaming risks
      // colliding with an existing sibling key and still leaks the
      // attacker-controlled value under a new name.
      delete obj[key];
      continue;
    }

    const value = obj[key];
    if (Array.isArray(value) || isPlainObject(value)) {
      sanitizeObject(value);
    }
  }

  return obj;
}

export function setupSanitize(app) {
  app.use((req, res, next) => {
    if (req.body) {
      sanitizeObject(req.body);
    }

    if (req.params) {
      sanitizeObject(req.params);
    }

    if (req.query) {
      // Express 5 turns req.query into a getter that re-parses the raw query
      // string into a BRAND NEW object on every access, instead of caching a
      // single mutable object like Express 4 did. That means mutating the
      // object returned by `req.query` here (in place, via delete/reassign)
      // is silently discarded the next time anything downstream reads
      // req.query - they get a fresh, unsanitized object, not the one we
      // just cleaned. (Verified empirically: two reads of req.query in the
      // same request are two distinct object references.)
      //
      // req.body and req.params don't have this problem - they're plain
      // assignable properties whose object identity is stable across reads
      // in the same request, so mutating them in place above is sufficient.
      //
      // The fix: sanitize the object the getter hands us, then use
      // Object.defineProperty to install it as a plain, writable, cached
      // property on req, which shadows Express's getter/setter pair for the
      // rest of this request and makes every later `req.query` read return
      // this same sanitized object.
      const sanitizedQuery = sanitizeObject(req.query);
      Object.defineProperty(req, "query", {
        value: sanitizedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  });
}

export { sanitizeObject, isDangerousKey };
