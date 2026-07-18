import { formatDateTime, formatDate } from "../utils/date.time.util.js";

export function translatePermission(permission) {
  const map = {
    access_admin_panel: "Pristup Admin Panelu",
    view_dashboard: "Pregled dashboard-a",

    manage_users: "Upravljanje korisnicima",
    manage_roles: "Upravljanje rolama",
    manage_employees: "Upravljanje zaposlenima",

    manage_services: "Upravljanje uslugama",
    manage_packages: "Upravljanje paketima",
    manage_taxonomy: "Upravljanje kategorijama i tagovima",
    manage_blog: "Upravljanje blogom",

    manage_appointments_all: "Upravljanje svim terminima",
    manage_appointments_assigned: "Upravljanje dodeljenim terminima",
    manage_own_appointments: "Upravljanje sopstvenim terminima",

    manage_marketing: "Upravljanje marketingom",
    manage_coupons: "Upravljanje kuponima",

    manage_products: "Upravljanje proizvodima",
    manage_orders: "Upravljanje porudžbinama",
  };
  return map[permission] || permission;
}

function translateActive(isActive) {
  return isActive ? "Da" : "Ne";
}

export function mapRolesForAdminList(roles = []) {
  return roles
    .map((role) => {
      if (!role) return null;
      return {
        id: role._id.toString(),
        naziv: role.name,
        opis: role.description || "",
        brojPermisija: (role.permissions || []).length,
        podrazumevana: translateActive(role.isDefault),
        prioritet: role.priority,
        kreirana: formatDate(role.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapRoleForAdminDetail(role) {
  if (!role) return null;

  return {
    id: role._id.toString(),
    osnovno: {
      naziv: role.name,
      opis: role.description || "",
      podrazumevana: role.isDefault,
      prioritet: role.priority,
    },
    permisije: (role.permissions || []).map((p) => ({
      kod: p,
      naziv: translatePermission(p),
    })),
    vreme: {
      kreirano: formatDateTime(role.createdAt),
      azurirano: formatDateTime(role.updatedAt),
    },
  };
}

export function mapRoleForEdit(role) {
  if (!role) return null;

  return {
    id: role._id.toString(),
    name: role.name,
    description: role.description || "",
    permissions: role.permissions || [],
    isDefault: role.isDefault,
    priority: role.priority,
  };
}

export function mapRolesForSelect(roles = []) {
  return roles.map((role) => ({
    id: role._id.toString(),
    naziv: role.name,
  }));
}

export function mapRoleRaw(role) {
  return role;
}

export default {
  mapRolesForAdminList,
  mapRoleForAdminDetail,
  mapRoleForEdit,
  mapRolesForSelect,
  mapRoleRaw,
};