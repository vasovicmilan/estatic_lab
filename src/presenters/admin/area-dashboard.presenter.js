import { FEATURES } from "../../config/features.config.js";

/**
 * Overviews per area (blog, shop, services + packages). Same shape as dashboard.presenter.js
 * (sections of tiles + tabbed lists) so one view renders all of them.
 */

export const AREAS = [
  { key: "blog", url: "/admin/pregled/blog", label: "Pregled bloga", icon: "bi-newspaper", module: "blog", anyOf: ["manage_blog"] },
  { key: "shop", url: "/admin/pregled/prodavnica", label: "Pregled prodavnice", icon: "bi-shop", module: "shop", anyOf: ["manage_products"] },
  { key: "catalog", url: "/admin/pregled/katalog", label: "Pregled kataloga", icon: "bi-heart-pulse", module: "booking", anyOf: ["manage_services", "manage_packages"] },
];

/** The area overviews this viewer may open (module on + at least one matching permission). */
export function availableAreas(permissions = []) {
  return AREAS.filter((a) => FEATURES[a.module] && a.anyOf.some((p) => permissions.includes(p)));
}

const list = (items, map) => (items || []).map(map);

export function prepareBlogDashboardData({ stats, scheduled, drafts, top, recent }) {
  return {
    title: "Pregled bloga",
    breadcrumbs: [{ label: "Admin", url: "/admin" }, { label: "Pregled bloga", url: null }],
    quickLinks: [
      { label: "Novi članak", url: "/admin/blog/dodavanje", icon: "bi-plus-lg", primary: true },
      { label: "Svi članci", url: "/admin/blog", icon: "bi-list-ul" },
      { label: "Kategorije", url: "/admin/kategorije", icon: "bi-tags" },
    ],
    sections: [
      {
        title: "Objave",
        tiles: [
          { label: "Objavljeni", value: stats.published, url: "/admin/blog?status=published", icon: "bi-check2-circle" },
          { label: "Zakazani", value: stats.scheduled, url: "/admin/blog?status=scheduled", icon: "bi-clock-history" },
          { label: "Nacrti", value: stats.draft, url: "/admin/blog?status=draft", icon: "bi-pencil-square" },
          { label: "Arhivirani", value: stats.archived, url: "/admin/blog?status=archived", icon: "bi-archive" },
          { label: "Pregledi (objavljeni)", value: stats.totalViews, url: "/admin/blog", icon: "bi-eye" },
        ],
      },
      {
        title: "Zahteva pažnju",
        tiles: [
          // a published article without a meta description gets an auto-generated snippet in search results
          { label: "Objavljeni bez meta opisa", value: stats.missingSeo, url: "/admin/blog?status=published", icon: "bi-search" },
        ],
      },
    ],
    activityTabs: [
      { id: "scheduled", label: "Zakazane objave", viewAllUrl: "/admin/blog?status=scheduled", emptyText: "Nema zakazanih objava.",
        items: list(scheduled, (p) => ({ title: p.naslov, subtitle: `Objava: ${p.zakazanoZa || "-"}`, url: `/admin/blog/detalji/${p.id}` })) },
      { id: "drafts", label: "Nacrti", viewAllUrl: "/admin/blog?status=draft", emptyText: "Nema nacrta.",
        items: list(drafts, (p) => ({ title: p.naslov, subtitle: `Kreiran ${p.kreiran}`, url: `/admin/blog/detalji/${p.id}` })) },
      { id: "top", label: "Najčitanije", viewAllUrl: "/admin/blog?status=published", emptyText: "Još nema objavljenih članaka.",
        items: list(top, (p) => ({ title: p.naslov, subtitle: `${p.pregledi} pregleda`, url: `/admin/blog/detalji/${p.id}` })) },
      { id: "recent", label: "Nedavno objavljeno", viewAllUrl: "/admin/blog?status=published", emptyText: "Još nema objavljenih članaka.",
        items: list(recent, (p) => ({ title: p.naslov, subtitle: p.datumObjave || "", url: `/admin/blog/detalji/${p.id}` })) },
    ],
  };
}

