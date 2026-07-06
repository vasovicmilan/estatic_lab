import { formatDateTime, formatDate } from "../utils/date.time.util.js";
import { decrypt } from "../services/crypto.service.js";

function translateStatus(status) {
  const map = {
    new: "Novi",
    read: "Pročitan",
    replied: "Odgovoren",
    archived: "Arhiviran",
  };
  return map[status] || status;
}

export function mapContactsForAdminList(contacts = []) {
  return contacts
    .map((contact) => {
      if (!contact) return null;
      return {
        id: contact._id.toString(),
        imePrezime: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        tema: contact.topic || null,
        status: translateStatus(contact.status),
        statusRaw: contact.status,
        datum: formatDate(contact.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapContactForAdminDetail(contact) {
  if (!contact) return null;

  return {
    id: contact._id.toString(),
    osnovno: {
      ime: contact.firstName,
      prezime: contact.lastName,
      email: contact.email,
      telefon: decrypt(contact.phone) || null,
      tema: contact.topic || null,
      status: translateStatus(contact.status),
      statusRaw: contact.status,
      saglasnost: contact.consent ? "Da" : "Ne",
    },
    poruka: contact.message,
    vreme: {
      kreirano: formatDateTime(contact.createdAt),
      azurirano: formatDateTime(contact.updatedAt),
    },
  };
}

// what the visitor sees right after submitting the form — a short confirmation, not
// the full admin record (no ip/userAgent/status internals)
export function mapContactForUserShort(contact) {
  if (!contact) return null;
  return {
    imePrezime: `${contact.firstName} ${contact.lastName}`,
    email: contact.email,
    poslato: formatDate(contact.createdAt),
  };
}

export function mapContactRaw(contact) {
  return contact;
}

export function mapContact(contact, role, viewType = "short") {
  if (!contact) return null;
  if (role === "admin") {
    return viewType === "short" ? mapContactsForAdminList([contact])[0] : mapContactForAdminDetail(contact);
  }
  return mapContactForUserShort(contact);
}

export default {
  mapContactsForAdminList,
  mapContactForAdminDetail,
  mapContactForUserShort,
  mapContactRaw,
  mapContact,
};
