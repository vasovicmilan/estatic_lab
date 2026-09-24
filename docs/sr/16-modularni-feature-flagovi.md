# Modularni Feature Flag-ovi (blog/shop/booking)

White-label klijenti ne kupuju uvek ceo sistem — neko hoće samo booking (zakazivanje), neko samo prodavnicu, neko samo blog, ili bilo koju kombinaciju. `ENABLED_MODULES` (u `.env`, videti `.env.example`) određuje koji delovi platforme postoje za dati deployment.

## Zašto env promenljiva, ne admin panel

Namerno je ovo **deploy-time** odluka (u `.env`), ne nešto što admin menja uživo iz panela (za razliku od valute/booking politike/provizije, koje su DB-backed u `runtime-settings.cache.js`). Koji moduli postoje se odlučuje kad se klijentov server podiže (videti `DEPLOYMENT.md` — jedan `pm2` proces po klijentu), a ne menja se svakodnevno — isključivanje booking-a nije "podešavanje", menja koji podaci i dozvole uopšte imaju smisla.

## Tri osnovna modula, plus izvedeni

```
ENABLED_MODULES=blog,shop,booking   # bilo koja kombinacija, uključujući samo jedan
```

Sva kombinacija je validna, uključujući sve tri ili samo jedan. Nepoznata vrednost u listi ruši server odmah pri startu, sa jasnom greškom (`src/config/features.config.js`) — bolje da se ne podigne nego da tiho radi pogrešno.

Tri **izvedena** flag-a se ne podešavaju direktno, računaju se iz osnovna tri:

| Flag | Uključen kada | Zašto |
|---|---|---|
| `coupons` | `shop` ILI `booking` | Kupon nema smisla bez bar jednog kanala na koji se primenjuje; postoji čim postoji bilo koji od ta dva |
| `partners` (afilijativni/referalni program, `/moj-partner-nalog`) | `shop` ILI `booking` | Partner zarađuje proviziju na porudžbine i/ili termine — treba mu bar jedno od to dvoje da bi imao smisla |
| `employees` (`/moj-nalog`) | `booking` | Zaposleni ispunjava termine — nema koncept zaposlenog bez booking-a |

Paketi (`/paketi`) se odnose isključivo na usluge (potvrđeno), pa su deo `booking` modula, nemaju sopstveni flag.

**Bitno**: `/saradnici` (business-partner.controller.js — marketing stranica "naši saradnici/sponzori") **nije** gejtovana nijednim flag-om — to je opšti marketing sadržaj, potpuno odvojen pojam od partnerskog (afilijativnog) programa iznad, uprkos sličnom imenu.

## Kako se primenjuje

Dva oblika, u zavisnosti od toga da li fajl služi jednom modulu ili više:

- **Gejtovanje na nivou mount-a** — kad je CEO fajl jednonadležan (npr. `booking.routes.js`), `requireModule("booking")` ide direktno na `router.use("/booking", requireModule("booking"), bookingRoutes)` u `index.routes.js`. Najjednostavnije, najčitljivije.
- **Gejtovanje po pojedinačnoj ruti** — kad fajl meša resurse iz više modula u istom router-u (npr. `admin-catalog.routes.js` služi i usluge/pakete I proizvode), `requireModule(...)` ide na SVAKU rutu pojedinačno, tačno onako kako `requirePermission(...)` već ide po ruti u tim istim fajlovima — nije potrebno deliti fajl na više manjih, dovoljno je dodati jedan middleware pored postojećeg na istoj liniji.

**`src/middlewares/feature.middleware.js`** — `requireModule("shop")`; ako modul nije uključen, vraća čist **404** (ne 403 — za posetioca, isključen modul jednostavno ne postoji na ovom deployment-u, isto kao ruta koja nikad nije ni postojala).

**`src/config/locals.config.js`** — `res.locals.features` dostupan u SVAKOM EJS template-u globalno (`<% if (features.shop) { %>...<% } %>`), za sakrivanje navigacije/sekcija.

## Šta JE gejtovano danas

