export function prepareDashboardData(stats, recent) {
  return {
    stats: [
      { label: "Termini na čekanju", value: stats.pendingAppointments, url: "/admin/termini?status=pending", icon: "bi-hourglass-split" },
      { label: "Potvrđeni termini", value: stats.confirmedAppointments, url: "/admin/termini?status=confirmed", icon: "bi-calendar-check" },
      { label: "Nove poruke", value: stats.newContacts, url: "/admin/kontakt?status=new", icon: "bi-envelope" },
      { label: "Aktivni zaposleni", value: stats.activeEmployees, url: "/admin/zaposleni?isActive=true", icon: "bi-person-badge" },
      { label: "Registrovani korisnici", value: stats.totalUsers, url: "/admin/korisnici", icon: "bi-people" },
      { label: "Aktivni kupljeni paketi", value: stats.activePackagePurchases, url: "/admin/kupljeni-paketi?status=active", icon: "bi-bag-check" },
    ],
    recentAppointments: recent.appointments,
    recentContacts: recent.contacts,
    breadcrumbs: [{ label: "Admin", url: null }],
  };
}

export default { prepareDashboardData };