import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";

function getFullName(partner) {
  if (partner.userId && typeof partner.userId === "object") {
    const first = partner.userId.firstName || "";
    const last = partner.userId.lastName || "";
    return `${first} ${last}`.trim() || "Nepoznato";
  }
  return "Nepoznato";
}

function getEmail(partner) {
  if (partner.userId && typeof partner.userId === "object") {
    return partner.userId.email || null;
  }
  return null;
}

function getPhone(partner) {
  if (partner.userId && typeof partner.userId === "object") {
    return decryptPhone(partner.userId.phone);
  }
  return null;
}

export function mapPartnerForAdminShort(partner) {
  return {
    id: partner._id.toString(),
    imePrezime: getFullName(partner),
    email: getEmail(partner),
    procenatProvizije: `${partner.commissionRate}%`,
    aktivan: partner.isActive ? "Da" : "Ne",
    kreiran: formatDateTime(partner.createdAt),
  };
}

export function mapPartnersForAdminList(partners = []) {
  return partners.map(mapPartnerForAdminShort).filter(Boolean);
}

export function mapPartnerForAdminDetail(partner) {
  if (!partner) return null;
  return {
    id: partner._id.toString(),
    korisnik: {
      imePrezime: getFullName(partner),
      email: getEmail(partner),
      telefon: getPhone(partner),
    },
    procenatProvizije: `${partner.commissionRate}%`,
    procenatProvizijeRaw: partner.commissionRate,
    aktivan: partner.isActive ? "Da" : "Ne",
    napomena: partner.notes || null,
    vreme: {
      kreiran: formatDateTime(partner.createdAt),
      azuriran: formatDateTime(partner.updatedAt),
    },
  };
}

// used to pre-fill the admin edit form - raw values, not the translated/formatted
// shape mapPartnerForAdminDetail returns for display - mirrors mapEmployeeForEdit
export function mapPartnerForEdit(partner) {
  if (!partner) return null;
  return {
    id: partner._id.toString(),
    imePrezime: getFullName(partner),
    email: getEmail(partner),
    userId: partner.userId?._id?.toString() || partner.userId?.toString(),
    commissionRate: partner.commissionRate,
    isActive: partner.isActive,
    notes: partner.notes || "",
  };
}

// used by the partner's own dashboard - no admin-only fields exposed
export function mapPartnerForPartnerDetail(partner) {
  return {
    id: partner._id.toString(),
    imePrezime: getFullName(partner),
    procenatProvizije: `${partner.commissionRate}%`,
  };
}

export function mapPartnerRaw(partner) {
  return partner;
}

export function mapPartner(partner, role, viewType = "short") {
  if (!partner) return null;
  if (role === "admin") {
    return viewType === "short" ? mapPartnerForAdminShort(partner) : mapPartnerForAdminDetail(partner);
  }
  return mapPartnerForPartnerDetail(partner);
}

export default {
  mapPartnerForAdminShort,
  mapPartnersForAdminList,
  mapPartnerForAdminDetail,
  mapPartnerForEdit,
  mapPartnerForPartnerDetail,
  mapPartnerRaw,
  mapPartner,
};