**Navigacija i sadržaj** (`src/views/includes/navigation.ejs`, `home.ejs`):
- Javni nav — linkovi ka Uslugama/Paketima (booking), Prodavnici (shop), Blogu (blog), Partnerskom programu (partners) se sakrivaju; "Naš tim" ostaje uvek vidljiv (Expert, namerno nezavisan)
- Dugme "Zakažite termin" → booking; ikonica korpe → shop
- Account dropdown (desktop i mobilni) — "Moji termini" → booking; "Moje porudžbine"/"Moje adrese"/"Korpa" → shop
- Admin bočni meni — data-driven (`adminNavGroups`), svaka stavka ima opciono `feature` polje; stavka bez njega je uvek vidljiva (opšti sadržaj — role, kategorije/tagovi, korisnici, eksperti, newsletter, itd.). Prazna grupa (npr. "Zakazivanje" kad je booking isključen) se ne prikazuje uopšte. "Isplate" je vidljivo čim postoji bar jedna od (zaposleni, partneri), pošto pokriva proviziju za oboje
- Početna strana (`index.service.js`'s `getLandingPageData()`) — za isključen modul se **ni ne šalje upit ka bazi** (ne samo sakrije rezultat); `home.ejs` već proverava `data.X.length > 0` po sekciji, pa prazan rezultat automatski uklanja tu sekciju bez ijedne izmene template-a
- Footer (`footer.ejs`) — isti moduli-specifični linkovi sakriveni kao u header nav-u
- Sitemap (`sitemap.service.js`) — i statični unosi za landing stranice (`/usluge`, `/prodavnica`, `/blog`) i pojedinačni unosi (usluge/proizvodi/postovi, plus njihove kategorije/tagovi) se preskaču za isključen modul — ovo pokriva i klijenta koji je ranije imao uključen modul: stari zapisi u bazi ne ostavljaju mrtve, 404 unose u sitemap-u
- `llms.txt` (`llms-txt.service.js`) — ista logika kao sitemap; cela "Prodavnica" sekcija (ne samo njene stavke) se preskače kad je `shop` isključen, umesto da ostane prazan naslov sa mrtvim linkom

Web strana (`web.routes.js`), na nivou mount-a — svaki router je jedna nadležnost:
- `/blog` → `blog`
- `/usluge`, `/paketi`, `/zakazivanje`, `/moj-nalog` → `booking` (`/moj-nalog` posebno i preko `employees`)
- `/prodavnica`, `/korpa` → `shop`
- `/kupon/*` → `coupons`
- `/moj-partner-nalog`, `/partnerski-program` → `partners`
- `/nas-tim` **namerno NIJE gejtovano** — to je Expert (javni "naš tim" profil), namerno nezavisan od booking-a (videti `expert.model.js`-ov sopstveni komentar: radi i bez ijednog naloga za prijavu iza sebe)

API v1 (`index.routes.js`), na nivou mount-a tamo gde je fajl već jednonadležan:
- `/api/v1/booking` → `booking`
- `/api/v1/employee` → `employees`
- `/api/v1/partner` → `partners`
- `/api/v1/admin/appointments` → `booking`
- `/api/v1/admin/package-purchases` → `booking`
- `/api/v1/admin/orders`, `/api/v1/cart` → `shop`

API v1, **po pojedinačnoj ruti** unutar fajlova koji mešaju module:
- `catalog.routes.js` (javni) — `/services`, `/packages` → `booking`; `/products` → `shop`; `/blog/posts` → `blog`; `/team`, `/business-partners` NISU gejtovani (Expert i saradnici, oba namerno nezavisna)
- `admin-catalog.routes.js` — usluge/pakete → `booking`, proizvodi → `shop`
- `admin-marketing.routes.js` — postovi → `blog`, kuponi → `coupons`; newsletter/testimonijali/saradnici/kontakt/kampanje NISU gejtovani (opšti marketing sadržaj, ne vezan ni za jedan modul)
- `admin-taxonomy.routes.js` — resursi → `booking`; role/kategorije/tagovi NISU gejtovani (role postoje uvek, kategorije/tagovi su polimorfni preko domena)
- `admin-people.routes.js` — zaposleni → `employees`, partneri → `partners`; korisnici i eksperti NISU gejtovani (korisnici su opšti, eksperti su namerno nezavisni od booking-a, isto kao `/nas-tim`)
- `admin-uploads.routes.js` — gejtovano po `:type` iz URL-a: `services`/`packages` → `booking`, `products` → `shop`, `posts` → `blog`, `partners` → `partners`; ostali tipovi NISU gejtovani

## Šta NIJE gejtovano — stvaran, imenovan posao koji ostaje

**Admin bočni meni** — već gejtovano, videti iznad.

**Strukturirani podaci / SEO metapodaci** — `organization.builder.js` (sajt-wide JSON-LD koji se ubacuje na svaku stranicu preko `locals.config.js`'s `orgJsonLd`) nije proveren za modul-specifična schema.org polja (npr. `Offer`/`Product` blok); vredi proveriti da li se strukturirani podaci za isključen modul i dalje emituju.

**robots.txt** — nije pregledan za modul-specifična `Disallow` pravila; trenutno ima samo opštu listu iz ranijeg rada (booking-flow state stranice, admin, itd.), ništa još svesno modula.
