# E2E Tutorijali

Ovaj folder generiše korak-po-korak tutorijale (markdown + screenshotovi) direktno
iz pravih Playwright E2E scenarija koji voze pravu (headless) browser sesiju protiv
prave aplikacije (in-memory Mongo, kao i `test/e2e`). Namerno **odvojeno** od
`test/e2e` i `test/`:

- `npm test` i `npm run test:e2e`-tipa komande ga nikad ne pokupe (poseban `testDir`, poseban `playwright.tutorials.config.js`)
- sporiji je (screenshot posle svakog koraka) i produkuje artefakte (slike, `.md`) koje ne želimo u CI test-results-u
- "izvor istine" je i dalje pravi kod aplikacije - ako se UI promeni i scenario i dalje prođe, tutorijal ostaje tačan; ako scenario pukne, znaš odmah da je tutorijal zastareo

## Kako radi (redosled)

1. **`scenario.spec.js`** - normalan Playwright test, ali umesto `test.step(id, fn)`
   koristi `tut.step(id, fn)` (iz `scripts/tutorial.fixture.js`). Isto ponašanje
   plus: posle svakog koraka automatski se snima full-page screenshot i upisuje
   red u `manifest.json`.
2. **`manifest.json`** - generiše se automatski pri svakom pokretanju scenarija.
   Nikad se ne uređuje ručno, uvek se prepisuje.
3. **`narration.json`** - **ručno pisan** tekst objašnjenja za svaki `id` koraka,
   na srpskom i engleskom. Ovo je jedino mesto gde se piše proza.
4. **`scripts/build-docs.mjs`** - spaja `manifest.json` + `narration.json` →
   `generated/sr/<scenario>.md` i `generated/en/<scenario>.md`, sa slikama ubačenim
   inline.

```
e2e-tutorials/
  scenarios/
    <scenario-id>/
      scenario.spec.js   # test, piše se ručno
      narration.json     # tekst po koraku (sr/en), piše se ručno
      manifest.json       # generiše se automatski (git-ignored)
  screenshots/
    <scenario-id>/        # generiše se automatski (git-ignored)
  generated/
    sr/<scenario-id>.md   # generiše se automatski
    en/<scenario-id>.md   # generiše se automatski
  scripts/
    tutorial.fixture.js
    build-docs.mjs
```

## Titlovi i spojen video

Svaki `tut.step()` beleži u `manifest.json` i **koji video** korak pripada
(`video`, npr. `"full-flow"` ili `"admin-flow"` - vidi `newRecordedContext`) i
**u kom trenutku** tog videa se korak dogodio (`videoOffsetMs`, milisekunde od
početka SNIMANJA tog konkretnog `.webm`-a, ne od početka testa). Ovaj timestamp
se hvata na SAMOM POČETKU koraka (pre nego što se izvrši ijedna akcija), ne posle
- `waitForLoadState("networkidle")` ume da čeka i do 3s na stranicama koje u
pozadini stalno nešto pingaju, pa bi merenje posle njega davalo neprecizne,
promenljivo kasne timestamp-ove; merenjem na početku, trajanje titla za korak N
prirodno pokriva ceo taj korak (akcija + čekanje + pauza), ne zavisi od toga
koliko je konkretno „networkidle" čekanje potrajalo.

- **`npm run tutorials:subtitles`** (deo i glavnog `npm run tutorials` lanca) -
  generiše WebVTT titl fajlove: `videos/<scenario>/<video-label>.<lang>.vtt`
  (npr. `full-flow.sr.vtt`, `admin-flow.en.vtt`). `build-docs.mjs` ih automatski
  ubacuje kao `<track>` u `<video>` tag u generisanom `.md`-u - u pregledaču koji
  podržava HTML5 `<track>` (VS Code markdown preview, browser), titlovi se
  pojavljuju sami, sinhronizovano.
