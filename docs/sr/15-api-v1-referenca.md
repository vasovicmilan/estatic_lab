# API v1 Referenca

Platforma ima dva potpuno odvojena "lica": server-renderovani web (EJS, sesije, CSRF - `/admin`, `/zakazivanje`, itd.) i JSON API pod `/api/v1`, namenjen mobilnim aplikacijama, budućim spoljnim integracijama, i belom-etiketiranom (white-label) korišćenju platforme kao backend-a za neki drugi frontend. Oba lica pozivaju **iste servise** (`src/services/*`), pa se poslovna logika opisana u ostatku ove dokumentacije primenjuje identično bez obzira kroz koje lice se prolazi - ovaj fajl pokriva samo ono što je specifično za API sloj: autentikaciju, autorizaciju, oblik odgovora, i kompletan spisak ruta.

## Autentikacija

API koristi **JWT (Bearer token)**, ne sesije/kolačiće kao web strana. Tok:

1. `POST /api/v1/auth/register` ili `POST /api/v1/auth/login` (email/lozinka) vraća token u telu odgovora.
2. Svaki sledeći zahtev šalje taj token u `Authorization: Bearer <token>` header-u.
3. Token važi **24 sata** (`crypto.service.js`, `signJwt`), posle čega je potrebna ponovna prijava - trenutno ne postoji refresh-token mehanizam.
4. `GET /api/v1/auth/me` vraća podatke o trenutno prijavljenom nalogu (koristan "ko sam ja" poziv za klijentske aplikacije posle učitavanja sačuvanog tokena).

Token nosi ulogu (`roleName`) i **kompletan spisak dozvola** (`permissions`) korisnika u trenutku prijave (isti obrazac kao sesija na web strani - videti `01-korisnici-role-dozvole.md`). Posledica: ako admin nekom naknadno izmeni ili oduzme dozvolu, **već izdati token to ne vidi** dok ne istekne (do 24h) ili se korisnik ponovo ne prijavi. Za hitno oduzimanje pristupa (npr. otkaz zaposlenom), deaktiviranje naloga (`isActive: false`) je pouzdanije od same izmene role, jer se proverava pri svakom zahtevu koji dotiče taj nalog, ne samo pri izdavanju tokena.

Bez `Authorization` header-a (ili sa nevažećim/isteklim/falsifikovanim tokenom), svaka zaštićena ruta vraća `401`, pre nego što dotakne bazu.

## Autorizacija

Dva sloja, oba primenjena kao Express middleware pre nego što zahtev uopšte stigne do kontrolera:

- **`apiAuthMiddleware`** - da li token uopšte postoji i validan je. Ne postoji nikakav "polovičan" pristup - token je ili validan ili nije.
- **`requirePermission("neka_dozvola")`** - da li dekodirani `permissions` niz iz tokena sadrži tačno tu dozvolu. Isti spisak dozvola i isto značenje kao na web strani (`01-korisnici-role-dozvole.md`) - API ne uvodi paralelan/drugačiji sistem dozvola.

Većina `/admin/*` ruta ima **dva nivoa**: ceo router zahteva bar `access_admin_panel` (opšte "sme li uopšte u admin panel"), a svaka pojedinačna ruta iznad toga zahteva svoju specifičnu dozvolu (npr. `manage_users`, `manage_payouts`). Ovo je namerno "defense in depth" - i propust da se doda specifična provera na jednoj ruti i dalje ostavlja opštu proveru.

Sve `/admin/*` rute vraćaju `403` (ne `404`) kada je token validan ali fali odgovarajuća dozvola - razlika između "ne postojiš" i "ne smeš" je namerna, isto kao na web strani.

## Oblik odgovora

Svaki JSON odgovor ima dosledan oblik:

```json
// uspeh
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }

// greška
{ "success": false, "error": { "id": "abc12345", "status": 400, "message": "...", "code": null } }
```

