import { FEATURES } from "../../config/features.config.js";

/**
 * Stats are grouped into named sections rather than one flat row - as more of these
 * accumulate (13 now, vs. 8 when this was first built) an ungrouped grid stops being
 * scannable. "Zahteva pažnju" is deliberately first and separate: every tile in it is
 * something an admin needs to actually act on (a decision pending), distinct from
 * "Danas" (today's operational snapshot) and "Pregled" (general state, not urgent).
 */
export function prepareDashboardData(stats, recent, { permissions } = {}) {
  const sections = [
    {
      title: "Zahteva pažnju",
      tiles: [
        { label: "Termini na čekanju", value: stats.pendingAppointments, url: "/admin/termini?status=pending", icon: "bi-hourglass-split", module: "booking", permission: "manage_appointments_all" },
        // left unassigned on purpose when 2+ employees were free at booking time (see
        // appointment.service.js's resolveEmployeeAssignment) - was invisible anywhere
        // on the dashboard before, easy to lose track of until a customer shows up
        { label: "Nedodeljeni termini", value: stats.unassignedAppointments, url: "/admin/termini?unassignedOnly=true", icon: "bi-person-fill-exclamation", module: "booking", permission: "manage_appointments_all" },
        { label: "Nove poruke", value: stats.newContacts, url: "/admin/kontakt?status=new", icon: "bi-envelope", permission: "manage_marketing" },
        { label: "Porudžbine na čekanju", value: stats.pendingOrders, url: "/admin/porudzbine?status=pending", icon: "bi-box-seam", module: "shop", permission: "manage_orders" },
        { label: "Zahtevi za isplatu", value: stats.pendingPayoutRequests, url: "/admin/isplate?status=requested", icon: "bi-cash-coin", module: "partners", permission: "manage_payouts" },
        { label: "Testimonijali na čekanju", value: stats.pendingTestimonials, url: "/admin/testimoniali?status=pending", icon: "bi-chat-square-quote", permission: "manage_marketing" },
        { label: "Proizvodi bez zaliha", value: stats.outOfStockProducts, url: "/admin/proizvodi?inStock=false", icon: "bi-exclamation-triangle", module: "shop", permission: "manage_products" },
      ],
    },
    {
      title: "Danas",
      tiles: [
        { label: "Termini danas", value: stats.todayAppointments, url: "/admin/termini", icon: "bi-calendar-day", module: "booking", permission: "manage_appointments_all" },
      ],
    },
    {
      title: "Pregled",
      tiles: [
        { label: "Potvrđeni termini", value: stats.confirmedAppointments, url: "/admin/termini?status=confirmed", icon: "bi-calendar-check", module: "booking", permission: "manage_appointments_all" },
        { label: "Aktivni zaposleni", value: stats.activeEmployees, url: "/admin/zaposleni?isActive=true", icon: "bi-person-badge", module: "employees", permission: "manage_employees" },
        { label: "Registrovani korisnici", value: stats.totalUsers, url: "/admin/korisnici", icon: "bi-people", permission: "manage_users" },
        { label: "Aktivni kupljeni paketi", value: stats.activePackagePurchases, url: "/admin/kupljeni-paketi?status=active", icon: "bi-bag-check", module: "booking", permission: "manage_appointments_all" },
        // not itself urgent, but a resource sitting inactive silently blocks every
        // service that depends on it (see resource.model.js) - worth a glance so it
        // isn't forgotten about after a device goes in for repair, say
        { label: "Neaktivni resursi", value: stats.inactiveResources, url: "/admin/resursi?isActive=false", icon: "bi-grid-3x3-gap", module: "booking", permission: "manage_resources" },
        { label: "Newsletter prijave", value: stats.newsletterSubscribers, url: "/admin/newsletter", icon: "bi-envelope-paper", permission: "manage_marketing" },
      ],
    },
  ];

  // one tabbed panel instead of several always-expanded cards stacked down the page -
  // these are all "browse a short list, jump to one" activity feeds, which is exactly
  // what tabs are for; the stats above stay as plain always-visible sections since
  // those are single numbers meant to be scanned all at once, not browsed
  const activityTabs = [
    {
      id: "pending-appointments",
      permission: "manage_appointments_all",
      module: "booking",
      label: "Termini na čekanju",
      viewAllUrl: "/admin/termini?status=pending",
      items: (recent.pendingAppointments || []).map((a) => ({
        title: a.korisnik,
        subtitle: `${a.usluga} - ${a.datum}`,
        url: `/admin/termini/detalji/${a.id}`,
      })),
      emptyText: "Nema termina na čekanju.",
    },
    {
      id: "unassigned-appointments",
      permission: "manage_appointments_all",
      module: "booking",
      label: "Nedodeljeni termini",
      viewAllUrl: "/admin/termini?unassignedOnly=true",
      items: (recent.unassignedAppointments || []).map((a) => ({
        title: a.korisnik,
        subtitle: `${a.usluga} - ${a.datum}`,
        url: `/admin/termini/detalji/${a.id}`,
      })),
      emptyText: "Nema nedodeljenih termina.",
    },
    {
      id: "contacts",
      permission: "manage_marketing",
      label: "Nove poruke",
      viewAllUrl: "/admin/kontakt?status=new",
      items: (recent.contacts || []).map((c) => ({
        title: c.imePrezime,
        subtitle: `${c.email} - ${c.datum}`,
        url: `/admin/kontakt/detalji/${c.id}`,
      })),
      emptyText: "Nema novih poruka.",
    },
    {
      id: "orders",
      permission: "manage_orders",
      module: "shop",
      // was fetched by the controller and passed to this presenter before, but the
      // view never actually rendered it - restored here
      label: "Porudžbine na čekanju",
      viewAllUrl: "/admin/porudzbine?status=pending",
      items: (recent.orders || []).map((o) => ({
        title: o.korisnik,
        subtitle: `${o.ukupnaCena} - ${o.datum}`,
        url: `/admin/porudzbine/detalji/${o.id}`,
      })),
      emptyText: "Nema porudžbina na čekanju.",
    },
  ];

  // Kartice/tabovi modula koji ovaj deployment nema (ENABLED_MODULES) se ne prikazuju.
  // roles with a narrower scope (blog / services / shop manager) only see what they may open;
  // `permissions` omitted = no filtering (kept for callers that predate scoped roles)
  const allowed = (item) => !item.permission || !Array.isArray(permissions) || permissions.includes(item.permission);
  const on = (item) => (!item.module || FEATURES[item.module]) && allowed(item);
  return {
    sections: sections.map((section) => ({ ...section, tiles: section.tiles.filter(on) })).filter((section) => section.tiles.length > 0),
    activityTabs: activityTabs.filter(on),
    breadcrumbs: [{ label: "Admin", url: null }],
  };
}

export default { prepareDashboardData };