- **`npm run tutorials:merge`** (poseban korak, NE ulazi u glavni `tutorials`
  lanac jer zahteva `ffmpeg`/`ffprobe` na sistemu - ako ih nemaš,
  `sudo apt install ffmpeg` instalira oba odjednom) - spaja SVE video fajlove
  jednog scenarija (npr. `full-flow.webm` + `admin-flow.webm`) u jedan
  `videos/<scenario>/merged.webm`, u PRAVOM hronološkom redosledu kojim su se
  akteri smenjivali (ne "sav customer video pa sav admin video" - ako se akteri
  smenjuju više puta, npr. klijent → admin → klijent opet, kao u
  `dostava-velikog-artikla`, video se seče na segmente po tačnom trenutku
  smene i spaja tim redom). Uz to generiše `merged.sr.vtt` / `merged.en.vtt` sa
  vremenima svakog segmenta pomerenim na svoje mesto na spojenoj vremenskoj
  liniji - izračunato preko `ffprobe`, ne pretpostavkom.
  - Ako je `merged.webm` prisutan, `build-docs.mjs` ga prioritizuje - prikazuje
    SAMO njega (sa spojenim titlom) umesto liste pojedinačnih snimaka. Pokreni
    `tutorials:merge` PRE `tutorials:build` da bi to zaista i uhvatio u `.md`.
  - Redosled koraka: `tutorials:run` → (opciono) `tutorials:merge` →
    `tutorials:build`. Ako preskočiš `merge`, build i dalje radi normalno - samo
    prikazuje pojedinačne video fajlove kao do sada.
  - Svaki `npm run tutorials:run` briše prethodni `merged.webm`/`merged.*.vtt` za
    taj scenario (videti `tutorial.fixture.js`) - da se slučajno ne zadrži
    zastareo spojen video koji se više ne poklapa sa svežim snimcima ako
    zaboraviš da ponovo pokreneš `merge`.

## Video

Pored screenshotova po koraku, svaka `page` sesija se automatski snima kao video
(`.webm`, preko Playwright-ovog `recordVideo`) i završava u `videos/<scenario-id>/full-flow.webm`.
Za scenarije sa drugim akterom u posebnom browser kontekstu (npr. admin), koristi
`newRecordedContext(browser, scenarioId, "admin-flow")` iz `tutorial.fixture.js`
umesto golog `browser.newContext()` - videti `zakazivanje-termina/scenario.spec.js`
kao primer. Video se ubacuje u generisani `.md` preko `<video>` tag-a (radi u VS
Code markdown pregledu i većini static-site generatora; **ne** radi na GitHub-u za
lokalne fajlove - ako tutorijali treba da se gledaju na GitHub-u, videe treba
hostovati negde spolja, npr. na samom sajtu ili YouTube/Drive, i zameniti src).

`videos/` (baš kao `screenshots/`) je **git-ignorisan** - fajlovi su preveliki i
prosto se regenerišu na sledećem `npm run tutorials`. Ako je cilj da se tutorijal
stvarno isporuči nekome (klijent, sajam), export-uj `generated/` + `videos/` +
`screenshots/` zajedno kao paket, van git repozitorijuma.

## Tempo i "prirodno" kucanje

- **Brzina.** `playwright.tutorials.config.js` postavlja `launchOptions.slowMo`
  (podrazumevano 400ms po Playwright akciji - klik, fill, navigacija). Podesivo
  preko `E2E_TUTORIAL_SLOWMO_MS` env varijable za brz eksperiment bez menjanja
  fajla. Uz to, `tutorial.fixture.js` pravi pauzu (`STEP_PAUSE_MS`, podrazumevano
  2.5s) posle svakog koraka, da video zastane na rezultatu pre nego što krene
  sledeći korak - bez ovoga, korak koji je samo jedan klik prolazi kao trep u
  videu bez obzira na slowMo.
- **"Poskakivanje" teksta.** Playwright `.fill()` upisuje vrednost trenutno, bez
  ijednog frejma kucanja - u videu tekst prosto "iskoči" u polje. Za polja koja
  su vizuelno bitna (email, telefon, kod kupona...), koristi `typeSlowly(locator, text)`
  iz `tutorial.fixture.js` umesto `.fill()` - kuca slovo po slovo.
  - Pošto su `registerAndLoginViaUI`, `fillCheckoutContactAndAddress` i
    `setEmployeeWorkingHoursViaUI` deljeni helperi iz `test/e2e/helpers/e2e-helpers.js`
    (koje koristi i pravi regresioni test suite, gde brzina jeste bitna),
    **ne diraju se** - umesto toga `e2e-tutorials/scripts/slow-actions.js` ima
    tutorial-only "Slowly" varijante (`registerAndLoginViaUISlowly` itd.) koje
    rade isto, samo kucaju. Ako se pravi helper promeni (novo polje, izmenjen
    selektor), ažuriraj i odgovarajuću "Slowly" verziju ručno.

## Kvalitet videa

