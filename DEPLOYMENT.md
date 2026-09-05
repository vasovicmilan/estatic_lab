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

Izmene ovde su odmah aktivne, bez restart-a servera.

## 7. Unesi katalog kroz admin panel

Usluge, paketi, proizvodi, zaposleni, resursi (aparati/stolovi) - sve se unosi kroz admin panel (Admin → Katalog / Ljudi), ručno, specifično za ovog klijenta. Nema univerzalnog seed-a za ovo - svaki klijent ima potpuno drugačiju ponudu.

**Seed skripte u `src/database/seeds/run-*.js` su Estetik Lab-ov sopstveni demo/referentni sadržaj** (blog objave, ESMA katalog usluga, itd.) - korisne kao primer strukture ili za lokalni development, ali se **ne pokreću** za novog klijenta osim ako svesno želiš da preneseš baš taj sadržaj.

## 8. Pravno/sadržajno - ručna izmena (za sada)

Sledeće **trenutno zahteva ručnu izmenu koda** pre nego što ide u produkciju za novog klijenta - nije još izvučeno u admin panel (planirano za kasnije, videti internu belešku o white-label planu):

- Politika privatnosti i Uslovi korišćenja (`src/presenters/public/index.presenter.js`) - sadrže naziv firme, adresu, opis usluga specifičan za Estetik Lab
- SEO naslovi/opisi razliveni po `index.service.js`, `blog.service.js`, i par kontrolera - svi sadrže "Estetik Lab" direktno u tekstu
- `src/config/business.config.js` - naziv, adresa, telefon, društvene mreže (koristi se za kontakt stranicu i JSON-LD strukturirane podatke)
- `BASE_URL` fallback stringovi u par fajlova (`cors.config.js`, `google-calendar.service.js`, `telegram.listener.js`, itd.) - ovo su samo fallback vrednosti ako `.env`-ov `BASE_URL` nedostaje, pa retko stvarno bitno ako je `.env` popunjen ispravno, ali vredi ih uskladiti

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

## Provera pre lansiranja

```bash
npm run build:css     # ako nije već pokrenuto u koraku 1.5
npm run build:icons   # ako nije već pokrenuto u koraku 1.5
npm test              # unit + integration testovi
npx playwright test   # E2E testovi
```

Sve četiri komande treba da prođu bez greške na svežem clone-u pre nego što se deployment smatra spremnim. Bez prve dve, sajt će raditi bez stilova (vidi korak 1.5).
