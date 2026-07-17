export function prepareDashboardData(stats, recent) {
  return {
    stats: [
      { label: "Termini na čekanju", value: stats.pendingAppointments, url: "/admin/termini?status=pending", icon: "bi-hourglass-split" },
      { label: "Potvrđeni termini", value: stats.confirmedAppointments, url: "/admin/termini?status=confirmed", icon: "bi-calendar-check" },
      { label: "Nove poruke", value: stats.newContacts, url: "/admin/kontakt?status=new", icon: "bi-envelope" },
      { label: "Aktivni zaposleni", value: stats.activeEmployees, url: "/admin/zaposleni?isActive=true", icon: "bi-person-badge" },
      { label: "Registrovani korisnici", value: stats.totalUsers, url: "/admin/korisnici", icon: "bi-people" },
      { label: "Aktivni kupljeni paketi", value: stats.activePackagePurchases, url: "/admin/kupljeni-paketi?status=active", icon: "bi-bag-check" },
      { label: "Porudžbine na čekanju", value: stats.pendingOrders, url: "/admin/porudzbine?status=pending", icon: "bi-box-seam" },
      { label: "Proizvodi bez zaliha", value: stats.outOfStockProducts, url: "/admin/proizvodi?inStock=false", icon: "bi-exclamation-triangle" },
    ],
    recentAppointments: recent.appointments,
    recentContacts: recent.contacts,
    recentOrders: recent.orders,
    breadcrumbs: [{ label: "Admin", url: null }],
  };
}

export default { prepareDashboardData };