`meta` se pojavljuje samo na listing rutama (paginacija). `error.id` je isti ID koji se piše u `error.log` (videti `10-logovi-i-revizija.md`) - koristan pri prijavi problema, jer omogućava da se tačan red u serverskom logu pronađe po ID-ju umesto po vremenu.

Slika/upload polja (naslovna slika posta, galerija proizvoda, itd.) **nisu podržana kroz JSON API** - kreiranje/izmena kroz `/api/v1/admin/*` uvek ostavlja postojeću sliku nepromenjenom (ili praznu pri kreiranju). Upload slika i dalje ide isključivo kroz web `/admin` panel.

## Javne rute (bez tokena)

| Ruta | Šta radi |
|---|---|
| `GET /api/v1/catalog/services`, `/packages`, `/products`, `/team`, `/blog/posts`, `/business-partners` (+ `/:slug`) | Isti javni katalog kao web prodavnica/usluge/blog, u JSON obliku |
| `GET /api/v1/booking/:serviceSlug/slots` | Dostupni termini za uslugu (koristi `optionalApiAuth` - radi i bez i sa tokenom) |
| `POST /api/v1/booking/confirm` | Zakazivanje termina kao gost ili prijavljen korisnik |
| `POST /api/v1/auth/register`, `/login`, `/forgot-password`, `PUT /reset-password/:token`, `GET /verify/:token` | Standardan auth tok |

## Rute prijavljenog korisnika (bilo koja rola, samo `apiAuthMiddleware`)

- **`/api/v1/me/*`** - sopstveni nalog: profil, lozinka, brisanje naloga, termini, porudžbine, adrese. Nema `requirePermission` proveru jer je uvek "moje", nikad tuđe.
- **`/api/v1/cart/*`** - korpa i checkout (samo `/cart` i `/orders/checkout` grane zahtevaju token; ostatak `cart.routes.js` je javan gde treba).

## Rute po roli (poseban middleware, ne `requirePermission`)

- **`/api/v1/employee/*`** - `employeeMiddleware`: mora biti prijavljen **i** imati zaposleni profil. Sopstveni raspored, termini, provizije, isplate.
- **`/api/v1/partner/*`** - `partnerMiddleware`: mora biti prijavljen **i** imati partnerski profil. Sopstvena provizija, isplate, katalog za deljenje referalnog linka.

## Admin rute (`/api/v1/admin/*`)

Svaka od ovih zahteva `apiAuthMiddleware` + `access_admin_panel`, plus dozvolu navedenu u koloni ispod. Ovo je ogledalo web `/admin` panela - ista pravila, isti servisi, samo JSON umesto EJS render-a.

### Ljudi (`admin-people.routes.js`)

| Metod | Ruta | Dozvola |
|---|---|---|
| GET | `/users`, `/users/:userId` | `manage_users` |
| PUT | `/users/:userId`, `/status`, `/role`, `/verify`, `/anonymize` | `manage_users` |
| DELETE | `/users/:userId` | `manage_users` |
| GET/POST/PUT/DELETE | `/employees`, `/employees/:employeeId` (+ `/working-hours`) | `manage_employees` |
| GET/POST/PUT/DELETE | `/experts`, `/experts/:expertId` | `manage_employees` |
| GET/POST/PUT/DELETE | `/partners`, `/partners/:partnerId` | `manage_partners` |

### Taksonomija (`admin-taxonomy.routes.js`)

| Metod | Ruta | Dozvola |
|---|---|---|
| GET/POST/PUT/DELETE | `/roles`, `/roles/:roleId` | `manage_roles` |
| GET/POST/PUT/DELETE | `/categories`, `/categories/:categoryId` | `manage_taxonomy` |
| GET/POST/PUT/DELETE | `/tags`, `/tags/:tagId` | `manage_taxonomy` |
| GET/POST/PUT/DELETE | `/resources`, `/resources/:resourceId` | `manage_resources` |

### Katalog (`admin-catalog.routes.js`)

