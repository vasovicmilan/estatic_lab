# Testiranje

Platforma ima tri odvojena sloja testova, svaki proverava sistem na drugačiji način i sa drugačijim alatom. Ovaj fajl objašnjava šta svaki sloj radi, šta trenutno pokriva, kako se pokreće, i nekoliko obrazaca/zamki na koje treba obratiti pažnju pri pisanju novih testova.

## Tri sloja

**Jedinični (unit) testovi** proveravaju pojedinačne servisne funkcije izolovano — svi pozivi ka bazi i drugim servisima su mokovani. Najbrži sloj, najveći broj testova, prvi red odbrane za poslovnu logiku (obračun provizije, validacija kupona, prelazi statusa).

**Integracioni testovi** pokreću stvarni Express app u memoriji (`supertest`, bez pravog HTTP soketa) protiv stvarne MongoDB instance u memoriji (`mongodb-memory-server`). Proveravaju da li kontroler, validator, servis i repozitorijum zajedno rade ispravno za dati HTTP zahtev — bez pokretanja pravog pregledača.

**E2E (end-to-end) testovi** koriste Playwright da pokrenu pravi headless Chromium pregledač protiv pravog Express servera (opet sa `mongodb-memory-server` pozadi, ali kao pravi HTTP server na portu, ne in-process). Ovo je jedini sloj koji stvarno klikće kroz forme, prati redirekcije, i vidi tačno ono što bi video pravi posetilac — uključujući stvari koje se dešavaju samo u pregledaču (skrivena polja, JS vidžeti, sesijski kolačići).

Sva tri sloja postoje jer proveravaju različite stvari: jedinični test da obračun provizije daje tačan broj, integracioni da HTTP zahtev sa pogrešnim podacima vrati tačan status kod, E2E da klijent stvarno može da završi kupovinu od početka do kraja kroz pravu formu.

## Pokretanje

```bash
npm test                  # jedinični + integracioni testovi
npm run test:coverage     # isto, plus izveštaj o pokrivenosti koda
npm run test:watch        # isto, ponovo pokreće pri izmeni fajla

npx playwright test       # E2E testovi
npx playwright test --list   # samo prikazuje koji testovi postoje, ne pokreće ih
```

`npm test` i `npx playwright test` su namerno odvojene komande koje se pokreću odvojeno — Node-ov ugrađeni test runner (`node --test`) i Playwright-ov test runner su dva različita alata koja ne mogu da dele isti proces. `package.json`-ove `test`/`test:coverage` skripte eksplicitno ciljaju samo `test/unit/**` i `test/integration/**` putanje da Node-ov runner ne bi slučajno pokušao da izvrši Playwright specifikacije (Node-ov `--test` po difoltu rekurzivno skenira sve u `test/` folderu).

**Važna napomena o izveštaju o pokrivenosti**: `npm run test:coverage`-ov procenat pokrivenosti računa samo kod izvršen unutar jediničnog/integracionog test procesa. E2E testovi pokreću server kao potpuno odvojen proces (da bi pravi pregledač mogao da mu pristupi preko mreže), pa taj kod nikad ne prolazi kroz Node-ovo merenje pokrivenosti — iako ga E2E testovi stvarno izvršavaju. Kontroler sa niskim prijavljenim procentom pokrivenosti (npr. `partner.controller.js`) može u stvarnosti biti dobro pokriven kroz E2E, samo to alat ne vidi jer je taj kod radio u drugom procesu.

## Šta je pokriveno

### Jedinični testovi
Preko 1700 testova pod `test/unit/`, organizovanih po servisu/mape­ru/repozitorijumu/validatoru. Finansijski najosetljiviji servisi — `commission.service.js`, `payout-request.service.js`, `resource.service.js` — su na 100% pokrivenosti linija i funkcija.

### E2E testovi
23 testa pod `test/e2e/`, po poslovnom toku:

| Fajl | Šta proverava |
|---|---|
| `checkout-freight-shipping.spec.js` | Porudžbina sa velikim/teškim artiklom ne dobija automatsku cenu dostave; admin je ručno unosi; kupac tek onda može da potvrdi |
| `coupon-product-discount.spec.js` | Kupon sa posebnim popustom za artikle (odvojenim od popusta za usluge), uključujući plafon iznosa i partnersku proviziju po stopi za artikle |
| `booking-appointment-commission.spec.js` | Zakazivanje termina od početka do kraja, i provizija zaposlenog + partnera po stopi za usluge nakon što admin završi termin |
| `employee-appointment-management.spec.js` | Zaposleni upravlja sopstvenim dodeljenim terminima kroz svoj panel; ne može da vidi/menja tuđe |
| `customer-self-service.spec.js` | Klijent vidi i otkazuje sopstvene termine/porudžbine, uz poštovanje 24h roka za otkazivanje termina i "samo na čekanju" pravila za porudžbine |
| `employee-working-hours.spec.js` | Izmena radnog vremena zaposlenog kroz njegov panel stvarno menja koji termini su dostupni za zakazivanje |
| `package-purchase.spec.js` | Admin dodeljuje paket klijentu; klijent troši seansu kroz zakazivanje; sesija prelazi iz rezervisano u iskorišćeno tek kada admin završi termin |
| `appointment-reassign.spec.js` | Admin premešta termin drugom zaposlenom; padajuća lista već isključuje zaposlene koji nisu dostupni u tom terminu |
| `order-completion-commission.spec.js` | Provizija sa porudžbine ostaje "na čekanju" kroz obradu/slanje/dostavu, i tek postaje "zarađena" kada je porudžbina označena završenom |
| `order-cancellation.spec.js` | Otkazivanje ili vraćanje porudžbine vraća rezervisane količine na stanje zaliha |
| `payout-cycle.spec.js` | Kompletan ciklus isplate (zahtev → odobrenje → isplaćeno, i odbijanje) za zaposlenog i za partnera odvojeno |

