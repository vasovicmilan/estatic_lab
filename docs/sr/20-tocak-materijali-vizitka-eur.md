# Točak sreće, materijali, vizitka zaposlenog i cene u evrima

Ovaj dokument opisuje četiri nezavisne celine: više točkova sreće sa leadovima, materijale za preuzimanje, javnu vizitku zaposlenog i prikaz cena u evrima.

## 1. Točkovi sreće (više točkova)

- **Model `Wheel`**: svaki točak ima jedinstven `slug`, naziv, aktivnost i opcioni period važenja. Podrazumevani točak ima slug `tocak`; slug `vrti` je rezervisan (to je ruta za vrtenje).
- **Javne stranice**: `/tocak` (podrazumevani) i `/tocak/:slug`. Nepoznat slug vraća 404.
- **Vrtenje**: `POST /tocak/vrti` sa poljem `wheel` (slug). Ruta je izuzeta iz CSRF provere, a ograničava je `RATE_LIMIT_WHEEL_MAX` (podrazumevano 80 zahteva u minuti po klijentu).
- **Kad je točak otvoren**: aktivan je, u okviru datuma i ima najmanje 2 nagrade koje se mogu osvojiti. Nagrade se mogu dodavati i ispod minimuma, ali se ne mogu smanjivati ispod njega.
- **Nagrade**: `WheelPrize.key` je globalno jedinstven (kuponi se vezuju preko `wheelPrizeKey`). Rezervna nagrada ("fallback") je jedna po točku.
- **Leadovi**: jedinstvenost je po točku: `(wheel, email)` i `(wheel, phone.hash)`. Ista osoba može da vrti na drugom točku. Lista leadova ima kolonu "Točak" i CSV izvoz je sadrži.
- **Admin**: `/admin/tocak` (izbor točka sa `?tocak=`) i `/admin/tocak/tockovi` (pravljenje, izmena, brisanje; novi točak može da kopira nagrade iz postojećeg).
- **Migracija**: servis pri pokretanju sam dodeljuje stare nagrade i leadove podrazumevanom točku. Skripta `scripts/migrate-multi-wheel.js` (probni rad podrazumevano, `--apply` za stvarnu izmenu) uklanja stare jedinstvene indekse `email_1` i `phone.hash_1`. Prvo je pokrenuti na kopiji baze.

## 2. Materijali za preuzimanje

- Javno: `/materijali/:slug` (stranica), `/materijali/:slug/pregled` (pregled) i `/materijali/:slug/preuzmi` (preuzimanje).
- Admin: `/admin/materijali`, potrebna je dozvola `MANAGE_MARKETING`.
- Otpremanje je preko multer-a; za veće fajlove nginx mora da ima `client_max_body_size 25m`.

## 3. Vizitka zaposlenog

- Svaki zaposleni ima najviše jednu vizitku (`EmployeeCard`), uređuje je na `/moj-nalog/vizitka`.
- Javna adresa je `/vizitka/:slug`; slug je nasumičnih 8 znakova (bez lako pobrkanih). Kontakt se preuzima kao vCard 3.0 (`/kontakt.vcf`), a QR kod se nudi kao SVG i PNG.
- **Privatnost**: ništa lično nije javno po podrazumevanoj vrednosti; svako polje se posebno uključuje (`show`). Vizitka je javna tek kad zaposleni uključi `isPublic`.
- Zaposleni može da istakne do 3 svoje aktivne usluge. Fotografija se jednom kopira iz profila stručnjaka.
- Dugme za zakazivanje vodi na zakazivanje sa unapred izabranim zaposlenim (`?employeeId=`).
- **Admin**: `/admin/vizitke` pregled svih vizitki; administrator može da onemogući vizitku (`adminDisabled`), što ima prednost nad izborom zaposlenog.
- Broje se pregledi i preuzimanja.

## 4. Cene u evrima

- Prikaz je samo informativan. Korpa, porudžbine, plaćanje i schema.org ostaju u dinarima.
- Polja su opciona: proizvod/varijacija (`priceEur`, `compareAtPriceEur`), usluga, paket (`totalPriceEur`, `basePriceEur`). Prazan unos se čuva kao `null`.
- Opseg u evrima ("od–do") prikazuje se samo ako svaka stavka ima cenu u evrima. Format: `21 €`, `12,50 €`.
- Unos proveravaju validatori (`validateEurPair`: stara cena ne sme biti manja od nove).

## Poznata ograničenja

- Cene u evrima se ne preračunavaju automatski i ne prate kurs; unose se ručno.
- Brisanje točka briše i njegove nagrade; leadovi se zadržavaju radi evidencije.
