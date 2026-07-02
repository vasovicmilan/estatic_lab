import logger from "../config/logger.config.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordConfirm",
  "confirmedPassword",
  "oldPassword",
  "newPassword",
  "pass",
  "pwd",
  "creditCard",
  "cardNumber",
  "cvv",
  "token",
  "accessToken",
  "refreshToken",
  "resetToken",
  "confirmToken",
  "verificationToken",
  "unsubscribeToken",
  "secret",
  "apiKey",
  "csrfToken",
  "CSRFToken",
  "_csrf",
  "nickname",
]);

export function maskSensitive(obj, mask = "***") {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitive(item, mask));
  }

  const out = {};

  for (const key of Object.keys(obj)) {
    try {
      const val = obj[key];
      const lowerKey = String(key).toLowerCase();

      if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
        out[key] = mask;
      } else if (typeof val === "object" && val !== null && !(val instanceof Date)) {
        out[key] = maskSensitive(val, mask);
      } else {
        out[key] = val;
      }
    } catch (e) {
      out[key] = "[unserializable]";
    }
  }

  return out;
}

export function logInfo(message, data = {}) {
  logger.info({ msg: message, ...data });
}

export function logWarn(message, data = {}) {
  logger.warn({ msg: message, ...data });
}

export function logError(message, error = null, data = {}) {
  const logData = { msg: message, ...data };

  if (error) {
    logData.error = {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  logger.error(logData);
}

export function logDebug(message, data = {}) {
  logger.debug({ msg: message, ...data });
}

export default {
  maskSensitive,
  logInfo,
  logWarn,
  logError,
  logDebug,
};