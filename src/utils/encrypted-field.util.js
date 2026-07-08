import { encrypt, decrypt } from "../services/crypto.service.js";

export function encryptField(value) {
  if (!value) return undefined;
  return encrypt(String(value).trim());
}

export function decryptField(value) {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

export default { encryptField, decryptField };