| Metod | Ruta | Dozvola |
|---|---|---|
| GET/POST/PUT/DELETE | `/services`, `/services/:serviceId` (+ `/seo`) | `manage_services` |
| GET/POST/PUT/DELETE | `/packages`, `/packages/:packageId` | `manage_packages` |
| GET/POST/PUT/DELETE | `/products`, `/products/:productId` (+ `/seo`) | `manage_products` |

### Kupljeni paketi (`admin-package-purchase.routes.js`, mount `/admin/package-purchases`)

Ceo router iza `manage_packages` (nema pod-dozvola). `GET /`, `GET /:packagePurchaseId`, `POST /check-coupon` (samo pregled popusta pre finalizacije), `POST /`, `PUT /:packagePurchaseId` (+ `/cancel`), `DELETE /:packagePurchaseId`.

### Zakazivanja (`admin-appointment.routes.js`)

Ceo router iza `manage_appointments_all`. `GET /`, `GET /manual/check-package`, `POST /manual`, `GET /:appointmentId`, `PUT /:appointmentId/confirm|reject|cancel|complete|no-show|reopen|reassign|reschedule`, `DELETE /:appointmentId`.

### Porudžbine (`admin-order.routes.js`)

Ceo router iza `manage_orders`. `GET /orders`, `POST /orders/manual`, `GET /orders/:orderId`, `PUT /orders/:orderId/process|ship|deliver|complete|return|refund|cancel|reopen|contact`, plus `GET /temporary-orders`, `GET /temporary-orders/:orderId`, `PUT /temporary-orders/:orderId/confirm|shipping`.

### Marketing (`admin-marketing.routes.js`)

| Metod | Ruta | Dozvola |
|---|---|---|
| GET/POST/PUT/DELETE | `/posts`, `/posts/:postId` (+ `/status`, `/seo`) | `manage_blog` |
| GET/POST/PUT/DELETE | `/coupons`, `/coupons/:couponId` | `manage_coupons` |
| GET/DELETE | `/newsletter-subscribers`, `/:subscriberId` | `manage_marketing` |
| GET/PUT/DELETE | `/testimonials`, `/:testimonialId` (+ `/approve`, `/reject`) | `manage_marketing` |
| GET/POST/PUT/DELETE | `/business-partners`, `/:partnerId` | `manage_marketing` |
| GET/PUT | `/contacts`, `/:contactId` (+ `/status`) | `manage_marketing` |
| GET/POST/PUT/DELETE | `/newsletter-campaigns`, `/:campaignId` (+ `/send`) | `manage_marketing` |

### Operativno (`admin-ops.routes.js`)

| Metod | Ruta | Dozvola |
|---|---|---|
| GET | `/dashboard` | samo `access_admin_panel` |
| GET/POST/PUT | `/payout-requests` (+ `/direct`, `/:requestId/approve|pay|reject`) | `manage_payouts` |
| GET | `/audit-log` | `view_logs` |
| GET | `/logs`, `/logs/history`, `/logs/history/:date` | `view_logs` |
| GET | `/business-reports`, `/business-reports/history/...` | `view_business_reports` |
| GET/PUT | `/site-settings` | `manage_site_content` |
| GET/PUT | `/profile` | samo `access_admin_panel` (uvek sopstveni admin profil) |

## Šta trenutno NIJE pokriveno API-jem

- **Upload slika/fajlova** - videti napomenu iznad; ostaje isključivo na web `/admin`.
- **Sve što web `/admin` panel ima za pojedinačne poddomene koje ovde nisu eksplicitno navedene** - ako se doda novi web-only admin ekran, proveriti da li mu treba i API ekvivalent pre nego što se pretpostavi da već postoji.

## Poznata ograničenja (namerni kompromisi, ne bagovi)

- **Do 24h zastarela dozvola u tokenu** - videti sekciju Autentikacija iznad.
- **Nema rate-limitinga po tokenu/korisniku na `/api/v1/admin/*`** - globalni rate limiter (`globalLimiter`) i dalje važi za IP adresu, ali specifičnih dodatnih limita za admin API pozive trenutno nema (za razliku od `loginLimiter`/`bookingLimiter`/`availabilityLimiter` na osetljivijim javnim rutama).
