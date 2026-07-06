import { encrypt, decrypt, sha256 } from "../services/crypto.service.js";

function normalizePhone(raw) {
  if (!raw) return "";
  return String(raw).trim().replace(/[^\d+]/g, "");
}

export function buildPhoneRecord(rawPhone) {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;
  return {
    hash: sha256(normalized),
    encrypted: encrypt(normalized),
  };
}

export function decryptPhone(phoneRecord) {
  if (!phoneRecord) return null;
  if (typeof phoneRecord === "string") return phoneRecord || null;
  if (!phoneRecord.encrypted) return null;
  try {
    return decrypt(phoneRecord.encrypted);
  } catch {
    return null;
  }
}

export default { buildPhoneRecord, decryptPhone };