export function prepareShopDashboardData({ stats, canOrders, inactive, outOfStock, recent, pendingOrders }) {
  const attention = [{ label: "Bez zaliha (aktivni)", value: stats.outOfStock, url: "/admin/proizvodi?inStock=false", icon: "bi-exclamation-triangle" }];
  if (canOrders) attention.unshift({ label: "Porudžbine na čekanju", value: stats.pendingOrders, url: "/admin/porudzbine?status=pending", icon: "bi-box-seam" });
  const tabs = [
    { id: "out-of-stock", label: "Bez zaliha", viewAllUrl: "/admin/proizvodi?inStock=false", emptyText: "Svi aktivni proizvodi imaju zalihe.",
      items: list(outOfStock, (p) => ({ title: p.naziv, subtitle: p.poNarudzbini ? "Po narudžbini" : "Nema na stanju", url: `/admin/proizvodi/detalji/${p.id}` })) },
    { id: "inactive", label: "Neaktivni", viewAllUrl: "/admin/proizvodi?isActive=false", emptyText: "Nema neaktivnih proizvoda.",
      items: list(inactive, (p) => ({ title: p.naziv, subtitle: `Kreiran ${p.kreiran}`, url: `/admin/proizvodi/detalji/${p.id}` })) },
    { id: "recent", label: "Nedavno dodati", viewAllUrl: "/admin/proizvodi", emptyText: "Nema proizvoda.",
      items: list(recent, (p) => ({ title: p.naziv, subtitle: `${p.cena} · stanje ${p.stanje}`, url: `/admin/proizvodi/detalji/${p.id}` })) },
  ];
  if (canOrders) {
    tabs.push({ id: "orders", label: "Porudžbine na čekanju", viewAllUrl: "/admin/porudzbine?status=pending", emptyText: "Nema porudžbina na čekanju.",
      items: list(pendingOrders, (o) => ({ title: o.korisnik, subtitle: `${o.ukupnaCena} - ${o.datum}`, url: `/admin/porudzbine/detalji/${o.id}` })) });
  }
  return {
    title: "Pregled prodavnice",
    breadcrumbs: [{ label: "Admin", url: "/admin" }, { label: "Pregled prodavnice", url: null }],
    quickLinks: [
      { label: "Novi proizvod", url: "/admin/proizvodi/dodavanje", icon: "bi-plus-lg", primary: true },
      { label: "Svi proizvodi", url: "/admin/proizvodi", icon: "bi-list-ul" },
      { label: "Kategorije", url: "/admin/kategorije", icon: "bi-tags" },
    ],
    sections: [
      { title: "Zahteva pažnju", tiles: attention },
      {
        title: "Katalog",
        tiles: [
          { label: "Aktivni proizvodi", value: stats.active, url: "/admin/proizvodi?isActive=true", icon: "bi-box2-heart" },
          { label: "Neaktivni proizvodi", value: stats.inactive, url: "/admin/proizvodi?isActive=false", icon: "bi-eye-slash" },
        ],
      },
    ],
    activityTabs: tabs,
  };
}

export function prepareCatalogDashboardData(d) {
  const { stats } = d;
  const tiles = [];
  const attention = [];
  const tabs = [];
  const quickLinks = [];
  if (d.canServices) {
    tiles.push({ label: "Aktivne usluge", value: stats.activeServices, url: "/admin/usluge?isActive=true", icon: "bi-heart-pulse" });
    attention.push({ label: "Neaktivne usluge", value: stats.inactiveServices, url: "/admin/usluge?isActive=false", icon: "bi-eye-slash" });
    quickLinks.push({ label: "Nova usluga", url: "/admin/usluge/dodavanje", icon: "bi-plus-lg", primary: true }, { label: "Sve usluge", url: "/admin/usluge", icon: "bi-list-ul" });
    tabs.push(
      { id: "inactive-services", label: "Neaktivne usluge", viewAllUrl: "/admin/usluge?isActive=false", emptyText: "Sve usluge su aktivne.",
        items: list(d.inactiveServices, (s) => ({ title: s.naziv, subtitle: s.cena, url: `/admin/usluge/detalji/${s.id}` })) },
      { id: "recent-services", label: "Nedavno dodate usluge", viewAllUrl: "/admin/usluge", emptyText: "Nema usluga.",
        items: list(d.recentServices, (s) => ({ title: s.naziv, subtitle: `${s.cena} · kreirana ${s.kreirana}`, url: `/admin/usluge/detalji/${s.id}` })) }
    );
  }
  if (d.canPackages) {
    tiles.push({ label: "Aktivni paketi", value: stats.activePackages, url: "/admin/paketi?isActive=true", icon: "bi-box-seam" });
    attention.push({ label: "Neaktivni paketi", value: stats.inactivePackages, url: "/admin/paketi?isActive=false", icon: "bi-eye-slash" });
    quickLinks.push({ label: "Novi paket", url: "/admin/paketi/dodavanje", icon: "bi-plus-lg", primary: !d.canServices }, { label: "Svi paketi", url: "/admin/paketi", icon: "bi-list-ul" });
    tabs.push(
      { id: "inactive-packages", label: "Neaktivni paketi", viewAllUrl: "/admin/paketi?isActive=false", emptyText: "Svi paketi su aktivni.",
        items: list(d.inactivePackages, (p) => ({ title: p.naziv, subtitle: p.cena, url: `/admin/paketi/detalji/${p.id}` })) },
      { id: "recent-packages", label: "Nedavni paketi", viewAllUrl: "/admin/paketi", emptyText: "Nema paketa.",
        items: list(d.recentPackages, (p) => ({ title: p.naziv, subtitle: `${p.cena} · ${p.stavke}`, url: `/admin/paketi/detalji/${p.id}` })) }
    );
  }
  if (d.canResources) attention.push({ label: "Neaktivni resursi", value: stats.inactiveResources, url: "/admin/resursi?isActive=false", icon: "bi-grid-3x3-gap" });
  quickLinks.push({ label: "Kategorije", url: "/admin/kategorije", icon: "bi-tags" });
  return {
    title: "Pregled kataloga",
    breadcrumbs: [{ label: "Admin", url: "/admin" }, { label: "Pregled kataloga", url: null }],
    quickLinks,
    sections: [
      { title: "Zahteva pažnju", tiles: attention },
      { title: "Katalog", tiles },
    ].filter((s) => s.tiles.length > 0),
    activityTabs: tabs,
  };
}

export default { AREAS, availableAreas, prepareBlogDashboardData, prepareShopDashboardData, prepareCatalogDashboardData };