Rezolucija je jedini realan "kvalitet" lever koji Playwright nudi - frame rate i
bitrate se ne mogu podesiti preko API-ja. `VIDEO_SIZE` u `tutorial.fixture.js`
(izvor istine, uvezen i u `playwright.tutorials.config.js`) je podignut na
1920×1080. `use.viewport` u configu MORA da se poklopi sa `VIDEO_SIZE` - ako se
razlikuju, Chromium renderuje u jednoj veličini a Playwright-ov snimač skalira u
drugu, što pravi mutan video (tačno taj bag je postojao pre ove izmene).

Ako ni to nije dovoljno oštro - Playwright-ovo ugrađeno snimanje ima tvrd plafon.
Za stvarno profesionalan kvalitet (viši FPS, kontrola bitrate-a, eventualno
zumiranje/isticanje kursora u post-produkciji) bilo bi potrebno snimanje ekrana
spolja (OBS i sl.) dok se test pušta u `--headed` modu, umesto Playwright-ovog
`recordVideo` - veća promena, javi ako je to zapravo cilj pa napravimo taj put.

## Ceo postupak: od snimanja do gotovog videa sa titlovima

Jedna komanda radi sve redom (traje dugo - pusti je preko noći):

```bash
npm run tutorials:all                          # sve, 6 koraka, na kraju ispiše koliko je koji trajao
npm run tutorials:all -- --only kupovina       # samo scenariji čije ime sadrži "kupovina" (regex), pa ceo ostatak postupka
npm run tutorials:all -- --skip-record         # bez snimanja (koraci 2-6), kad menjaš samo tekst ili veličinu titla
```

Scenario koji pukne **ne zaustavlja** postupak: ostalo se obradi i objavi, a na kraju dobiješ spisak pukih i izlazni kod 1.

To su, redom, ovi koraci (svaki se može pokrenuti i zasebno):

| # | Komanda | Šta radi | Šta nastaje |
|---|---------|----------|-------------|
| 1 | `npm run tutorials:run` | Playwright odvrti svaki `scenario.spec.js` u pravom browseru (računar 1920x1080, telefon 390x844) protiv aplikacije sa in-memory bazom. Posle svakog koraka pravi screenshot i beleži trenutak u videu. | `screenshots/<id>/`, `videos/<id>/full-flow.webm` (+ `admin-flow.webm`), `scenarios/<id>/manifest.json` |
| 2 | `npm run tutorials:subtitles` | Spaja `manifest.json` sa tekstom iz `narration.json` (+ `common-narration.json`) u titl fajlove po snimku. | `videos/<id>/<snimak>.sr.vtt` / `.en.vtt` |
| 3 | `npm run tutorials:merge` | Spaja snimke svih aktera (klijent, admin) u jedan video u pravom hronološkom redosledu (30 fps) i pravi titl za spojeni video. Traži `ffmpeg` i `ffprobe`. | `videos/<id>/merged.webm`, `merged.sr.vtt`, `merged.en.vtt` |
| 4 | `npm run tutorials:burn` | Zapeče titlove u sliku (H.264, 30 fps), posebno za srpski i za engleski. Telefonski videi se udvostruče po rezoluciji i titlovi idu u crnu traku ispod ekrana telefona. | `videos/<id>/merged.sr.burned.mp4`, `merged.en.burned.mp4` |
| 5 | `npm run tutorials:build` | Pravi markdown uputstvo sa slikama i videom (zapečen > spojen > pojedinačni). | `generated/sr/<id>.md`, `generated/en/<id>.md` |
| 6 | `npm run tutorials:publish` | Kopira **samo gotove zapečene videe** (+ poster sličicu i `manifest.json`) u folder koji aplikacija servira kroz rute sa kontrolom pristupa. | `storage/tutorials/` |

`npm run tutorials` (bez `:all`) radi samo korake 1, 2 i 5. `npm run tutorials:finish` radi korake 2 do 6.

### Uputstva u aplikaciji (`/uputstva`)

Koraci 6 puni folder `storage/tutorials` (ili `TUTORIALS_DIR` iz `.env`, isti folder čita i aplikacija). Folder je **namerno van `src/public`**: `express.static` bi svaki fajl dao svakome ko pogodi adresu. Zato se videi šalju samo kroz rute `/uputstva/video/...` i `/uputstva/poster/...` koje za svaki fajl proveravaju ko gleda (`src/services/tutorial-video.service.js`).

Ko šta vidi određuje `e2e-tutorials/audience.json` (ime scenarija -> `public | user | partner | employee | admin`):

