import * as appointmentService from "../../../services/appointment.service.js";
import * as contactService from "../../../services/contact.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as userService from "../../../services/user.service.js";
import packagePurchaseService from "../../../services/package-purchase.service.js";
import { prepareDashboardData } from "../../../presenters/admin/dashboard.presenter.js";
import { logError } from "../../../utils/logger.util.js";

export async function dashboard(req, res, next) {
  try {
    const [pending, confirmed, contacts, employees, users, purchases, recentPending, recentContacts] = await Promise.all([
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "confirmed" }, limit: 1 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 1 }),
      employeeService.listEmployees({ filters: { isActive: true }, limit: 1 }),
      userService.listUsers({ limit: 1 }),
      packagePurchaseService.listPurchases({ filters: { status: "active" }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 5 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 5 }),
    ]);

    const stats = {
      pendingAppointments: pending.total,
      confirmedAppointments: confirmed.total,
      newContacts: contacts.total,
      activeEmployees: employees.total,
      totalUsers: users.total,
      activePackagePurchases: purchases.total,
    };

    const viewData = prepareDashboardData(stats, {
      appointments: recentPending.data,
      contacts: recentContacts.data,
    });

    return res.render("admin/dashboard", {
      pageTitle: "Admin panel",
      pageDescription: "Pregled stanja sistema",
      data: viewData,
    });
  } catch (error) {
    logError("[dashboard] Greška pri učitavanju admin početne strane", error, { adminId: req.session?.user?.id });
    next(error);
  }
}

export default { dashboard };