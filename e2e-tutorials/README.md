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
  1.2s) posle svakog koraka, da video zastane na rezultatu pre nego što krene
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

## Git

`manifest.json` i `screenshots/` su generisani i **ignorisani u git-u** (dodato u
`.gitignore`). `generated/*.md` se **committuje** - to je isporučeni tutorijal.
`scenario.spec.js` i `narration.json` se committuju kao izvor.