## Arhitektura E2E sloja

`playwright.config.js` pokreće `test/e2e/setup/start-server.js` kao poseban proces pre testova (Playwright-ov `webServer` mehanizam) — taj fajl podiže `mongodb-memory-server`, seeduje osnovne role, i pokreće pravi Express server na portu 4100. Pošto same test specifikacije rade u **odvojenom** Node procesu od tog servera, `test/e2e/helpers/db.js` otvara sopstvenu konekciju ka **istoj** in-memory bazi (čita connection string iz privremenog fajla koji `start-server.js` upisuje) — to omogućava specifikacijama da direktno seeduju podatke (proizvod, kupon, zaposlenog) i proveravaju rezultate u bazi, bez oslanjanja isključivo na ono što se vidi na ekranu.

`test/e2e/helpers/e2e-helpers.js` sadrži sve deljene funkcije za seedovanje podataka (`seedProduct`, `seedService`, `seedEmployee`, `seedPartner`, `seedCoupon`, `seedOrder`, `seedAppointment`, `seedPackage`, `seedCommissionEntry`...) i za česte UI radnje (`registerAndLoginViaUI`, `loginViaUI`, `promoteToAdmin`, `confirmActionModal`, `setEmployeeWorkingHoursViaUI`).

## Obrasci i zamke vredne pamćenja

Nekoliko stvari koje nisu očigledne dok se prvi put ne naiđe na njih — vredi ih znati pre pisanja novih E2E specifikacija:

- **Novi tab (`context.newPage()`) deli kolačiće sa postojećom stranom** unutar istog `BrowserContext`-a. Za "drugog glumca" (npr. admina dok je klijent već ulogovan) treba pravi novi `browser.newContext()`, inače stranica za prijavu odmah preusmerava na početnu jer sesija već postoji.
- **Tri različita obrasca potvrde akcije** postoje u administratorskom interfejsu: obična forma bez potvrde, `data-confirm` koji otvara zajednički Bootstrap modal (`#confirmActionModal`/`#confirmActionButton`, klik na dugme samo otvara modal — `confirmActionModal()` helper ga stvarno potvrđuje), i `needsReason` obrazac koji je prava forma sa poljem za razlog unutar sopstvenog modala (nema `#confirmActionButton`, ima svoje "Potvrdi" dugme unutar `.modal.show`).
- **Vidžet za radno vreme** (`admin-schedule.js`) ima sopstveni `submit` osluškivač koji ponovo upisuje skriveno polje tačno pre slanja forme — direktno postavljanje vrednosti tog polja se tiho prepisuje. Treba stvarno kliknuti kroz vidžetove kontrole (`setEmployeeWorkingHoursViaUI()` helper to radi ispravno).
- **Padajuće liste za premeštanje termina već isključuju nedostupne zaposlene** na serverskoj strani — nema toka "izaberi pa dobij grešku", opcija jednostavno nije ponuđena.
- **Provizija sa porudžbine ne postaje "zarađena" automatski** kada je porudžbina potvrđena — samo kada admin porudžbinu označi kao potpuno završenu (`order:status_changed` događaj, samo za status `completed`). Povlačenje provizije pri otkazivanju porudžbine ide preko odvojenog planiranog zadatka (`processGracePeriodCommissions`), ne preko događaja — nema direktnog UI okidača za to.
- **Osluškivači događaja se moraju eksplicitno učitati** u `start-server.js` (isti obrazac kao pravi `server.js`) — `app.js` sam po sebi ih ne registruje. Bez ovoga, sve što zavisi od događaja (upis provizije, itd.) tiho nikad ne bi radilo, bez ijedne greške.
- **CSS klase se ne mogu uvek koristiti kao selektor** — npr. `.btn-outline-primary` se poklapa i sa dugmetom "Registracija" u navigaciji. Bolje osloniti se na `href` obrazac, `role`, ili `data-*` atribute kada su dostupni.
- **Responsivni prikazi duplikaju sadržaj** (mobilna lista + desktop tabela, jedna sakrivena po CSS-u) — generički `getByText()` selektor može pogoditi sakriveni duplikat. `getByRole("cell", ...)` je pouzdaniji za tabelarne podatke.