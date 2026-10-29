# Deployment - novi klijent (runbook)

Ovaj fajl je vodič za podizanje **nove, nezavisne instance** platforme za novog klijenta (hosted white-label model - jedan deployment po klijentu, ne multi-tenant). Prati redosled od praznog servera do funkcionalnog admin panela.

Pretpostavlja se već postojeća infrastruktura (server, Node.js, MongoDB, PM2, nginx, Cloudflare) po istom obrascu kao produkcija - ovaj fajl pokriva **aplikacioni** deo podešavanja, ne provisioning servera samog.

## 1. Kloniraj i instaliraj

```bash
git clone <repo-url> <klijent-folder>
cd <klijent-folder>
npm install
```

**Napomena:** koristi običan `npm install`, **ne** `npm install --production`. CSS/ikonice build (korak 1.5 ispod) zahteva `sass` i `esbuild`, koji su `devDependencies` - `--production` bi ih preskočio i build bi pukao. Ovi paketi se koriste samo pri build-u, ne u runtime-u servera, pa nema štete od toga što ostaju instalirani na produkciji.

## 1.5. Build CSS i ikonica (obavezno, posle svakog `npm install` i posle svake izmene `.scss`/`.css`/ikonica)

Sajt ne servira Bootstrap/Bootstrap Icons direktno iz `node_modules` - umesto punog paketa, build koraci prave prilagođen, mnogo manji CSS/font specifično za ono što se stvarno koristi u kodu. Bez ovog koraka, `<head>` referencira fajlove koji ne postoje (`src/public/css/bootstrap.custom.min.css`, `app.min.css`, `bootstrap-icons.subset.css`, `src/public/fonts/bootstrap-icons.subset.woff2`) i sajt će raditi bez stilova.

**Jednokratno po serveru** - `build:icons` koristi Python alat `fonttools` (`pyftsubset`) za sečenje Bootstrap Icons fonta na samo iskorišćene ikonice:

```bash
pip install fonttools brotli --break-system-packages
```

