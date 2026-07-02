import { formatDateTime, formatDate } from "../utils/date.time.util.js";

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
    telefon: user.phone || null,
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
    email: user.email,
    telefon: user.phone || null,
    nacinPrijave: translateProvider(user.provider),
    uloga: getRoleName(user),
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
    telefon: user.phone || null,
  };
}

export function mapUserForEmployeeDetail(user) {
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
    telefon: user.phone || null,
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
    telefon: user.phone || null,
    uloga: getRoleName(user),
    avatar: user.avatar || null,
    nacinPrijave: translateProvider(user.provider),
    status: translateStatus(user.status),
    poslednjiLogin: user.lastLogin ? formatDateTime(user.lastLogin) : null,
    clanOd: formatDate(user.createdAt),
  };
}

export function mapUserForSelect(user) {
  if (!user) return null;
  if (typeof user === "string") return { id: user };
  return {
    id: user._id.toString(),
    imePrezime: getFullName(user),
    email: user.email,
  };
}

export function mapUserRaw(user) {
  return user;
}

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
  mapUserRaw,
  mapUser,
};