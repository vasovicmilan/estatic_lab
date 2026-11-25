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

Stranice koje stvarno prikazuju formu (prijava, registracija, kontakt, zakazivanje, korpa, admin) i dalje ispisuju token u samoj formi, pa i dalje prave sesiju. To je namerno: tu je forma svrha posete, a limiter ih štiti pre sesije.

## Kako proveriti posle deploy-a

1. Broj sesija pre i posle: `db.sessions.countDocuments()`. Otvori sajt iz privatnog prozora više puta; broj ne sme da raste.
2. U pregledaču: privatni prozor, početna strana, prijava na newsletter iz podnožja mora da prođe (JavaScript dovuče token pri slanju).
3. Kupon na zakazivanju/korpi: primena i uklanjanje moraju da rade (koriste isti token).
4. `curl -I https://beautymedica.rs/sitemap.xml` mora da vrati `Cache-Control: public, max-age=600`.

## Nije u kodu, a ostaje na serveru

- Otkrivanje uzroka pada memorije: pokreni aplikaciju sa `--max-old-space-size=1024 --heapsnapshot-near-heap-limit=1` (pm2: `--node-args`), pa posle sledećeg pada analiziraj snimak u Chrome DevTools (Memory).
- `pm2 start ... --max-memory-restart 1G`, da proces sam krene ispočetka pre nego što se uguši.
- Spoljni monitor na `/health` i izuzetak za `/health` u Cloudflare geo pravilu.
- Rate limiter je u memoriji procesa: svaki restart ga briše, a u klaster režimu (`-i max`) svaki proces ima svoj brojač.
