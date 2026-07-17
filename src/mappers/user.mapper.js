import { formatDateTime, formatDate } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";
import { decryptAddress } from "../utils/address.util.js";

function getFullName(user) {
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Nepoznato";
}

function getRoleName(user) {
  if (user.role && typeof user.role === "object") {
    const roleMap = {
      admin: "Administrator",
      employee: "Zaposleni",
      user: "Korisnik",
    };
    return roleMap[user.role.name] || user.role.name || "Nepoznato";
  }
  return "Nepoznato";
}

// raw role ObjectId - needed to pre-select the current role in an admin edit dropdown,
// since `uloga` above is a translated display label, not usable for value matching
function getRoleId(user) {
  if (!user.role) return null;
  return typeof user.role === "object" ? user.role._id.toString() : user.role.toString();
}

function translateStatus(status) {
  const map = {
    guest: "Gost",
    pending: "Na čekanju potvrde",
    active: "Aktivan",
    inactive: "Neaktivan",
    suspended: "Suspendovan",
  };
  return map[status] || status;
}

function translateProvider(provider) {
  const map = {
    local: "Email i lozinka",
    google: "Google nalog",
  };
  return map[provider] || provider;
}

export function mapUserForAdminShort(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
    telefon: decryptPhone(user.phone),
    uloga: getRoleName(user),
    status: translateStatus(user.status),
    statusRaw: user.status,
    poslednjiLogin: user.lastLogin ? formatDate(user.lastLogin) : "Nikada",
    registrovan: formatDate(user.createdAt),
  };
}

export function mapUsersForAdminList(users = []) {
  return users.map(mapUserForAdminShort).filter(Boolean);
}

export function mapUserForAdminDetail(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    telefon: decryptPhone(user.phone),
    nacinPrijave: translateProvider(user.provider),
    uloga: getRoleName(user),
    roleId: getRoleId(user),
    avatar: user.avatar || null,
    status: translateStatus(user.status),
    statusRaw: user.status,
    potvrdjenEmail: user.confirmed ? "Da" : "Ne",
    poslednjiLogin: user.lastLogin ? formatDateTime(user.lastLogin) : null,
    vreme: {
      registrovan: formatDateTime(user.createdAt),
      azuriran: formatDateTime(user.updatedAt),
    },
  };
}

export function mapUserForEmployeeShort(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
    telefon: decryptPhone(user.phone),
  };
}

export function mapUserForEmployeeDetail(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
    telefon: decryptPhone(user.phone),
    registrovan: formatDate(user.createdAt),
  };
}

export function mapUserForProfile(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    telefon: decryptPhone(user.phone),
    uloga: getRoleName(user),
    avatar: user.avatar || null,
    nacinPrijave: translateProvider(user.provider),
    status: translateStatus(user.status),
    poslednjiLogin: user.lastLogin ? formatDateTime(user.lastLogin) : null,
    clanOd: formatDate(user.createdAt),
  };
}

// used inside other mappers (e.g. appointment.mapper.js) so a referenced user isn't
// re-mapped through the full admin/detail shape just to show a name
export function mapUserForSelect(user) {
  if (!user) return null;
  if (typeof user === "string") return { id: user };
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
  };
}

export function mapUserAddresses(user) {
  return (user.addresses || [])
    .map((a) => {
      const decrypted = decryptAddress(a);
      if (!decrypted) return null;
      return {
        id: decrypted.id,
        naziv: decrypted.label || null,
        grad: decrypted.city,
        postanskiBroj: decrypted.postalCode,
        ulica: decrypted.street,
        broj: decrypted.number,
        podrazumevana: decrypted.isDefault,
      };
    })
    .filter(Boolean);
}

function formatImage(image) {
  if (!image) return null;
  return { url: image.img || null, alt: image.imgDesc || null };
}

// cart.product needs to already be populated (see user.service.js's getCart) - the
// variant is a bare ObjectId (not a ref, just a subdocument id), so it's resolved
// against the populated product's own variations array here
export function mapUserCart(user) {
  const lines = (user.cart || [])
    .map((line) => {
      const product = line.product;
      if (!product || typeof product !== "object") return null;

      const variation = (product.variations || []).find((v) => String(v._id) === String(line.variant));
      if (!variation) return null;

      return {
        id: line._id.toString(),
        productId: product._id.toString(),
        productSlug: product.slug,
        variantId: variation._id.toString(),
        naziv: product.name,
        varijanta: variation.label,
        sku: variation.sku || product.sku,
        cena: variation.price,
        kolicina: line.quantity,
        ukupno: variation.price * line.quantity,
        slika: formatImage(variation.image || product.image),
        naStanju: variation.stock > 0,
        dostupnaKolicina: variation.stock,
        prekoracenje: line.quantity > variation.stock,
      };
    })
    .filter(Boolean);

  return {
    stavke: lines,
    brojStavki: lines.reduce((sum, l) => sum + l.kolicina, 0),
    ukupnaCena: lines.reduce((sum, l) => sum + l.ukupno, 0),
  };
}

export function mapUserRaw(user) {
  return user;
}

/**
 * Dispatcher used by user.service.js - picks the right shape by who's asking and
 * whether it's their own profile.
 */
export function mapUser(user, role, viewType = "short", isOwnProfile = false) {
  if (!user) return null;
  if (isOwnProfile) return mapUserForProfile(user);

  if (role === "admin") {
    return viewType === "short" ? mapUserForAdminShort(user) : mapUserForAdminDetail(user);
  }
  if (role === "employee") {
    return viewType === "short" ? mapUserForEmployeeShort(user) : mapUserForEmployeeDetail(user);
  }

  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
    avatar: user.avatar || null,
  };
}

export default {
  mapUserForAdminShort,
  mapUsersForAdminList,
  mapUserForAdminDetail,
  mapUserForEmployeeShort,
  mapUserForEmployeeDetail,
  mapUserForProfile,
  mapUserForSelect,
  mapUserAddresses,
  mapUserCart,
  mapUserRaw,
  mapUser,
};