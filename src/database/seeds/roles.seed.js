import Role from "../../models/role.model.js";
import { logInfo } from "../../utils/logger.util.js";

const defaultRoles = [
  {
    name: "admin",
    description: "Pun pristup svim funkcionalnostima admin panela",
    permissions: [
      "access_admin_panel",
      "view_dashboard",
      "manage_users",
      "manage_roles",
      "manage_employees",
      "manage_services",
      "manage_packages",
      "manage_taxonomy",
      "manage_blog",
      "manage_appointments_all",
      "manage_marketing",
      "manage_coupons",
      "manage_products",
      "manage_orders",
      "manage_partners",
      "manage_payouts",
      "view_logs",
    ],
    isDefault: false,
    priority: 100,
  },
  {
    name: "employee",
    description: "Zaposleni - pristup sopstvenom kalendaru i dodeljenim terminima",
    permissions: ["view_dashboard", "manage_appointments_assigned"],
    isDefault: false,
    priority: 50,
  },
  {
    name: "partner",
    description: "Partner - pristup sopstvenom katalogu, referalnom linku i proviziji",
    permissions: ["view_dashboard", "view_own_commissions"],
    isDefault: false,
    priority: 40,
  },
  {
    name: "user",
    description: "Registrovani korisnik - zakazivanje i upravljanje sopstvenim terminima",
    permissions: ["view_dashboard", "manage_own_appointments"],
    isDefault: true,
    priority: 0,
  },
];

export async function seedRoles() {
  const results = [];

  for (const roleData of defaultRoles) {
    const role = await Role.findOneAndUpdate({ name: roleData.name }, roleData, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    results.push(role);
  }

  logInfo("Roles seeded", { count: results.length, roles: results.map((r) => r.name) });
  return results;
}

export default seedRoles;