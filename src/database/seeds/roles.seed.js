import Role from "../../models/role.model.js";
import { logInfo } from "../../utils/logger.util.js";

const defaultRoles = [
  {
    name: "admin",
    description: "Pun pristup svim funkcionalnostima admin panela",
    permissions: [
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
    ],
    isDefault: false,
    priority: 100,
  },
  {
    name: "employee",
    description: "Zaposleni — pristup sopstvenom kalendaru i dodeljenim terminima",
    permissions: ["view_dashboard", "manage_appointments_assigned"],
    isDefault: false,
    priority: 50,
  },
  {
    name: "user",
    description: "Registrovani korisnik — zakazivanje i upravljanje sopstvenim terminima",
    permissions: ["view_dashboard", "manage_own_appointments"],
    isDefault: true,
    priority: 0,
  },
];

/**
 * Upserts the three closed roles by name — safe to run multiple times (won't duplicate
 * or wipe out permission edits made from the admin panel on repeat runs, since upsert
 * only fills in fields, it doesn't delete extras... note: findOneAndUpdate with a full
 * replacement object below DOES overwrite `permissions` etc. back to these defaults on
 * every run. Run once at initial setup; if you customize permissions afterward via the
 * admin UI, don't re-run this without adjusting the defaults above to match.
 */
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