| Posetilac | Vidi |
|-----------|------|
| gost | `public` |
| prijavljen korisnik | `public` + `user` |
| partner | `public` + `user` + `partner` |
| zaposleni | `public` + `user` + `employee` |
| administrator (`access_admin_panel`) | sve |

Scenario koji nije naveden u `audience.json` objavi se kao `admin` (najstrože) uz upozorenje. Novi scenario = jedan red u tom fajlu. Na produkciji `TUTORIALS_DIR` treba da pokazuje na trajni disk koji preživljava deploy; videe generišeš lokalno i preneseš taj folder.

**Treptanje i skakanje slike na telefonu.** Uzroci su rešeni u kodu: (1) screenshot cele stranice na telefonu je privremeno menjao raspored stranice usred snimanja, pa je sada na telefonu screenshot samo vidljivog ekrana (`E2E_TUTORIAL_FULLPAGE_MOBILE=1` vraća ceo; pretpostavka je da se treptanje vraća); (2) automatski skrol je bio trenutan, sada je `scroll-behavior: smooth`; (3) snimak ima promenljiv broj sličica u sekundi, sada se pre spajanja i pri zapeku svodi na stalnih 30 fps.

Jedan scenario (primer, telefonska verzija):

```bash
npx playwright test --config=playwright.tutorials.config.js e2e-tutorials/scenarios/kupovina-paketa-mobilni --reporter=line
node e2e-tutorials/scripts/build-subtitles.mjs kupovina-paketa-mobilni
node e2e-tutorials/scripts/merge-video.mjs kupovina-paketa-mobilni
node e2e-tutorials/scripts/burn-subtitles.mjs kupovina-paketa-mobilni
node e2e-tutorials/scripts/build-docs.mjs kupovina-paketa-mobilni
```

**Veličina titlova na telefonu** je jedna konstanta, `PHONE_FONT_RATIO` u `scripts/burn-subtitles.mjs` (udeo širine slike, trenutno 0.07). Za brzu probu bez menjanja fajla: `E2E_TUTORIAL_PHONE_FONT=0.08 node e2e-tutorials/scripts/burn-subtitles.mjs <id>`. Titlovi se menjaju samo korakom 4, snimanje se ne ponavlja.

## Pokretanje

```bash
# 1. odvrti sve tutorial scenarije (ili samo jedan, standardnim Playwright --grep)
npx playwright test --config=playwright.tutorials.config.js

# 2. generiši markdown iz onoga što je snimljeno
node e2e-tutorials/scripts/build-docs.mjs

# ili samo jedan scenario nakon izmene narration.json (bez ponovnog pokretanja testa):
node e2e-tutorials/scripts/build-docs.mjs zakazivanje-termina
```

Oba koraka su i dostupna kao npm skripte - videti `package.json`
(`tutorials:run`, `tutorials:build`, `tutorials`).

## Dodavanje novog scenarija

1. `mkdir e2e-tutorials/scenarios/<novi-id>`
2. Napiši `scenario.spec.js` - najlakše je krenuti od postojećeg pravog testa u
   `test/e2e/*.spec.js` koji već pokriva taj tok, i samo zameniti `test.step` sa
   `tut.step` (i uvoz iz `tutorial.fixture.js` umesto `@playwright/test`).
   - Ako jedan pravi e2e test pokriva **više priča vrednih posebnog objašnjenja**
     (npr. `booking-appointment-commission.spec.js` pokriva i zakazivanje i
     obračun provizije), podeli ga na **više scenario foldera**, svaki sa svojom
     pričom - ne pokušavaj da ispričaš dve priče u jednom tutorijalu.
   - Korake koji ne dodaju ništa vizuelno vredno objašnjenju (npr. čisto seed-ovanje
     podataka direktno u bazi) ne mora da se uvija u `tut.step` - samo prave UI
     korake koje klijent/korisnik stvarno vidi.
   - **Drugi akter (npr. admin) u posebnom kontekstu:** koristi `newRecordedContext()`
     da dobiješ i `context` i `video` (`{ label, startedAt }`). Za SVAKI `tut.step()`
     koji radi sa tim drugim akterom, MORAŠ eksplicitno proslediti
     `{ page: adminPage, video: adminVideo }` kao treći argument - bez toga,
     `tut.step()` podrazumevano screenshot-uje i meri vreme na GLAVNOJ (customer)
     stranici, ne na admin stranici (ovo je bio pravi bug u ranijoj verziji, otkriven
     tek kad je trebalo dodati timestamp podršku - proveri da li novi scenario
     stvarno prikazuje pravi ekran, ne samo da li testovi prolaze). Za admin nalog,
     koristi `seedAdminUser()` iz `slow-actions.js` umesto registracije kroz UI -
     videti `zakazivanje-termina/scenario.spec.js` kao primer.
