/**
 * Stats are grouped into named sections rather than one flat row - as more of these
 * accumulate (13 now, vs. 8 when this was first built) an ungrouped grid stops being
 * scannable. "Zahteva pažnju" is deliberately first and separate: every tile in it is
 * something an admin needs to actually act on (a decision pending), distinct from
 * "Danas" (today's operational snapshot) and "Pregled" (general state, not urgent).
 */
export function prepareDashboardData(stats, recent) {
  const sections = [
    {
      title: "Zahteva pažnju",
      tiles: [
        { label: "Termini na čekanju", value: stats.pendingAppointments, url: "/admin/termini?status=pending", icon: "bi-hourglass-split" },
        // left unassigned on purpose when 2+ employees were free at booking time (see
        // appointment.service.js's resolveEmployeeAssignment) - was invisible anywhere
        // on the dashboard before, easy to lose track of until a customer shows up
        { label: "Nedodeljeni termini", value: stats.unassignedAppointments, url: "/admin/termini?unassignedOnly=true", icon: "bi-person-fill-exclamation" },
        { label: "Nove poruke", value: stats.newContacts, url: "/admin/kontakt?status=new", icon: "bi-envelope" },
        { label: "Porudžbine na čekanju", value: stats.pendingOrders, url: "/admin/porudzbine?status=pending", icon: "bi-box-seam" },
        { label: "Zahtevi za isplatu", value: stats.pendingPayoutRequests, url: "/admin/isplate?status=requested", icon: "bi-cash-coin" },
        { label: "Testimonijali na čekanju", value: stats.pendingTestimonials, url: "/admin/testimoniali?status=pending", icon: "bi-chat-square-quote" },
        { label: "Proizvodi bez zaliha", value: stats.outOfStockProducts, url: "/admin/proizvodi?inStock=false", icon: "bi-exclamation-triangle" },
      ],
    },
    {
      title: "Danas",
      tiles: [
        { label: "Termini danas", value: stats.todayAppointments, url: "/admin/termini", icon: "bi-calendar-day" },
      ],
    },
    {
      title: "Pregled",
      tiles: [
        { label: "Potvrđeni termini", value: stats.confirmedAppointments, url: "/admin/termini?status=confirmed", icon: "bi-calendar-check" },
        { label: "Aktivni zaposleni", value: stats.activeEmployees, url: "/admin/zaposleni?isActive=true", icon: "bi-person-badge" },
        { label: "Registrovani korisnici", value: stats.totalUsers, url: "/admin/korisnici", icon: "bi-people" },
        { label: "Aktivni kupljeni paketi", value: stats.activePackagePurchases, url: "/admin/kupljeni-paketi?status=active", icon: "bi-bag-check" },
        // not itself urgent, but a resource sitting inactive silently blocks every
        // service that depends on it (see resource.model.js) - worth a glance so it
        // isn't forgotten about after a device goes in for repair, say
        { label: "Neaktivni resursi", value: stats.inactiveResources, url: "/admin/resursi?isActive=false", icon: "bi-grid-3x3-gap" },
        { label: "Newsletter prijave", value: stats.newsletterSubscribers, url: "/admin/newsletter", icon: "bi-envelope-paper" },
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

  return {
    sections,
    activityTabs,
    breadcrumbs: [{ label: "Admin", url: null }],
  };
}

export default { prepareDashboardData };