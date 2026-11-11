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
      "manage_resources",
      "manage_blog",
      "manage_appointments_all",
      "manage_marketing",
      "manage_coupons",
      "manage_products",
      "manage_orders",
      "manage_partners",
      "manage_payouts",
      "manage_site_content",
      "view_logs",
      "view_business_reports",
    ],
    isDefault: false,
    priority: 100,
  },
  {
    name: "employee",
    description: "Zaposleni - pristup sopstvenom kalendaru i dodeljenim terminima",
    permissions: ["view_dashboard", "manage_appointments_assigned", "view_own_commissions"],
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

// Scoped back-office roles. Coupons, orders, users, marketing, site content, logs and reports
// stay with the admin on purpose; a shop manager who should also handle orders gets
// "manage_orders" added here (or, for a one-off, in Admin > Role - but the next seed run
// writes the list below again, like it does for every role in this file).
export const managerRoles = [
  {
    name: "menadzer bloga",
    description: "Upravlja blogom (članci, galerija, SEO) i kategorijama/tagovima",
    permissions: ["access_admin_panel", "view_dashboard", "manage_blog", "manage_taxonomy"],
    isDefault: false,
    priority: 30,
  },
  {
    name: "menadzer usluga",
    description: "Upravlja uslugama i paketima (katalog), kategorijama/tagovima; bez uvida u prodaju i termine",
    permissions: ["access_admin_panel", "view_dashboard", "manage_services", "manage_packages", "manage_taxonomy"],
    isDefault: false,
    priority: 30,
  },
  {
    name: "menadzer prodavnice",
    description: "Upravlja artiklima prodavnice i kategorijama/tagovima; kuponi i porudžbine ostaju adminu",
    permissions: ["access_admin_panel", "view_dashboard", "manage_products", "manage_taxonomy"],
    isDefault: false,
    priority: 30,
  },
];

export const allRoles = [...defaultRoles, ...managerRoles];

/**
 * Idempotent: every role above is created when missing and brought back to the definition
 * above when it already exists (name is the key). Roles that are not listed here (custom ones
 * made in Admin > Role) are never touched. Safe to run on every deploy.
 */
export async function seedRoles() {
  const existing = new Set((await Role.find({ name: { $in: allRoles.map((r) => r.name) } }).select("name").lean()).map((r) => r.name));
  const results = [];
  const created = [];
  const updated = [];

  for (const roleData of allRoles) {
    const role = await Role.findOneAndUpdate({ name: roleData.name }, roleData, {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    });
    results.push(role);
    (existing.has(roleData.name) ? updated : created).push(roleData.name);
  }

  logInfo("Roles seeded", { created, updated });
  return results;
}

export default seedRoles;