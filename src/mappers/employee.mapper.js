import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";

function translateDay(day) {
  const map = {
    monday: "Ponedeljak",
    tuesday: "Utorak",
    wednesday: "Sreda",
    thursday: "Četvrtak",
    friday: "Petak",
    saturday: "Subota",
    sunday: "Nedelja",
  };
  return map[day] || day;
}

function formatSlots(slots) {
  if (!slots || slots.length === 0) return [];
  return slots.map((slot) => `${slot.from} - ${slot.to}`);
}

function getFullName(employee) {
  if (employee.userId && typeof employee.userId === "object") {
    const first = employee.userId.firstName || "";
    const last = employee.userId.lastName || "";
    return `${first} ${last}`.trim() || "Nepoznato";
  }
  return "Nepoznato";
}

function getEmail(employee) {
  if (employee.userId && typeof employee.userId === "object") {
    return employee.userId.email || null;
  }
  return null;
}

function getPhone(employee) {
  if (employee.userId && typeof employee.userId === "object") {
    return decryptPhone(employee.userId.phone);
  }
  return null;
}

function getServiceNames(employee) {
  if (!employee.services || !Array.isArray(employee.services)) return [];
  return employee.services
    .filter((svc) => svc && typeof svc === "object" && svc.name)
    .map((svc) => svc.name);
}

function getWorkingHours(employee) {
  if (!employee.workingHours || !Array.isArray(employee.workingHours)) return [];
  return employee.workingHours.map((wh) => ({
    dan: translateDay(wh.day),
    termini: formatSlots(wh.slots),
  }));
}

// employee.expert links to a public Expert profile (see expert.mapper.js) — bio/photo
// live there, this is just a "linked to" pointer for the admin screen
function getLinkedExpert(employee) {
  if (!employee.expert) return null;
  if (typeof employee.expert === "object") {
    return {
      id: employee.expert._id.toString(),
      imePrezime: `${employee.expert.firstName || ""} ${employee.expert.lastName || ""}`.trim(),
      slug: employee.expert.slug,
    };
  }
  return { id: employee.expert.toString() };
}

export function mapEmployeeForAdminShort(employee) {
  return {
    id: employee._id.toString(),
    imePrezime: getFullName(employee),
    email: getEmail(employee),
    aktivan: employee.isActive ? "Da" : "Ne",
    brojUsluga: employee.services?.length || 0,
    kreiran: formatDateTime(employee.createdAt),
  };
}

export function mapEmployeesForAdminList(employees = []) {
  return employees.map(mapEmployeeForAdminShort).filter(Boolean);
}

export function mapEmployeeForAdminDetail(employee) {
  return {
    id: employee._id.toString(),
    korisnik: {
      imePrezime: getFullName(employee),
      email: getEmail(employee),
      telefon: getPhone(employee),
    },
    povezaniEkspert: getLinkedExpert(employee),
    usluge: getServiceNames(employee),
    radnoVreme: getWorkingHours(employee),
    aktivan: employee.isActive ? "Da" : "Ne",
    napomena: employee.notes || null,
    vreme: {
      kreiran: formatDateTime(employee.createdAt),
      azuriran: formatDateTime(employee.updatedAt),
    },
  };
}

export function mapEmployeeForEmployeeShort(employee) {
  return {
    id: employee._id.toString(),
    imePrezime: getFullName(employee),
    brojUsluga: employee.services?.length || 0,
    aktivan: employee.isActive ? "Da" : "Ne",
  };
}

export function mapEmployeeForEmployeeDetail(employee) {
  return {
    id: employee._id.toString(),
    imePrezime: getFullName(employee),
    email: getEmail(employee),
    telefon: getPhone(employee),
    usluge: getServiceNames(employee),
    radnoVreme: getWorkingHours(employee),
  };
}

// used by the booking flow to offer "choose your therapist" — name + hours only
export function mapEmployeeForPublic(employee) {
  return {
    id: employee._id.toString(),
    imePrezime: getFullName(employee),
    usluge: getServiceNames(employee),
    radnoVreme: getWorkingHours(employee),
  };
}

export function mapEmployeeRaw(employee) {
  return employee;
}

export function mapEmployee(employee, role, viewType = "short") {
  if (!employee) return null;
  if (role === "admin") {
    return viewType === "short" ? mapEmployeeForAdminShort(employee) : mapEmployeeForAdminDetail(employee);
  }
  if (role === "employee") {
    return viewType === "short" ? mapEmployeeForEmployeeShort(employee) : mapEmployeeForEmployeeDetail(employee);
  }
  return mapEmployeeForPublic(employee);
}

export default {
  mapEmployeeForAdminShort,
  mapEmployeesForAdminList,
  mapEmployeeForAdminDetail,
  mapEmployeeForEmployeeShort,
  mapEmployeeForEmployeeDetail,
  mapEmployeeForPublic,
  mapEmployeeRaw,
  mapEmployee,
};
