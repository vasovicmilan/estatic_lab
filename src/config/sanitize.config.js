import mongoSanitize from "mongo-sanitize";

const DEFAULT_SKIP_KEYS = [
  "email",
  "mail",
  "password",
  "confirmedPassword",
  "confirmPassword",
];

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.constructor === Object
  );
}

function shouldSkip(key, skipKeys) {
  return skipKeys.some((skip) =>
    key.toLowerCase().includes(skip.toLowerCase())
  );
}

function sanitizeObject(obj, skipKeys) {
  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const value = obj[i];

      if (typeof value === "string") {
        obj[i] = mongoSanitize(value);
      } else if (Array.isArray(value) || isPlainObject(value)) {
        sanitizeObject(value, skipKeys);
      }
    }

    return obj;
  }

  for (const originalKey of Object.keys(obj)) {
    const value = obj[originalKey];

    // Preskoči određena polja (email, password...)
    if (shouldSkip(originalKey, skipKeys)) {
      continue;
    }

    // Sanitizuj naziv ključa ($, . ...)
    const sanitizedKey = mongoSanitize(originalKey);

    if (sanitizedKey !== originalKey) {
      obj[sanitizedKey] = value;
      delete obj[originalKey];
    }

    const currentValue = obj[sanitizedKey];

    if (typeof currentValue === "string") {
      obj[sanitizedKey] = mongoSanitize(currentValue);
    } else if (
      Array.isArray(currentValue) ||
      isPlainObject(currentValue)
    ) {
      sanitizeObject(currentValue, skipKeys);
    }
  }

  return obj;
}

export function setupSanitize(app, options = {}) {
  const skipKeys = options.skipKeys || DEFAULT_SKIP_KEYS;

  app.use((req, res, next) => {
    if (req.body) {
      sanitizeObject(req.body, skipKeys);
    }

    if (req.query) {
      sanitizeObject(req.query, skipKeys);
    }

    if (req.params) {
      sanitizeObject(req.params, skipKeys);
    }

    next();
  });
}