3. Napiši `narration.json` sa `title`, `intro`, i `steps.<id>` za svaki `tut.step` id
   koji si upotrebio - na oba jezika.
4. Pokreni oba koraka iz sekcije "Pokretanje" iznad, proveri generisani `.md`.

## Mobilni tutorijali (telefon)

Scenario se snima kao telefon (390x844, dodir, portret) tako što na vrhu `describe` bloka stoji:

```js
test.use({ tutorialDevice: "mobile" });
```

Video je tada 390x844 (veličina ekrana telefona; `burn-subtitles` ga uvećava 2x i prilagođava veličinu titla), a drugi akter (`newRecordedContext(..., { device: "mobile" })`) mora da bude takođe mobilni da bi `merge-video.mjs` spojio isti format. Navigacija se ne preskače adresom nego se klikće: `goToLoginViaNav`, `openAccountMenuItem`, `clickPortalTab`, `enterAdminPanel`, `navigateAdminViaMenu` (svi primaju `mobile: true`). Na telefonu to znači burger meni i donju traku kartica, na računaru padajući meni i gornje kartice.

Mobilni scenariji imaju sufiks `-mobilni`: `partner-nalog-pregled-mobilni`, `isplata-partneru-mobilni`.

```bash
# jedan scenario (po putanji fajla)
npx playwright test --config=playwright.tutorials.config.js e2e-tutorials/scenarios/partner-nalog-pregled-mobilni
npx playwright test --config=playwright.tutorials.config.js e2e-tutorials/scenarios/isplata-partneru-mobilni

# pa isti postupak kao za računar (titlovi, spajanje, doc):
node e2e-tutorials/scripts/build-subtitles.mjs partner-nalog-pregled-mobilni
node e2e-tutorials/scripts/merge-video.mjs partner-nalog-pregled-mobilni
node e2e-tutorials/scripts/burn-subtitles.mjs partner-nalog-pregled-mobilni
node e2e-tutorials/scripts/build-docs.mjs partner-nalog-pregled-mobilni
```

## Zajednički tokovi (`flows/`) - računar i telefon iz jednog izvora

Javni deo (i svaki scenario koji treba da postoji u obe varijante) piše se **jednom**, u `flows/<id>.flow.js`:

```js
export async function run({ page, browser, tut, mobile, scenarioId }) { ... }
```

`scenarios/<id>/scenario.spec.js` i `scenarios/<id>-mobilni/scenario.spec.js` su tanki fajlovi koji samo biraju uređaj (`MOBILE = false/true`) i pozovu isti `run()`. Tok ne može da se razilazi između računara i telefona - menja se na jednom mestu. Ako telefon traži dodatni klik (burger meni), helper ga sam doda na osnovu `mobile` parametra.

**Narracija se takođe piše jednom.** `scenarios/<id>-mobilni/narration.json` sadrži samo `title` i `intro` plus `"extends": "<id>"` - svi koraci se nasleđuju. U tekstu se koriste tokeni koji se menjaju po uređaju (`scripts/lib/narration.mjs`): `{klikcemo}`/`{kliknemo}`/`{Kliknemo}` -> klikćemo/kliknemo (računar) ili dodirujemo/dodirnemo (telefon); `{click}`/`{Click}`/`{clicking}` -> click/tap/tapping. Ako se tekst koraka stvarno razlikuje, koristi `"mobile": { "sr": ..., "en": ... }` unutar tog koraka.

**`common-narration.json`** drži tekst koraka koje dele svi scenariji (klik na stavke menija `nav-*`, registracija, prijava, meni naloga, ulazak u admin panel). Scenario koji sam definiše isti `id` uvek pobeđuje. `build-docs`, `build-subtitles` i `merge-video` svi čitaju narraciju preko `loadNarration()` pa se ovo primenjuje svuda isto.

### Helperi za navigaciju bez skakanja na URL (`scripts/slow-actions.js`)

Svi primaju `mobile` i na telefonu sami otvore burger meni (korak `nav-otvara-meni`).

