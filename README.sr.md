# Estatic Lab — Platforma za wellness i estetski studio

> Full-stack platforma za zakazivanje termina, upravljanje sadržajem i poslovanje, razvijena za realan spa/estetski wellness studio.
> Uživo na: [beautymedica.rs](https://beautymedica.rs)
> Repozitorijum: `vasovicmilan/estatic_lab`

---

## Sadržaj

1. [Šta je ovaj projekat](#1-šta-je-ovaj-projekat)
2. [Zašto je napravljen](#2-zašto-je-napravljen)
3. [Kome je namenjen](#3-kome-je-namenjen)
4. [Tehnologije](#4-tehnologije)
5. [Arhitektura](#5-arhitektura)
6. [Model podataka i poslovna logika](#6-model-podataka-i-poslovna-logika)
7. [Bezbednost](#7-bezbednost)
8. [Notifikacije i integracije](#8-notifikacije-i-integracije)
9. [SEO](#9-seo)
10. [Testiranje](#10-testiranje)
11. [Struktura projekta](#11-struktura-projekta)
12. [Environment promenljive](#12-environment-promenljive)
13. [Pokretanje projekta](#13-pokretanje-projekta)
14. [Filozofija dizajna i naučene lekcije](#14-filozofija-dizajna-i-naučene-lekcije)
15. [Plan daljeg razvoja](#15-plan-daljeg-razvoja)

---

## 1. Šta je ovaj projekat

**Estatic Lab** je kompletna veb aplikacija koja pokriva ceo online prostor i svakodnevno poslovanje jednog wellness/estetskog studija: javni prezentacioni sajt, sistem za online zakazivanje termina, korisnički nalog za klijente, portal za zaposlene (terapeute) i potpun interni admin panel — sve u jednoj Node.js/Express aplikaciji.

Ovo nije generički template ili "booking SaaS" proizvod. Napravljen je konkretno prema tome kako *ovaj* studio zaista posluje: pojedinačne usluge sa više varijanti trajanja/cene, paketi od više seansi koji se plaćaju uživo a koriste online, mali tim terapeuta sa sopstvenim nedeljnim rasporedom, i vlasnik biznisa kome je potreban uvid u sve (termine, poruke, kupone, newsletter pretplatnike, utiske klijenata) sa jednog mesta.

## 2. Zašto je napravljen

Vođenje malog wellness studija svakodnevno podrazumeva mnogo ručne koordinacije: telefonski pozivi za zakazivanje, papirni ili excel raspored, gotovinska/kartična plaćanja unapred plaćenih paketa tretmana koja se prate "na oko" ili u svesci, i nedostatak doslednog načina za praćenje klijenata ili prikupljanje recenzija. Ovaj projekat zamenjuje sve to jednim sistemom koji:

- omogućava klijentima da sami zakažu tačno određenu varijantu usluge, u tačno određeno vreme, kod tačno određenog terapeuta (ili "bilo ko slobodan"), u bilo koje doba dana — bez telefonskog poziva;
- ispravno sprečava duplo zakazivanje i primenjuje pauzu (buffer) između termina, tako da terapeuti nemaju nula minuta predaha između klijenata;
- precizno prati unapred plaćene pakete od više seansi, tako da klijent koji je kupio "10 seansi" ne može slučajno da dobije 11. seansu, i da se seansa ne označava kao "iskorišćena" dok zaista nije održana;
- daje vlasniku i osoblju studija jedan admin panel za upravljanje uslugama, cenama, paketima, kuponima, blog sadržajem i terminima, bez direktnog rada sa bazom podataka;
- automatski obaveštava i klijenta i interni tim (mejlom i putem Telegrama) o svakom bitnom događaju — zakazivanje, potvrda, otkazivanje, promena terapeuta, novi utisak, nova poruka sa kontakt forme;
- gradi pravu SEO strukturu (meta tagovi, Open Graph, sitemap, kanonski URL-ovi) za svaku uslugu, paket, blog objavu i kategoriju, jer je organski saobraćaj sa pretrage izuzetno bitan za lokalni biznis.

## 3. Kome je namenjen

- **Gosti / potencijalni klijenti** — pregledaju usluge i pakete, čitaju FAQ i utiske drugih klijenata, zakazuju termin bez pravljenja naloga (u pozadini se transparentno kreira lagani "gost" nalog).
- **Registrovani klijenti** — upravljaju svojim budućim i prošlim terminima, vide koliko im je seansi ostalo na kupljenom paketu, otkazuju termin u skladu sa pravilima, ostavljaju utisak.
- **Terapeuti (zaposleni)** — vide sopstveni dnevni raspored, detalje termina, i menjaju status termina (potvrda / završeno / nije se pojavio / odbijeno) za termine koji su njima dodeljeni.
- **Admin / vlasnik studija** — admin panel zaštićen dozvolama za vođenje celog biznisa: usluge, paketi, taksonomija (kategorije/tagovi), blog, kuponi, newsletter, kontakt poruke, utisci, zaposleni, eksperti, uloge i dozvole, i svaki termin u sistemu.

## 4. Tehnologije

| Sloj | Tehnologija |
|---|---|
| Runtime | Node.js, ES moduli (`"type": "module"`) |
| Web framework | Express 5 |
| Baza podataka | MongoDB preko Mongoose 9 |
| View sloj | EJS (server-side renderovanje, bez SPA frameworka) |
| CSS framework | Bootstrap 5.3 + Bootstrap Icons |
| Sesije | `express-session` + `connect-mongo` (sesije čuvane u MongoDB) |
| Autentifikacija | Autentifikacija zasnovana na sesiji + Google OAuth prijava; JWT (`jsonwebtoken`) za stateless tokene (npr. reset lozinke / potvrda naloga) |
| Lozinke | `bcryptjs` |
| CSRF zaštita | `csrf-sync` (synchronizer token pattern) |
| Validacija ulaza | `express-validator` |
| Rate limiting | `express-rate-limit`, podešen po svakom tipu endpointa posebno |
| Bezbednosni headeri | `helmet`, ručno podešena CSP (Content-Security-Policy) |
| Zaštita od NoSQL injekcije | `mongo-sanitize` |
| Upload fajlova | `multer` |
| Obrada slika | `sharp` (resize/optimizacija u WebP) |
| Obrada videa | `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` |
| Email | `nodemailer` (SMTP) |
| Telegram notifikacije | `telegraf` |
| Generisanje PDF-a | `pdfkit` |
| Logovanje | `pino` (strukturirano logovanje), `morgan` (logovanje HTTP zahteva) |
| Testiranje | Ugrađeni Node.js test runner (`node --test`), `supertest` za HTTP integracione testove, `mongodb-memory-server` za izolovane test baze |
| Dev alati | `nodemon` |

Nema frontend build koraka, nema bundlera, nema client-side frameworka — stranice se renderuju na serveru pomoću EJS-a, i po potrebi progresivno "oplemenjuju" čistim JavaScript widgetima (admin form builderi, editor rasporeda, repeateri, multiselect polja). Ovo je namerna odluka: drži stack jednostavnim, brzim za razvoj kada radi jedna osoba, i lakim za razumevanje od početka do kraja.

## 5. Arhitektura

Kod prati **strogu slojevitu arhitekturu**, i ta podela se dosledno poštuje kroz ceo projekat — nijedan sloj ne "preskače" onaj direktno ispod sebe.

```
Zahtev (Request)
  → Ruta (Route)         (URL + HTTP metod + povezivanje middleware-a)
  → Middleware            (autentifikacija, dozvole, validacija, rate limiting, CSRF, upload fajlova)
  → Kontroler              (samo req/res — bez poslovne logike, bez pristupa bazi)
  → Servis                  (poslovna logika, transakcije, orkestracija)
  → Repozitorijum            (jedini sloj koji komunicira sa Mongoose/MongoDB)
  → Model                     (Mongoose šeme — samo oblik podataka i pravila na nivou šeme)
       ↓
  → Mapper                     (pretvara "sirove" DB dokumente u objekte bezbedne za klijenta)
  → Presenter                   (sklapa view-model strukture podataka za EJS šablone)
  → View (EJS)                   (čisto renderovanje, bez logike osim petlji/uslova)
```

**Zašto je ova podela ovde konkretno bitna:**
- **Kontroleri** nikada ne pozivaju repozitorijum direktno — svaki kontroler razgovara isključivo sa servisom. To znači da poslovna pravila (npr. "termin se ne može otkazati manje od 24h unapred") postoje na tačno jednom mestu i ne mogu se zaobići preko neke druge ulazne tačke.
- **Repozitorijumi** su jedini fajlovi koji direktno uvoze Mongoose modele. To znači da promena strategije upita, dodavanje populate konstante, ili optimizacija indeksa zahteva izmenu samo jednog fajla po entitetu.
- **Presenteri** su poseban sloj od mapera: mapperi pretvaraju Mongoose dokument u bezbedan, minimalan objekat okrenut ka klijentu (koriste ga i JSON odgovori i view-ovi); presenteri idu korak dalje i oblikuju te podatke specifično za ono što određeni EJS šablon treba da renderuje (labele, grupisane sekcije, definicije polja forme za admin form-builder, itd).
- **Validatori** (`express-validator` lanci) žive isključivo u middleware sloju i nikada ne "cure" u servise — servisnu funkciju je moguće pozvati direktno (npr. iz testa, iz Telegram bota, iz background posla) bez potrebe za ulazom u HTTP formatu.

### Kompozicioni koren (composition root)

`src/app.js` gradi Express aplikaciju sastavljanjem malih, jednonamenskih config modula (`helmet.config.js`, `cors.config.js`, `session.config.js`, `csrf.config.js`, itd) u tačno određenom, namernom redosledu — na primer, parsiranje tela zahteva i Mongo-sanitizacija moraju da se izvrše pre CSRF i session middleware-a. `src/server.js` je stvarna ulazna tačka procesa: povezuje se na MongoDB, pokreće Telegram bota, pokreće HTTP server, i postavlja graceful shutdown (obrada SIGTERM/SIGINT signala sa tajmerom za prinudno gašenje, tako da deploy nikad ne "visi").

### Događaji (events)

Lagan interni event emitter (`src/events/event.emitter.js`) razdvaja "nešto se desilo" od "evo svega što treba da se desi kao posledica toga." Servisi emituju domenske događaje (`appointment:created`, `appointment:status_changed`, `user:guest_created`, `package_purchase:created`, itd) **tek nakon** što se njihova transakcija nad bazom uspešno završi — nikad pre. Dva nezavisna listener modula (`email.listener.js`, `telegram.listener.js`) pretplaćena su na ove događaje i obrađuju posledice u vidu notifikacija, tako da dodavanje novog kanala notifikacija u budućnosti nikad ne zahteva dodirivanje poslovne logike.

### Background poslovi

`src/jobs/email-retry.job.js` ponovo pokušava slanje mejlova koji nisu uspeli, tako da privremeni SMTP problem tiho ne "proguta" potvrdu zakazivanja.

## 6. Model podataka i poslovna logika

### Osnovni entiteti

- **User** — nalog klijenta (može biti stvarno registrovan korisnik, korisnik prijavljen preko Google-a, ili lagani "gost" nalog kreiran transparentno prvi put kada neko zakaže termin bez registracije).
- **Employee** — nalog terapeuta, sa nedeljnim radnim vremenom (`workingHours: [{ day, slots: [{from, to}] }]`) i skupom usluga koje je kvalifikovan da obavlja.
- **Expert** — javni profil člana tima (biografija, fotografija, specijalnosti) prikazan na stranici "Naš tim" — odvojen od `Employee` jer svaki javni profil eksperta ne mora nužno 1:1 da odgovara nalogu zaposlenog koji se može zakazati.
- **Service** — vrsta tretmana (npr. "Terapeutska masaža"), koja sadrži jednu ili više **varijanti** (`packages[]` polje u Service šemi — npr. "30 min" naspram "60 min"), svaka sa sopstvenim trajanjem i cenom.
- **Package** — paket unapred plaćenih seansi kroz jednu ili više varijanti usluga, prodat po povoljnijoj ceni (npr. "10x Medicinski Bio-Reset — 20% popusta").
- **PackagePurchase** — konkretan zapis da je klijent kupio Package: prati `sessionsTotal`, `sessionsUsed` i `sessionsReserved` po stavci.
- **Appointment** — stvarno zakazan termin: usluga + varijanta + zaposleni + vremenski okvir + status + način plaćanja (puna cena / kupon / paket).
- **Coupon** — kuponi za popust sa pravilima korišćenja i praćenjem iskorišćenosti.
- **Role** — imenovan, potpuno na podacima zasnovan skup dozvola (nije fiksni enum — admin može kreirati ulogu sa bilo kojim imenom u slug formatu i dodeliti joj bilo koju kombinaciju dozvola).
- **Post / Category / Tag** — blog i sistem taksonomije, deljen između blog objava i usluga/paketa radi organizacije i filtriranja.
- **Testimonial** — utisci klijenata, moderisani pre objavljivanja, opciono povezani sa nalogom onoga ko je ostavio utisak i sa konkretnom uslugom/paketom koji se ocenjuje.
- **Contact**, **NewsLetter** — poruke sa kontakt forme i pretplatnici na newsletter.

### Tok zakazivanja termina, detaljno

Zakazivanje termina (`appointment.service.js: bookAppointment`) je najbitniji deo poslovne logike u sistemu, i napravljen je da bude ispravan i pod stvarnom konkurencijom (kada više ljudi istovremeno pokušava da zakaže):

1. **Pre nego što bilo koja transakcija počne**, sistem određuje tačnu varijantu usluge koja se zakazuje, proverava da li klijent koji šalje zahtev već ima nalog (preko sesije, ili preko pretrage po mejlu za goste), i — ako se plaća kuponom ili paketom — proverava da li je kupon/paket zaista upotrebljiv *u ovom trenutku* (aktivan, nije istekao, ima preostalih seansi, pripada ovom korisniku).
2. **Sve što mora zajedno da uspe ili propadne dešava se unutar jedne MongoDB transakcije**: kreiranje gost naloga ako je potrebno, poslednja provera (race-guard) da je termin i dalje slobodan (štiti od toga da dvoje ljudi zakažu isti termin u razmaku od par sekundi na osnovu iste "zastarele" liste dostupnosti), upisivanje termina, i — ako se plaća paketom — rezervacija jedne seanse.
3. **Domenski događaji se emituju tek nakon što se transakcija potvrdi (commit)** — tako da klijent nikada ne dobije obaveštenje o zakazivanju koje zapravo nije uspelo.
4. **Načini plaćanja se međusobno isključuju kao poslovno pravilo** (primenjeno u servisnom sloju, ne u šemi): puna cena, puna cena umanjena za kupon, ili u potpunosti pokriveno seansom iz paketa — nikad kombinacija.

### Izračunavanje dostupnosti

`availability.service.js` računa slobodne termine za određenu varijantu usluge i datum koristeći pravu intervalsku aritmetiku:
- polazi od radnog vremena zaposlenog za taj dan u nedelji,
- oduzima svaki postojeći termin kao "zauzet" interval, **uvećan sa obe strane za podesivi buffer** (`booking.config.js`) tako da terapeuti uvek imaju pauzu između klijenata — ne samo "bez doslovnog preklapanja",
- ono što ostane seče na fiksnu vremensku mrežu (npr. na svakih 30 minuta) tako da ponuđena vremena početka uvek budu čista i predvidljiva, nezavisno od toga koliko konkretna usluga traje,
- kada nije zatražen konkretan zaposleni, spaja slobodne termine svih kvalifikovanih zaposlenih po identičnom vremenu početka, tako da klijent vidi "9:00, 9:30, 10:00…" jednom, a ne po jednom za svakog terapeuta.

Ista logika buffera i preklapanja primenjuje se identično i pri upisu (kada se termin zaista kreira) i pri čitanju (kada se termini prikazuju) — tako da ono što klijent vidi kao dostupno zaista bude i prihvaćeno.

### Životni ciklus statusa termina

Jedan izvor istine (`appointment-status-transitions.js`) definiše svaki dozvoljeni prelaz statusa i koja uloga sme da ga izvrši:

```
pending (na čekanju) → confirmed (potvrđen) / rejected (odbijen) / cancelled (otkazan)
confirmed → completed (završen) / no_show (nije se pojavio) / cancelled / rejected
rejected → pending (admin može da vrati)
cancelled → pending (admin može da vrati)
no_show → pending (admin može da vrati)
completed → (terminalno stanje — ništa dalje ne prelazi iz njega)
```

Istu ovu tabelu koriste i server-side validator (da odbije nedozvoljene prelaze) i admin presenter (da prikaže samo one akcione dugmiće koji su zaista dozvoljeni za trenutnu kombinaciju statusa/uloge) — tako da UI i stvarna pravila nikada ne mogu da se razminu.

Knjigovodstvo seansi iz paketa direktno je vezano za ovaj životni ciklus: seansa se *rezerviše* u trenutku kada se napravi termin plaćen paketom, *potvrđuje* (prebacuje iz rezervisano u iskorišćeno) tek kada se termin označi kao `completed`, i *oslobađa* nazad u dostupno ako se termin otkaže, odbije, ili označi kao neodržan pre nego što je ikada isporučen.

### Sistem dozvola

Uloge su u potpunosti zasnovane na podacima. `PERMISSIONS` je fiksni katalog fino-granularnih stringova dozvola (`manage_services`, `manage_packages`, `manage_appointments_all`, `access_admin_panel`, itd), ali same `Role` (uloge) su otvorene — admin može kreirati ulogu sa bilo kojim imenom (validovano kao slug malim slovima) i dodeliti joj bilo koji podskup dozvola. Svaka sekcija admin panela pojedinačno je zaštićena preko `requirePermission("...")`, tako da, na primer, jedna uloga može da upravlja blogom bez mogućnosti da dira termine ili korisničke naloge.

## 7. Bezbednost

Bezbednost je tretirana kao prioritet od početka, ne kao naknadna dopuna:

- **CSRF**: synchronizer-token pattern (`csrf-sync`), primenjen na svaki zahtev koji menja stanje, sa ispravno obrađenim izuzetkom za rute sa upload-om fajlova (CSRF se ponovo primenjuje odmah **nakon** što Multer parsira telo zahteva, na baš svakoj admin ruti koja prihvata upload fajla).
- **Rate limiting**: ne jedan opšti limiter — desetak nezavisno podešenih limitera (prijava: 5/15min, registracija: 3/sat, reset lozinke: 3/sat, kontakt forma: 1/min, zakazivanje: 5/min, admin panel: 300/min, itd), tako da napadač koji "bombarduje" formu za prijavu nema isti budžet kao običan korisnik koji pregleda usluge.
- **Bezbednost sesija**: sesije se čuvaju u MongoDB (ne u memoriji — preživljavaju restart servera i skaliraju horizontalno), `httpOnly` + `sameSite: lax` kolačići, `secure` kolačići obavezni u produkciji.
- **Headeri**: `helmet` plus ručno pisana Content-Security-Policy podešena za tačno određene treće strane koje se zaista koriste (Google prijava, Google Maps embed, Cloudflare), umesto permisivnog podrazumevanog podešavanja; HSTS primenjen u produkciji preko HTTPS-a.
- **NoSQL injekcija**: telo svakog zahteva, query parametri i URL parametri se rekurzivno sanitizuju protiv Mongo operator injekcije (`$`, `.` u ključevima), sa eksplicitnom listom izuzetaka za polja kao što su email/lozinka gde bi sanitizacija oštetila legitiman unos.
- **Lozinke**: heširane pomoću `bcryptjs`, nikada se ne čuvaju niti loguju u čistom tekstu.
- **Kontrola pristupa**: svaka sekcija admin panela pojedinačno je zaštićena dozvolom (videti gore), i svako čitanje vezano za termin/korisnika proverava da li onaj ko postavlja zahtev zaista poseduje ili ima ovlašćenje da vidi baš taj zapis (`canAccessAppointment` — admini vide sve, zaposleni vide samo ono što im je dodeljeno, klijenti vide samo svoje).

## 8. Notifikacije i integracije

- **Email** (`nodemailer` + SMTP): transakcioni mejlovi za potvrdu naloga, reset lozinke, zakazan/potvrđen/otkazan/promenjen termin, kreiran/otkazan paket, dobrodošlica na newsletter/kampanja — svi izgrađeni iz zajedničkog EJS layout-a radi doslednog brendiranja, i pokretani istim domenskim događajima kao i ostatak sistema (ne pozivaju se proizvoljno iz kontrolera).
- **Telegram** (`telegraf`): bot šalje interne operativne notifikacije (novi termin, nova kontakt poruka, novi utisak koji čeka odobrenje) u određene teme (threads) u chat-u, tako da tim studija dobija informaciju u realnom vremenu bez potrebe da se prijavljuje u admin panel.
- **Google OAuth**: opciona prijava/registracija preko Google naloga, uz standardnu registraciju mejlom i lozinkom.
- **Job za ponovno slanje neuspelih mejlova**: background posao ponovo pokušava slanje transakcionih mejlova koji nisu uspeli, tako da privremeni prekid SMTP servisa tiho ne "proguta" potvrdu zakazivanja.

## 9. SEO

Svaki tip javne stranice — početna, usluga, paket, blog objava, kategorija, tag, profil eksperta, statične stranice — izgrađen je pomoću posebnog SEO "buildera" (`src/seo/builders/`) koji generiše dosledan `<title>`, meta opis, kanonski URL i Open Graph tagove, plus servis za sitemap (`sitemap.service.js`). Ovo je izuzetno bitno za lokalni biznis koji zavisi od organske pretrage za privlačenje novih klijenata — svaki od 10+ pojedinačnih tretmana i paketa studija je nezavisno indeksabilan i deljiv.

## 10. Testiranje

Projekat ima zaista sveobuhvatan automatizovan test suite, podeljen na dve vrste:

- **Unit testovi** — servisi, validatori i pomoćne funkcije testirani izolovano.
- **Integracioni testovi** — pravi HTTP zahtevi ka kompletnoj Express aplikaciji (preko `supertest`-a) protiv izolovane in-memory MongoDB instance (`mongodb-memory-server`), koji pokrivaju kompletne cikluse zahtev/odgovor uključujući CSRF ponašanje, plus direktni testovi na nivou repozitorijuma protiv iste in-memory baze.

**Poslednje pokretanje kompletnog test suite-a:**

```
tests 798
suites 322
pass 798
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 28216.271317
```

**798 testova kroz 322 test grupe (suites), 100% prolazi, za oko 28.2 sekunde.** Pokrivenost obuhvata svaku poslovno-kritičnu putanju: transakciju zakazivanja i njene "race" uslove, ceo životni ciklus rezervacije/potvrđivanja/oslobađanja seansi iz paketa, iskorišćavanje kupona, kompletnu mašinu stanja statusa termina, svaki validator, svaki upit u repozitorijumu, i pune HTTP regresione testove specifično za CSRF ponašanje (`csrf-regression.http.test.js`) — što znači da bezbednosno relevantno ponašanje nije samo implementirano, već se kontinuirano proverava.

### Detaljan pregled pokrivenosti (coverage)

Ugrađeni Node.js test-runner izveštaj o pokrivenosti pokazuje ukupnu **72.62% pokrivenost linija / 68.22% grana (branch) / 69.10% funkcija**, ali ovaj zbirni broj sakriva gde pokrivenost zapravo najviše znači. Po slojevima:

| Sloj | Tipična pokrivenost | Napomena |
|---|---|---|
| **Validatori** | ~95–100% linija | Skoro svaki validator (`appointment`, `booking`, `category`, `contact`, `coupon`, `employee`, `expert`, `media`, `newsletter`, `package-purchase`, `role`, `search`, `spam`, `tag`, `testimonial`, `user`) je na 100% pokrivenosti linija — svako pravilo validacije ulaza je testirano. |
| **Modeli** | ~100% linija | Svaka Mongoose šema, uključujući sve deljene pod-šeme (`image`, `video`, `faq`, `phone`, `service-feature`, `service-package`, `comparison-row`), potpuno pokrivena. |
| **Rute** | 100% linija svuda | Svaki fajl rute, i admin i javne, potpuno pokriven — povezivanje ruta i redosled middleware-a testirani su end-to-end kroz HTTP integracioni suite. |
| **Repozitorijumi** | ~85–100% linija | Sloj za pristup podacima — jedini sloj kome je dozvoljeno da razgovara sa Mongoose-om — vrlo je temeljno testiran; par filter helpera je nešto niže (70–90%) na ređe korišćenim kombinacijama filtera. |
| **Servisi** | ~75–98% linija | Sloj poslovne logike je dosledno dobro pokriven — `availability.service.js` (97.9%), `appointment.service.js` (90.2%), `package-purchase.service.js` (94.2%), `coupon.service.js` (95.7%), `service.service.js` (97.8%) su svi visoko, što odražava nameran fokus na to da logika zakazivanja/paketa/kupona bude ispravna. `sitemap.service.js` (37.5%) je jedini jasan izuzetak — testiran znatno manje od ostalih. |
| **Config** | ~55–100% linija | Većina config modula (booking, cors, csrf, flash, sanitize, session, view-engine) je na ili blizu 100%; `logger.config.js` i `morgan.config.js` su niži, jer je veliki deo njihovog koda formatiranje loga/transport grane koje se izvršavaju samo pod specifičnim runtime uslovima, a ne u tipičnom toku zahteva. |
| **Kontroleri / Presenteri** | ~15–75% linija | Dosledno najniži brojevi u izveštaju, i to je i očekivano — kontroleri su namerno "tanki" (req/res provodnik koji poziva servis), i velik deo njihove logike već je indirektno pokriven kroz HTTP integracioni suite, a ne kroz izolovane unit testove; nekoliko admin presentera (dashboard, media-form, profile, package-purchase) pokazuje vrlo nisku izolovanu pokrivenost jer su to jednostavni sklopivi view-modeli čija se ispravnost zapravo proverava kroz renderovanje, a ne testiranjem svake grane posebno. |
| **SEO builderi** | ~9–23% linija | Najmanje pokrivena oblast u kodu — pojedinačni SEO builderi po tipu stranice (`category`, `expert`, `page`, `post`, `service`, `tag`) uglavnom nisu testirani izolovano, iako je sam `seo/index.js` (zajednička ulazna tačka) na 95%. Ovo je poznat, nisko-rizičan propust jer su builderi čiste, jednostavne funkcije za formatiranje stringova. |

**Iskreno tumačenje:** delovi sistema gde bi bag zaista koštao novca ili napravio problem sa integritetom podataka — transakcija zakazivanja, životni ciklus seansi iz paketa, iskorišćavanje kupona, provere dozvola, validatori i sloj za pristup podacima — pokriveni su sa 85–100%. Niži brojevi se gotovo u potpunosti grupišu u "tankim" slojevima (kontroleri, presenteri, SEO builderi) gde je rizik od netestirane grane kozmetički ili SEO problem, a ne problem poslovne logike.

## 11. Struktura projekta

Kompletan izgled repozitorijuma (upload-ovani medijski fajlovi pod `public/images` i `public/videos` izostavljeni radi preglednosti — to je korisnički sadržaj, ne deo koda):

```
.
├── logs                                    # Log fajlovi iz rada aplikacije (pino/morgan izlaz — videti §14 za planiran rad na upravljanju logovima)
│   ├── app-dev.log
│   ├── error-dev.log
│   └── http-dev.log
├── package.json
├── package-lock.json
├── src
│   ├── app.js                              # Sastavljanje Express aplikacije (redosled middleware-a)
│   ├── server.js                           # Ulazna tačka procesa (konekcija na bazu, listen, graceful shutdown)
│   ├── config                              # Po jedan fajl za svaku cross-cutting brigu
│   │   ├── booking.config.js, cors.config.js, csrf.config.js, flash.config.js
│   │   ├── helmet.config.js, locals.config.js, logger.config.js
│   │   ├── method-override.config.js, morgan.config.js, multer.config.js
│   │   ├── sanitize.config.js, session.config.js, static.config.js, view-engine.config.js
│   ├── controllers/web                     # "Tanki" req/res handleri, prate strukturu domena
│   │   ├── admin/{appointment, auth/{employee,expert,role,user}, blog/post,
│   │   │         catalog/{package,package-purchase,service}, dashboard,
│   │   │         marketing/{contact,coupon,news-letter,testimonial},
│   │   │         profile, taxonomy/{category,tag}}.controller.js
│   │   ├── auth/auth.controller.js, blog/blog.controller.js
│   │   ├── catalog/{package,service}.controller.js, employee/employee.controller.js
│   │   ├── index.controller.js, public/{booking,expert}.controller.js
│   │   └── seo.controller.js, user/user.controller.js
│   ├── database/seeds                      # Seed skripte (uloge, početni ESMA katalog)
│   │   ├── esma-catalog.seed.js, roles.seed.js
│   │   └── run-esma-seed.js, run-roles-seed.js
│   ├── events
│   │   ├── event.emitter.js
│   │   └── listeners/{email,email-fail,telegram}.listener.js, index.js
│   ├── integrations
│   │   ├── email/email.provider.js
│   │   └── telegram/{telegram.config,telegram.provider}.js
│   ├── jobs
│   │   └── email-retry.job.js
│   ├── mappers                              # Oblikovanje DB dokumenata u objekte bezbedne za klijenta (po jedan po entitetu)
│   │   ├── appointment.mapper.js  ├── category.mapper.js     ├── contact.mapper.js
│   │   ├── coupon.mapper.js       ├── employee.mapper.js     ├── expert.mapper.js
│   │   ├── news-letter.mapper.js  ├── package.mapper.js      ├── package-purchase.mapper.js
│   │   ├── post.mapper.js         ├── role.mapper.js         ├── service.mapper.js
│   │   ├── tag.mapper.js          ├── testimonial.mapper.js  └── user.mapper.js
│   ├── middlewares
│   │   ├── admin.middleware.js, auth.middleware.js, employee.middleware.js
│   │   ├── error.middleware.js, parse-json-fields.middleware.js
│   │   ├── permission.middleware.js, rate-limiter.middleware.js
│   │   ├── sanitize-array-fields.middleware.js
│   │   └── validators/                      # Po jedan fajl lanca validacije po entitetu + helpers/
│   ├── models
│   │   ├── appointment.model.js, appointment-status-transitions.js
│   │   ├── category.model.js, contact.model.js, coupon.model.js
│   │   ├── employee.model.js, expert.model.js, news-letter.model.js
│   │   ├── package.model.js, package-purchase.model.js, post.model.js
│   │   ├── role.model.js, service.model.js, tag.model.js
│   │   ├── testimonial.model.js, user.model.js
│   │   └── schemas/                         # Deljene pod-šeme: image, video, faq, phone, service-feature, service-package, comparison-row
│   ├── presenters                           # Sklapanje view-model podataka, prati strukturu kontrolera
│   │   ├── admin/{appointment,auth,blog,catalog,marketing,taxonomy}/...
│   │   ├── admin/{dashboard,media-form,profile}.presenter.js
│   │   ├── auth/auth.presenter.js, blog/blog.presenter.js
│   │   ├── catalog/{package,service}.presenter.js, employee/employee.presenter.js
│   │   ├── public/{booking,expert,index}.presenter.js
│   │   └── user/user.presenter.js
│   ├── public                               # Client-side statički resursi
│   │   ├── css/{styles,variables}.css
│   │   ├── favicon.ico, icons/, site.webmanifest
│   │   ├── images/{categories,experts,packages,posts,services,site,testimonials}/  (upload-ovani medijski sadržaj — izostavljeno)
│   │   ├── js/{admin-comparison-table,admin-content-blocks,admin-multiselect,admin-repeater,admin-schedule,admin-select-preview,main}.js
│   │   ├── json/, pdf/
│   │   └── videos/{category,our-service,package,post,site,thumbnails}/  (upload-ovani medijski sadržaj — izostavljeno)
│   ├── repositories                         # Jedini sloj koji dodiruje Mongoose direktno
│   │   ├── appointment.repository.js  ├── category.repository.js  ├── contact.repository.js
│   │   ├── coupon.repository.js       ├── employee.repository.js  ├── expert.repository.js
│   │   ├── news-letter.repository.js  ├── package.repository.js   ├── package-purchase.repository.js
│   │   ├── post.repository.js         ├── role.repository.js      ├── service.repository.js
│   │   ├── tag.repository.js          ├── testimonial.repository.js ├── user.repository.js
│   │   └── filters/                         # Po jedan fajl za građenje filtera po entitetu
│   ├── routes
│   │   ├── index.routes.js
│   │   └── web/
│   │       ├── admin.routes.js
│   │       ├── admin/                       # Po jedan fajl rute za svaku admin sekciju (16 fajlova)
│   │       ├── auth.routes.js, blog.routes.js, booking.routes.js
│   │       ├── employee.routes.js, package.routes.js, service.routes.js
│   │       └── team.routes.js, user.routes.js, web.routes.js
│   ├── seo
│   │   ├── builders/{category,expert,page,post,service,tag}.builder.js
│   │   ├── index.js, utils.seo.js
│   ├── services                             # Sva poslovna logika i orkestracija
│   │   ├── appointment.service.js  ├── auth.service.js       ├── availability.service.js
│   │   ├── blog.service.js         ├── category.service.js   ├── contact.service.js
│   │   ├── coupon.service.js       ├── crypto.service.js     ├── email.service.js
│   │   ├── employee.service.js     ├── expert.service.js     ├── index.service.js
│   │   ├── news-letter.service.js  ├── package.service.js    ├── package-purchase.service.js
│   │   ├── post.service.js         ├── role.service.js       ├── service.service.js
│   │   ├── sitemap.service.js      ├── tag.service.js        ├── telegram.service.js
│   │   ├── testimonial.service.js  └── user.service.js
│   ├── utils
│   │   ├── date.time.util.js, encrypted-field.util.js, error.util.js
│   │   ├── flash.util.js, form-bool.util.js, logger.util.js
│   │   ├── media-form.util.js, pagination.util.js, phone.util.js
│   │   └── slug.util.js, telegram-message.util.js
│   └── views                                # EJS šabloni
│       ├── admin/{components/, dashboard.ejs, _details.ejs, _form.ejs, _list.ejs, _media-form.ejs, post/seo.ejs, services/seo.ejs}
│       ├── auth/_auth-form.ejs
│       ├── blog/{blog,post-details}.ejs
│       ├── booking/{confirmation,contact-step,service-step,slots-step}.ejs
│       ├── emails/                          # 17 šablona transakcionih mejlova + _layout.ejs
│       ├── employee/{appointment-details,appointments,dashboard,profile}.ejs
│       ├── error/error.ejs
│       ├── includes/{breadcrumbs,flash-messages,footer,head,navigation,pagination}.ejs + components/
│       ├── landing/{expert-details,home,team}.ejs
│       ├── public/_page.ejs
│       ├── services/{package-details,packages,service-details,services}.ejs
│       └── user/{appointment-details,_appointment-tab,profile,_settings-tab}.ejs
└── test
    ├── helpers/{csrf,factories,pagination,session,upload,validator-harness}.js
    ├── integration
    │   ├── http/                            # 23 fajla sa punim HTTP tokovima (admin + javno + auth + zakazivanje + CSRF regresija)
    │   ├── repositories/                    # 14 fajlova testova na nivou repozitorijuma (po jedan po entitetu)
    │   └── setup/{db-handler,test-app}.js
    └── unit
        ├── services/                        # 20 fajlova testova servisa
        ├── utils/form-bool.util.test.js
        └── validators/                       # 17 fajlova testova validatora

105 direktorijuma, 470 fajlova
```

## 12. Environment promenljive

| Promenljiva | Namena |
|---|---|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | HTTP port |
| `MONGO_URI` | Connection string za MongoDB |
| `SESSION_SECRET` | Tajni ključ za potpisivanje session kolačića |
| `JWT_SECRET` | Tajni ključ za stateless tokene (npr. linkovi za reset lozinke) |
| `AES_SECRET` | Ključ za enkripciju enkriptovanih polja |
| `SITE_NAME` | Ime brenda korišćeno u mejlovima/SEO podrazumevanoj vrednosti |
| `BASE_URL` | Javni bazni URL, korišćen u mejlovima i kanonskim linkovima |
| `ADMIN_EMAIL`, `SUPPORT_EMAIL` | Interne/notifikacione adrese |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Identitet pošiljaoca odlaznih mejlova |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Podešavanje SMTP transporta |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth prijava |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Kredencijali Telegram bota |
| `TELEGRAM_APPOINTMENTS_THREAD`, `TELEGRAM_CONTACTS_THREAD`, `TELEGRAM_TESTIMONIALS_THREAD`, `TELEGRAM_USERS_THREAD`, `TELEGRAM_ERRORS_THREAD` | Teme (threads) u Telegram chatu po vrsti notifikacije |
| `UPLOAD_PUBLIC_PATH` | Javni path prefiks za upload-ovan medijski sadržaj |
| `LOG_LEVEL` | Nivo detaljnosti Pino logovanja |

## 13. Pokretanje projekta

```bash
# Instalacija zavisnosti
npm install

# Razvojno okruženje (automatski restart pri izmeni)
npm run start-dev

# Produkcija
npm start

# Pokretanje kompletnog test suite-a
npm test

# Watch mod
npm run test:watch

# Sa merenjem pokrivenosti (coverage)
npm run test:coverage
```

Seed skripte se nalaze u `src/database/seeds/` i služe za inicijalno popunjavanje uloga i početnog kataloga usluga/paketa na svežoj bazi podataka.

## 14. Filozofija dizajna i naučene lekcije

Nekoliko principa se namerno dosledno poštuje kroz ceo projekat, i vredi ih eksplicitno navesti jer objašnjavaju *zašto* kod izgleda ovako kako izgleda:

- **Kontroleri su namerno "dosadni".** Ako kontroler radi bilo šta više od provere da se zahtev desio i poziva servisa, ta logika je na pogrešnom mestu.
- **Jedan izvor istine po pravilu.** Prelazi statusa, dozvole i buffer za zakazivanje svaki žive na tačno jednom mestu (config/konstanta), koje se koristi svuda gde je potrebno — nikad se ne redeklarišu.
- **Doslednost populate poziva je bitna.** Svako referentno polje u Mongoose šemi ima jednu deljenu populate konstantu po entitetu, primenjenu dosledno kroz svaku putanju čitanja — nedostajući `.populate()` na samo jednom upitu je klasičan uzrok bagova tipa "zašto je ovo polje prazno ovde a nije tamo", i ovaj kod to izbegava tako što nikada ne dozvoljava da se populate liste razlikuju od upita do upita.
- **Test fixture-i potiču iz istog izvora kao i produkcioni kod**, ne iz odvojeno održavanih seed podataka — npr. test helperi računaju admin dozvole direktno iz `PERMISSIONS` kataloga u Role modelu, tako da nova dozvola dodata u produkcioni kod automatski bude pokrivena testovima, umesto da tiho ostane netestirana.
- **Događaji, ne direktni pozivi, za sporedne efekte.** Logika notifikacija (email, Telegram) u potpunosti je odvojena od poslovne logike preko event emitera, tako da poslovni servisi ostaju fokusirani isključivo na poslovna pravila.

## 15. Plan daljeg razvoja

- ~~Editor rasporeda za zaposlene~~ — **završeno.** Za `workingHours` je ranije bio potreban sirov JSON unos; sada je to pravi vizuelni editor po danima (dodavanje/uklanjanje redova sa vremenskim opsezima po danu u nedelji, native time picker-i, "Neradni dan" prikazano za dane bez termina), napravljen jednom kao deljeni widget (`admin-schedule.js`) i korišćen na **oba** mesta gde je potreban: u admin formi za upravljanje zaposlenima (`PUT /admin/zaposleni/:employeeId/radno-vreme`) i na profilnoj stranici zaposlenog za samostalno uređivanje (`POST /moj-nalog/profil/radno-vreme`). Ista komponenta, ista validacija (`validateWorkingHoursUpdate`), isti poziv `employeeService.manageWorkingHours()` u pozadini — admin koji menja raspored terapeuta i terapeut koji menja sopstveni raspored prolaze kroz identičnu logiku iz jednog izvora.
- Dalje proširenje admin form/wizard sistema kako se dodaju novi tipovi sadržaja.
- Popunjavanje javne stranice "Naš tim" i bloga stvarnim sadržajem, sada kada je osnovni CMS kompletiran.
- **Analitika logova i upravljanje životnim ciklusom logova (planirano).** Aplikacija trenutno piše strukturirane logove (`pino`) i logove HTTP pristupa (`morgan`) direktno na disk u `logs/` (`app-dev.log`, `error-dev.log`, `http-dev.log`), bez ikakve rotacije, arhiviranja ili izveštavanja nad njima. Planiran rad:
  - Periodičan (npr. dnevni/nedeljni) posao koji parsira nagomilane logove i generiše **PDF izveštaj sa rezimeom** — procenat grešaka, spori zahtevi, značajna upozorenja — i automatski ga šalje mejlom, tako da problemi izlaze na videlo proaktivno umesto da neko mora ručno da čita sirove log fajlove.
  - **Rotacija logova**, tako da log fajlovi ne rastu neograničeno na disku (rotacija zasnovana na veličini i/ili vremenu, npr. preko `pino`-ovog rotirajućeg transporta ili posebnog alata za rotaciju).
  - Strategija čuvanja/arhiviranja rotiranih logova — verovatno kompresovanje i premeštanje u "hladno" skladište (npr. cloud object storage) nakon određenog perioda — tako da istorijski logovi ostanu dostupni za reviziju bez trajnog trošenja prostora na produkcionom disku.
  - Ovo zatvara stvaran, trenutno postojeći nedostatak: danas, dijagnostikovanje problema u produkciji znači da se neko mora ulogovati preko SSH-a i ručno pretraživati sirove log fajlove pomoću grep-a, bez automatskog čišćenja, automatskog rezimiranja ili plana dugoročnog čuvanja.

---

*Ovaj dokument opisuje sistem prema trenutnom stanju `main` grane. Za detaljan opis na engleskom jeziku, pogledati `README.md`.*
