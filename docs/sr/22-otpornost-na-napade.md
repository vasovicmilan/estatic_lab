# 22. Otpornost na botnet napade i nepotrebne sesije

Nastalo posle incidenta 25.11.2026 (sajt nedostupan oko 5 h, vidi izveštaj o incidentu). Cloudflare je zaustavio 96,5% napada, ali je ostatak išao pravo na aplikaciju koja je za svaki zahtev pravila sesiju u MongoDB-u. Ovo je spisak onoga što je u kodu promenjeno i kako to proveriti.

## Šta je promenjeno

| Izmena | Gde | Efekat |
|---|---|---|
| `req.flash(tip)` pri čitanju ne piše u sesiju | `middlewares/flash.middleware.js` | čitanje poruka više ne pravi sesiju |
| CSRF token se pravi tek kad se ispiše | `config/csrf.config.js` (`lazyToken`) | anonimna poseta bez forme ne upisuje sesiju |
| Meta tag, newsletter forma u podnožju i forma za utiske (početna, usluge, paketi, artikli) koriste `csrfTokenSoft` | `views/includes/head.ejs`, `footer.ejs`, `includes/components/testimonial-form.ejs` | prazno za anonimnog posetioca; pravi token samo za prijavljene ili ako sesija već ima token |
| `GET /csrf-token` | `config/csrf.config.js`, `routes/web/web.routes.js` | JavaScript traži token tek pri slanju forme ili AJAX zahteva (`public/js/main.js`) |
| Globalni rate limiter ide odmah posle statike | `app.js` | zahtev koji će biti odbijen ne košta sesiju, bazu ni red u logu |
| Odgovor 429 je običan tekst, a u log ide jedan zbirni red u minuti | `middlewares/rate-limiter.middleware.js` (`globalLimitExceeded`) | nema renderovanja stranice greške i nema reda u logu po zahtevu |
| `sitemap.xml` i `llms.txt` se keširaju 10 minuta | `controllers/web/seo.controller.js` | jedan upit u bazu na 10 minuta umesto desetak po zahtevu |
| Limit tela zahteva 100 KB, a 5 MB samo za `/admin` i `/api` | `app.js` | javne rute ne mogu da zauzmu megabajte po zahtevu; preveliko telo dobija 413 |

## Limiteri: šta se broji

Pravi statički fajlovi ne stižu do limitera, jer je `express.static` montiran pre njega i sam odgovara. Zato limiter **nema izuzetke po ekstenziji ni po prefiksu**: ranije su takvi izuzeci puštali svaki nepostojeći „fajl“ (npr. `/blog/x.txt`), sve pod `/api/` van `/api/v1` i `/api/v1/...x.json` do ruta, sesije i baze bez ikakvog limita (ispravljeno 26.11.2026).

| Zahtev | Limit (po minutu, po IP adresi) |
|---|---|
| Pravi statički fajl | ne broji se |
| `GET`/`HEAD` video i poster iz `/uputstva` (tačno ta dva oblika adrese) | `RATE_LIMIT_MEDIA_MAX`, 600, zaseban brojač |
| `/api/v1/...` | `apiLimiter`, `RATE_LIMIT_API_MAX`, 120 |
| Sve ostalo, uključujući nepostojeće putanje i ostatak `/api/` | `globalLimiter`, `RATE_LIMIT_GLOBAL_MAX`, 100 |
| `/admin` | pored opšteg i `adminLimiter`, `RATE_LIMIT_ADMIN_MAX`, 300 |

Posledica: i slika koja nedostaje (404) troši kvotu posetioca, pa polomljene linkove ka slikama treba popraviti.

Stranice koje stvarno prikazuju formu (prijava, registracija, kontakt, zakazivanje, korpa, admin) i dalje ispisuju token u samoj formi, pa i dalje prave sesiju. To je namerno: tu je forma svrha posete, a limiter ih štiti pre sesije.

## Kako proveriti posle deploy-a

1. Broj sesija pre i posle: `db.sessions.countDocuments()`. Otvori sajt iz privatnog prozora više puta; broj ne sme da raste.
2. U pregledaču: privatni prozor, početna strana, prijava na newsletter iz podnožja mora da prođe (JavaScript dovuče token pri slanju).
3. Kupon na zakazivanju/korpi: primena i uklanjanje moraju da rade (koriste isti token).
4. `curl -I https://beautymedica.rs/sitemap.xml` mora da vrati `Cache-Control: public, max-age=600`.

## Nije u kodu, a ostaje na serveru

- Otkrivanje uzroka pada memorije: pokreni aplikaciju sa `--max-old-space-size=1024 --heapsnapshot-near-heap-limit=1` (pm2: `--node-args`), pa posle sledećeg pada analiziraj snimak u Chrome DevTools (Memory).
- `pm2 start ... --max-memory-restart 1G`, da proces sam krene ispočetka pre nego što se uguši.
- Spoljni monitor na `/health`. Ako Cloudflare pravilo izaziva posetioce van regiona, treba mu izuzetak za `/health` (i obavezno `and not cf.client.bot`, videti `DEPLOYMENT.md`).
- Rate limiter je u memoriji procesa: svaki restart ga briše, a u klaster režimu svaki proces bi imao svoj brojač. Zato aplikacija radi kao **jedna instanca u fork režimu** (videti `DEPLOYMENT.md`).