| Helper | Šta radi | Koraci (id) |
|---|---|---|
| `clickMainNavLink` | stavka glavnog menija (Usluge, Paketi, Prodavnica, Blog, Naš tim, Partnerski program, Kontakt) | `nav-otvara-meni` (telefon), zadati `id` |
| `openMoreMenuLink` | stavka iz „Više“ (O nama, Česta pitanja, Naši saradnici) | `nav-vise-otvara` (računar), zadati `id` |
| `clickBookNowButton` | dugme „Zakažite termin“ u zaglavlju | `nav-zakazite-termin` |
| `registerViaNavSlowly` / `goToRegisterViaNav` | „Registracija“ -> forma | `registracija-otvara-meni`, `registracija-klik-registracija`, `registracija` |
| `loginViaNavSlowly` / `goToLoginViaNav` | „Prijava“ -> forma | `login-otvara-meni`, `login-klik-prijava`, `prijava` |
| `openAccountMenuItem` | stavka iz menija naloga (Moj profil, Moji termini, Odjava...) | `<prefix>-otvara-meni`, `<prefix>-bira-stavku` |
| `backToSiteFromPortal` | iz stranica naloga/portala nazad na sajt („Nazad na sajt“) | `portal-nazad-otvara-meni`, `portal-nazad-bira-stavku` |
| `bookServiceViaNav` | put klijenta do stranice sa podacima za rezervaciju: „Zakažite termin“ → usluga → varijanta → datum → termin | `nav-zakazite-termin`, `otvaranje-stranice-usluge`, `izbor-varijante-usluge`, `izbor-datuma`, `izbor-termina` |
| `openListedItem` | kartica usluge/proizvoda/termina iz liste | zadati `id` |
| `adminSignInViaNav` | cela uvodna sekvenca administratora: početna → „Prijava“ → forma → meni naloga → „Admin panel“ | `admin-otvaranje-pocetne`, `admin-login-*`, `admin-prijava`, `admin-ulazak-*` |
| `clickVisibly` | klik; na telefonu prethodno glatko skrola do elementa | - |
| `tutFor(tut, page, video)` | `tut` vezan za drugog aktera (admin) da se isti helperi mogu koristiti i za njega | - |

**Polja koja se ne vide u snimku** (nativni `<select>`, `<input type="date">`, upload fajla - OS prozor se nikad ne snima): `selectOptionVisibly`, `chooseDateVisibly`, `uploadFileVisibly` prvo glatko skroluju do polja i ističu ga crvenim okvirom, pa tek onda postave vrednost.

**Napomene**
- „Dodaj u korpu“ već sam preusmerava na `/korpa` - nema posebnog koraka „otvori korpu“.
- Link iz email potvrde je jedino mesto gde se URL i dalje otvara direktno (u E2E nema sandučeta) - i narracija to kaže.
- `openListedItem`: ako stavka nije vidljiva na trenutnoj strani liste (lista je stranična, sortirana od najnovijeg), korak otvara URL direktno i to ispiše u konzoli (`[tutorial] ... is not visible ...`). Svež seed je normalno na prvoj strani.
- Admin lista na telefonu je tabela koja se horizontalno pomera: `searchAndOpenAdminRecord(..., { mobile: true })` glatko skroluje do ikonice „Detalji“ pre klika.

### Scenariji napravljeni kao tokovi (svaki u obe varijante)

`kupovina-proizvoda-sa-kuponom`, `kupovina-bez-naloga`, `kupovina-sa-nalogom`, `zakazivanje-termina` (klijent + admin), `kupovina-paketa` (admin dodeljuje paket, klijent rezerviše iz paketa, admin završava), `cena-na-upit` (upit + ručna porudžbina), `otkazivanje-porudzbine` (admin, modal sa razlogom), `otkazivanje-termina`, `dostava-velikog-artikla`, `provizija-partnera-za-rezervaciju`, `provizija-za-paket-sa-preporukom`, `provizija-pri-zavrsetku-porudzbine`, `premestanje-termina`, `pregled-sajta` (obilazak svih stavki javnog menija), `moj-nalog-pregled` (sve kartice naloga + odjava).

**Pokretanje:** `npx playwright test --config=playwright.tutorials.config.js e2e-tutorials/scenarios/pregled-sajta-mobilni`, pa `tutorials:subtitles`, `tutorials:merge`, `tutorials:burn`, `tutorials:build` za taj scenario (isto kao u sekciji „Mobilni tutorijali“).

## Git

`manifest.json` i `screenshots/` su generisani i **ignorisani u git-u** (dodato u
`.gitignore`). `generated/*.md` se **committuje** - to je isporučeni tutorijal.
`scenario.spec.js` i `narration.json` se committuju kao izvor.
