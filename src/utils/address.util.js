import { encrypt, decrypt, sha256 } from "../services/crypto.service.js";

function hashAddress({ city, street, number, postalCode }) {
  return sha256(`${street}|${number}|${city}|${postalCode}`.toLowerCase().trim());
}

// plainAddress: { label?, city, street, number, postalCode, isDefault? }
export function buildAddressRecord(plainAddress) {
  if (!plainAddress) return null;
  const { label = "", city, street, number, postalCode, isDefault = false } = plainAddress;
  if (!city || !street || !number || !postalCode) return null;

  return {
    label: label.trim(),
    city: city.trim(),
    postalCode: postalCode.trim(),
    street: encrypt(String(street).trim()),
    number: encrypt(String(number).trim()),
    hash: hashAddress({ city, street, number, postalCode }),
    isDefault,
  };
}

export function decryptAddress(addressRecord) {
  if (!addressRecord) return null;
  try {
    return {
      id: addressRecord._id?.toString(),
      label: addressRecord.label || "",
      city: addressRecord.city,
      postalCode: addressRecord.postalCode,
      street: decrypt(addressRecord.street),
      number: decrypt(addressRecord.number),
      isDefault: !!addressRecord.isDefault,
    };
  } catch {
    return null;
  }
}

export default { buildAddressRecord, decryptAddress };