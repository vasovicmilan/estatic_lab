import * as appointmentService from "../../../services/appointment.service.js";
import * as contactService from "../../../services/contact.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as userService from "../../../services/user.service.js";
import packagePurchaseService from "../../../services/package-purchase.service.js";
import orderService from "../../../services/order.service.js";
import productService from "../../../services/product.service.js";
import payoutRequestService from "../../../services/payout-request.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import resourceService from "../../../services/resource.service.js";
import * as newsletterService from "../../../services/news-letter.service.js";
import { prepareDashboardData } from "../../../presenters/admin/dashboard.presenter.js";
import { logError } from "../../../utils/logger.util.js";
import { getStartOfDayInZone } from "../../../utils/date.time.util.js";

// Was `new Date(); start.setHours(0,0,0,0)` / `end.setDate(end.getDate()+1)` -
// setHours()/setDate() operate in the SERVER PROCESS's own timezone (UTC on
// this VPS), not Belgrade, so "today" on the admin dashboard silently used
// UTC midnight-to-midnight instead of Belgrade midnight-to-midnight - the same
// 1-2h (CET/CEST) shift bug as everywhere else in this app. `end` is the start
// of TOMORROW (exclusive), not 23:59:59.999 of today, to match
// appointment.filter.js's `$lt: dateTo` semantics for the appointments count
// below. See date.time.util.js's getStartOfDayInZone.
function todayBounds() {
  const start = getStartOfDayInZone();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function dashboard(req, res, next) {
  try {
    const { start: todayStart, end: todayEnd } = todayBounds();

    const [
      pending,
      confirmed,
      unassigned,
      today,
      contacts,
      employees,
      users,
      purchases,
      pendingOrders,
      outOfStockProducts,
      pendingPayoutRequests,
      pendingTestimonials,
      inactiveResources,
      subscribers,
      recentPending,
      recentUnassigned,
      recentContacts,
      recentOrders,
    ] = await Promise.all([
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "confirmed" }, limit: 1 }),
      // 2+ employees were free at booking time, so the system deliberately left it for
      // an admin to pick (see appointment.service.js's resolveEmployeeAssignment) -
      // these are invisible anywhere else on the dashboard, easy to lose track of
      appointmentService.findAppointments({ role: "admin", filters: { unassignedOnly: true }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { dateFrom: todayStart, dateTo: todayEnd }, limit: 1 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 1 }),
      employeeService.listEmployees({ filters: { isActive: true }, limit: 1 }),
      userService.listUsers({ limit: 1 }),
      packagePurchaseService.listPurchases({ filters: { status: "active" }, limit: 1 }),
      orderService.findOrders({ role: "admin", filters: { status: "pending" }, limit: 1 }),
      productService.listProducts({ filters: { inStock: false, isActive: true }, limit: 1 }),
      // "requested" is the initial, not-yet-reviewed state (see payout-request.model.js) -
      // these need an admin decision, same category as pending orders/appointments, but
      // were never surfaced anywhere on the dashboard before
      payoutRequestService.listPayoutRequests({ filters: { status: "requested" }, limit: 1 }),
      // submitted but not yet approved for public display
      testimonialService.listTestimonials({ filters: { status: "pending" }, limit: 1 }),
      // not "needs review" in the same sense as the above, but a resource sitting
      // inactive silently blocks every service that depends on it (see
      // resource.model.js/availability.service.js) - worth flagging so it's not
      // forgotten about after, say, a device goes in for repair
      resourceService.listResources({ isActive: false, limit: 1 }),
      newsletterService.listSubscribers({ limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 5 }),
      appointmentService.findAppointments({ role: "admin", filters: { unassignedOnly: true }, limit: 5 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 5 }),
      orderService.findOrders({ role: "admin", filters: { status: "pending" }, limit: 5 }),
    ]);

    const stats = {
      pendingAppointments: pending.total,
      confirmedAppointments: confirmed.total,
      unassignedAppointments: unassigned.total,
      todayAppointments: today.total,
      newContacts: contacts.total,
      activeEmployees: employees.total,
      totalUsers: users.total,
      activePackagePurchases: purchases.total,
      pendingOrders: pendingOrders.total,
      outOfStockProducts: outOfStockProducts.total,
      pendingPayoutRequests: pendingPayoutRequests.total,
      pendingTestimonials: pendingTestimonials.total,
      inactiveResources: inactiveResources.total,
      newsletterSubscribers: subscribers.total,
    };

    const viewData = prepareDashboardData(stats, {
      pendingAppointments: recentPending.data,
      unassignedAppointments: recentUnassigned.data,
      contacts: recentContacts.data,
      orders: recentOrders.data,
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