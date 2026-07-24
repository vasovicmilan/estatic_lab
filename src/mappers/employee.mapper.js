import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";

const DAY_LABELS = {
  monday: "Ponedeljak",
  tuesday: "Utorak",
  wednesday: "Sreda",
  thursday: "Četvrtak",
  friday: "Petak",
  saturday: "Subota",
  sunday: "Nedelja",
};

function translateDay(day) {
  return DAY_LABELS[day] || day;
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
  // Same reasoning as package.mapper.js's serviceLabel(): a dangling ref (Service
  // deleted outside the normal flow, or stale pre-existing data) should show a
  // placeholder, not silently vanish from the list - a silent drop here would make
  // brojUsluga's count (which uses the raw, unfiltered array length) not match the
  // number of names actually shown, which is confusing to debug from the admin side.
  // A raw ObjectId means this query simply didn't populate the field (not
  // necessarily deleted); null means populate() ran and found nothing (genuinely gone).
  return employee.services.map((svc) => {
    if (svc && typeof svc === "object" && svc.name) return svc.name;
    if (svc) return "Usluga nije učitana";
    return "Usluga obrisana";
  });
}

function getWorkingHours(employee) {
  if (!employee.workingHours || !Array.isArray(employee.workingHours)) return [];
  return employee.workingHours.map((wh) => ({
    dan: translateDay(wh.day),
    termini: formatSlots(wh.slots),
  }));
}

// raw (English day/from/to keys) - used to seed the editable schedule widget,
// as opposed to getWorkingHours() above which formats for read-only display
function getWorkingHoursRaw(employee) {
  if (!employee.workingHours || !Array.isArray(employee.workingHours)) return [];
  return employee.workingHours.map((wh) => ({
    day: wh.day,
    slots: (wh.slots || []).map((slot) => ({ from: slot.from, to: slot.to })),
  }));
}

// employee.expert links to a public Expert profile (see expert.mapper.js) - bio/photo
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
    nacinIsplate: employee.payType === "commission" ? "Provizija" : "Fiksna plata",
    procenatProvizije: employee.payType === "commission" ? `${employee.commissionRate}%` : null,
    aktivan: employee.isActive ? "Da" : "Ne",
    napomena: employee.notes || null,
    vreme: {
      kreiran: formatDateTime(employee.createdAt),
      azuriran: formatDateTime(employee.updatedAt),
    },
  };
}

// used to pre-fill the admin edit form - raw IDs and raw workingHours (not the
// translated/formatted shape mapEmployeeForAdminDetail returns for display), so
// prepareEmployeeFormData's `values.expert`/`values.services`/`values.workingHours`
// lookups actually find something. imePrezime/email are included purely for the
// page title/breadcrumb, not as form fields - mirrors mapServiceForEdit's convention.
export function mapEmployeeForEdit(employee) {
  if (!employee) return null;
  return {
    id: employee._id.toString(),
    imePrezime: getFullName(employee),
    email: getEmail(employee),
    userId: employee.userId?._id?.toString() || employee.userId?.toString(),
    expert: employee.expert?._id?.toString() || employee.expert?.toString() || null,
    services: (employee.services || []).map((s) => s._id?.toString() || s.toString()),
    workingHours: getWorkingHoursRaw(employee),
    payType: employee.payType || "salary",
    commissionRate: employee.commissionRate,
    isActive: employee.isActive,
    notes: employee.notes || "",
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
    workingHoursRaw: getWorkingHoursRaw(employee),
  };
}

// used by the booking flow to offer "choose your therapist" - name + hours only
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
  mapEmployeeForEdit,
  mapEmployeeForEmployeeShort,
  mapEmployeeForEmployeeDetail,
  mapEmployeeForPublic,
  mapEmployeeRaw,
  mapEmployee,
};