Ako `pip` upozori da `pyftsubset` nije u `PATH`-u (`~/.local/bin` nije dodat), dodaj ga jednom:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
which pyftsubset   # treba da vrati putanju, ne prazno
```

**Sam build** (posle svakog `npm install` i posle svake izmene stilova/ikonica):

```bash
npm run build:css     # custom Bootstrap build (src/assets/scss/custom-bootstrap.scss) + minifikovan app.min.css
npm run build:icons   # subset Bootstrap Icons font (src/public/fonts/bootstrap-icons.subset.woff2 + prateći CSS)
```

Izlazni fajlovi se **ne commit-uju u git** (vidi `.gitignore`) - moraju se generisati na svakom serveru/deployment-u posebno. Ako dodaš novu `bi-*` ikonicu klasu bilo gde u `src/views` ili `src/public/js/main.js`, moraš ponovo pokrenuti `npm run build:icons`, inače će ta ikonica nedostajati iz font-a.

## 2. Environment promenljive

```bash
cp .env.example .env
```

Popuni `.env` - videti komentare u samom fajlu za objašnjenje svake promenljive. Ukratko, ono što se **mora** popuniti za funkcionalan deployment:

- `MONGO_URI` - nova, prazna baza (nikad deljena sa drugim klijentom)
- `BASE_URL`, `SITE_NAME` - domen i naziv ovog klijenta
- `SESSION_SECRET`, `JWT_SECRET` - **generiši sveže** po deployment-u, nikad ponovo koristi (`openssl rand -hex 32`)
- `AES_SECRET` - ključ za šifrovanje osetljivih polja; mora imati **tačno 32 karaktera** (`openssl rand -hex 16`). Ne menjati posle prvog pokretanja, inače se već šifrovani podaci ne mogu pročitati
- `ENABLED_MODULES` - koji moduli postoje kod ovog klijenta (podskup `blog,shop,booking`; vidi `docs/sr/16-modularni-feature-flagovi.md`)
- `WHITE_LABEL=true` - za **novog klijenta** (neutralan identitet i početni sadržaj umesto Estetik Lab tekstova); za sam Estetik Lab ostaviti `false`
- `BIND_HOST=127.0.0.1` i `TRUST_PROXY_HOPS` - vidi odeljak o serveru ispod
- `BACKUP_DIR` - folder za dnevne bekape (vidi korak 9)
- SMTP podaci - mailbox ovog klijenta
- `SUPPORT_EMAIL` - kontakt email ovog klijenta

Ostalo (Google Calendar, Google OAuth, Telegram) je opciono - platforma radi bez njih, samo su te integracije neaktivne dok se ne popune.

**Šta NIJE ovde, namerno:** politika zakazivanja (rok otkazivanja, bafer, itd.) i valuta više nisu environment promenljive niti hardkodovane konstante - podešavaju se kroz admin panel (korak 6 ispod), pošto su to poslovne odluke klijenta, ne tehnička konfiguracija deployment-a.

## 3. Seeduj role (obavezno, jednom)

```bash
node src/database/seeds/run-roles-seed.js
```

Ovo kreira `admin`/`employee`/`partner`/`user` role sa njihovim dozvolama. Bez ovoga, niko ne može ništa - ovo je jedini **zaista obavezan** seed korak za novi deployment.

## 4. Pokreni server

```bash
pm2 start src/server.js --name <klijent-ime> -i max
```

(ili po ustaljenom PM2/nginx/Cloudflare obrascu koji već koristiš za produkciju - podesi nginx reverse proxy i Cloudflare DNS/SSL za domen ovog klijenta)

## 5. Registruj prvi nalog (postaje admin automatski)

Otvori sajt i registruj se normalno (email + lozinka, ili Google). **Prvi ikad registrovan korisnik na svežoj bazi automatski postaje admin** - odmah aktivan, bez potrebe za potvrdom emaila (videti `user.service.js`'s `resolveRegistrationRole`). Nema posebne komande za ovo - samo prva registracija.

## 6. Podesi sadržaj i politiku kroz admin panel

Uloguj se kao admin i idi na **Admin → Sadržaj i marketing → Sadržaj sajta** (`/admin/sajt`). Ovde se podešava sve što je specifično za ovog klijenta, bez ijedne izmene koda:

- **Hero slika** - naslovna slika početne strane
- **Politika zakazivanja** - razmak između termina, korak ponuđenih termina, rok za samostalno otkazivanje, pragovi za pomeranje termina
- **Valuta** - kod (RSD/EUR/USD...), simbol za prikaz, pozicija simbola
- **Radno vreme salona i neradni dani** - bez toga je zakazivanje otvoreno po podrazumevanom rasporedu
- **Provizija i prodavnica** - minimalna provizija, cena dostave, rok čekanja provizije
- **Podaci o firmi** - naziv, PIB, matični broj, adresa, kontakt, društvene mreže (koriste se i u kontakt stranici i u strukturiranim podacima za pretragu)
- **Tekstovi sajta** (`/admin/sajt/sadrzaj`) - O nama, FAQ, privatnost, uslovi, partnerski program i **SEO naslov/opis za 13 stranica** (vidi `docs/sr/18-marketing-seo-blog-newsletter.md`)

Izmene ovde su odmah aktivne, bez restart-a servera.

## 7. Unesi katalog kroz admin panel

Usluge, paketi, proizvodi, zaposleni, resursi (aparati/stolovi) - sve se unosi kroz admin panel (Admin → Katalog / Ljudi), ručno, specifično za ovog klijenta. Nema univerzalnog seed-a za ovo - svaki klijent ima potpuno drugačiju ponudu.

**Seed skripte u `src/database/seeds/run-*.js` su Estetik Lab-ov sopstveni demo/referentni sadržaj** (blog objave, ESMA katalog usluga, itd.) - korisne kao primer strukture ili za lokalni development, ali se **ne pokreću** za novog klijenta osim ako svesno želiš da preneseš baš taj sadržaj.

## 8. Pravno i sadržajno: white-label klijent

Sa `WHITE_LABEL=true` aplikacija kreće sa **neutralnim identitetom i početnim tekstovima** (bez Estetik Lab naziva, PIB-a i adrese), a sve se menja kroz admin panel; ručna izmena koda više nije potrebna za tekstove. Šta ipak treba uraditi pre lansiranja:

- **Pravni tekstovi** (privatnost, uslovi) u `/admin/sajt/sadrzaj` su početni šabloni. Pre objave ih mora pregledati advokat klijenta; nisu pravni savet.
- **Podaci o firmi** (naziv, PIB, matični broj, adresa) u `/admin/sajt`. Ako su prazni, strukturirani podaci i kontakt stranica ih izostavljaju.
- **Slike brenda**: logo, favicon i `default-og.webp` (slika za deljenje na društvenim mrežama) zamene se fajlovima klijenta.
- **SEO naslovi i opisi** za 13 stranica u `/admin/sajt/sadrzaj`.
- **Frontend** (ako se koristi poseban Angular klijent): njegov env sa adresom API-ja ovog klijenta.
- `BASE_URL` mora biti tačan javni domen: iz njega se prave canonical adrese, `sitemap.xml` i `llms.txt`.

Seed skripte (`src/database/seeds/run-*.js`) sadrže Estetik Lab demo sadržaj i ne pokreću se za novog klijenta.

## 9. Bekap i video uputstva

- **Bekap:** podesi cron za `npm run backup:daily` (vidi `docs/sr/17-bekapi.md`). Bekap bez probe vraćanja nije bekap: bar jednom uradi probno vraćanje na drugoj bazi, i razmotri kopiju van servera.
- **Video uputstva** (`/uputstva`): snimaju se i objavljuju na razvojnoj mašini (`npm run tutorials:all`), a gotovi fajlovi se kopiraju u `storage/tutorials` na serveru ili u folder iz `TUTORIALS_DIR`. Folder mora biti van `src/public` i ne ulazi u git. Bez njega stranica radi, samo su kartice označene kao nedostupne. Vidi `docs/sr/19-video-uputstva.md`.

## Ažuriranje postojeće produkcije (npr. beautymedica.rs)

Ovo poglavlje je za **redovno ažuriranje već pokrenutog deployment-a** (ne za podizanje novog klijenta) - standardan tok kad se primenjuje nova izmena koda:

```bash
cd <postojeci-folder>
npm install            # ako je package.json promenjen (nova zavisnost)
npm test                # obavezno pre restart-a
npm run build:css       # ako je bilo koja .scss/.css izmena
npm run build:icons     # ako je dodata/uklonjena bi-* ikonica bilo gde
pm2 restart <ime-procesa>
```

`npm run build:css`/`build:icons` su bezopasni da se pokrenu i kad ništa nije promenjeno (samo ponovo generišu iste fajlove) - u slučaju sumnje, pokreni oba. Preskačeš ih jedino ako si siguran da izmena ne dodiruje CSS/ikonice.

## Server: nginx, Cloudflare, ufw, fail2ban

Podešavanje produkcionog servera (beautymedica.rs: nginx + Cloudflare ispred PM2 procesa). Aplikacija sama ne može da zaštiti server od skeniranja, pa su slojevi ovakvi:

- **Aplikacija sluša samo lokalno.** `BIND_HOST=127.0.0.1` u `.env` (kad nije postavljeno, sluša na `0.0.0.0`), tako da port aplikacije nije dostupan sa interneta, samo preko nginx-a.
- **`TRUST_PROXY_HOPS=2`** kad su ispred Cloudflare **i** nginx (samo nginx = `1`). Bez toga `req.ip` je IP proxy-ja i rate limiteri broje sve posetioce kao jednog.
- **nginx `real_ip`**: `set_real_ip_from` za svaki Cloudflare opseg (`https://www.cloudflare.com/ips-v4` i `ips-v6`) i `real_ip_header CF-Connecting-IP;`. Opsege povremeno osvežavati.
- **Rate limiteri** (po minutu po klijentu): `RATE_LIMIT_GLOBAL_MAX=100`, `RATE_LIMIT_API_MAX=120`, `RATE_LIMIT_ADMIN_MAX=300` (podrazumevano u kodu). Statički fajlovi se ne broje. Podizanje limita nije rešenje za Cloudflare izazov - to je posebno Cloudflare pravilo.
- **ufw**: SSH, a 80/443 samo sa Cloudflare opsega; ostalo `deny incoming`. Port aplikacije se ne otvara.
- **fail2ban**: filter nad nginx access logom; jail ne koristi ufw (iza Cloudflare-a ufw vidi samo Cloudflare IP) nego nginx `deny` listu (include u `server` bloku) i `nginx -s reload`.
- **Dnevni logovi**: aplikacija piše dnevno rotirane fajlove (`pino-roll`). fail2ban razvija glob putanje samo pri startu, pa novi dnevni fajl ostaje neprimećen - potreban je mali čuvar (cron/systemd timer) koji pri promeni imena današnjeg fajla radi `fail2ban-client reload`.
- **Cloudflare**: skeniranje za `.php`/`wp-*`/`.env` i sl. blokirati posebnim custom pravilom (Block), ne u pravilu za izazov.

Provera: `sudo ufw status verbose`, `sudo fail2ban-client status`, `sudo fail2ban-client status <jail>`, `sudo nginx -t`.

## Provera pre lansiranja

```bash
npm run build:css     # ako nije već pokrenuto u koraku 1.5
npm run build:icons   # ako nije već pokrenuto u koraku 1.5
npm test              # unit + integration testovi
npx playwright test   # E2E testovi
```

Sve četiri komande treba da prođu bez greške na svežem clone-u pre nego što se deployment smatra spremnim. Bez prve dve, sajt će raditi bez stilova (vidi korak 1.5). Brojeve testova ne pamti ova stranica: aktuelno stanje je u `docs/sr/12-testiranje.md`.

Posle pokretanja proveri i: `/sitemap.xml`, `/robots.txt` i `/llms.txt` (moraju imati ispravan domen i samo uključene module), probni mejl (SMTP), i da `/admin` traži prijavu.
