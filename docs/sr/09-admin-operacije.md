# Admin Operacije

Ovo je pregled onoga što administrator može da vidi i njime upravlja na platformi. Pojedinačne oblasti su detaljnije pokrivene u sopstvenim fajlovima; ovo je mapa.

## Upravljanje katalogom

Puna kontrola nad onim što se nudi i prodaje: usluge i njihove varijante, paketi sa više seansi i šta objedinjuju, fizički proizvodi i njihove varijacije, i kategorije i tagovi korišćeni da se sve to organizuje. Sadržajna strana sajta — blog objave i opšti marketinški sadržaj — se upravlja na isti način.

## Upravljanje ljudima

Administratori upravljaju svakim tipom naloga na platformi:

- **Korisnici** — opšti nalozi klijenata, uključujući njihov status i rolu.
- **Zaposleni** — profili osoblja, njihov način naknade, usluge za koje su kvalifikovani, njihovo radno vreme, i (opciono) podešavanje sinhronizacije kalendara opisano u `11-eksterne-integracije.md`.
- **Partneri** — učesnici partnerskog programa i njihov procenat provizije.

Unapređenje korisnika u profil Zaposlenog ili Partnera se obrađuje sa zaštitom opisanom u `01-korisnici-role-dozvole.md`, tako da nikada slučajno ne smanji nečiji postojeći pristup.

## Zakazivanja i porudžbine

Administratori imaju punu vidljivost nad svakim terminom i svakom porudžbinom iz prodavnice, i mogu da pomere bilo koji kroz njegov životni ciklus u ime klijenta ili zaposlenog kada je potrebno — potvrđujući, završavajući, otkazujući, preraspodeljujući drugom zaposlenom, pomerajući na novo vreme, i slično, prateći ista pravila opisana u `02-usluge-zakazivanje-termini.md` i `04-prodavnica-proizvodi-porudzbine.md`.

Administrator takođe može direktno kreirati termin iz admin panela (`/admin/termini/rucno-kreiranje`) umesto da ga klijent sam zakaže — za walk-in klijente, poklone, nagrade, i slične slučajeve. Pri tome se opciono može ručno podesiti cena za taj konkretan termin, umesto cene iz kataloga usluge — pogledajte `02-usluge-zakazivanje-termini.md` za punu mehaniku i razlog zašto je ovo namerno odvojeno od sistema kupona. Trenutno dostupno samo administratoru — zaposleni nemaju pristup `/admin` panelu uopšte (imaju svoj poseban portal), iako je servisni sloj već spreman da podrži i njih ako se to ikad odluči da otvori.

## Kupovine paketa

Pošto se kupovine paketa evidentiraju od strane administratora umesto da ih klijent sam vrši (pogledajte `03-paketi-i-kupovine.md`), ovo je i mesto gde se kupovina paketa zaista kreira — biranjem klijenta, paketa, i opciono primenom koda za popust, sa prikazom konačne cene pre nego što se kupovina finalizuje.

## Marketing alati

Kodovi za popust, kuponi povezani sa referalima, i strana isplata partnerskog programa se svi upravljaju iz admin panela, pored opšteg marketinškog sadržaja poput newsletter-a i preporuka klijenata.

## Sadržaj sajta i podešavanja

Iz admin panela (Sadržaj i marketing → Podešavanja sajta, `/admin/sajt`) se menja sve u jednom (singleton) `SiteSettings` dokumentu, bez potrebe za izmenom koda ili redeploy-om:

**Podaci o firmi** (naziv, pravni naziv, kontakt email, email za obaveštenja administratoru, telefon, PIB, matični broj, adresa, geo koordinate, društvene mreže) i **Dostava i provizije** (fiksna cena dostave, rok pre odobravanja provizije partnera) se takođe menjaju ovde i važe odmah, bez restarta. Prioritet: vrednosti iz admin panela > env (`SITE_NAME`, `SUPPORT_EMAIL`, `ADMIN_EMAIL`, `DEFAULT_SHIPPING_PRICE`, `ORDER_COMMISSION_GRACE_PERIOD_DAYS`) > podrazumevane vrednosti u kodu (`business.config.js`). API: `PUT /admin/site-settings` prihvata polja `businessName`, `businessLegalName`, `businessEmail`, `businessAdminEmail`, `businessPhone`, `businessTaxId`, `businessRegistrationNumber`, `businessStreetAddress`, `businessAddressLocality`, `businessPostalCode`, `businessAddressCountry`, `businessLatitude`, `businessLongitude`, `businessSameAs` (niz linkova), `defaultShippingPrice`, `orderCommissionGraceDays`.

- **Hero slika** — naslovna slika početne strane. Ako nikad nije ručno postavljena, koristi se podrazumevana slika iz koda.
- **Politika zakazivanja** — razmak između termina, korak ponuđenih termina, rok za samostalno otkazivanje, pragovi za pomeranje termina (videti `02-usluge-zakazivanje-termini.md`). Bilo hardkodovano u `booking.config.js`, sada admin-editable.
- **Valuta** — kod, simbol za prikaz, i pozicija simbola. Menja samo kako se cena prikazuje (npr. "2500 RSD" vs "€2500"); ne menja same podatke u bazi niti vrši konverziju valuta.

Izmene ovde su odmah aktivne, bez restart-a servera — sistem drži trenutne vrednosti u memoriji (`runtime-settings.cache.js`) i osvežava ih čim se sačuva izmena.

Ovo je namerno odvojeno od `business.config.js`, koji ostaje statičan, kod-definisan izvor istine za identitet biznisa (naziv, adresa, radno vreme...) — `SiteSettings` je uređivan sadržaj koji se menja bez deploy-a, spreman da se u budućnosti proširi (npr. sadržaj stranice "O nama").

### Tekstovi sajta

Tekstovi na javnim stranicama (Sadržaj i marketing → Tekstovi sajta, `/admin/sajt/sadrzaj`) čuvaju se u drugom singleton dokumentu, `SiteContent`, i uređuju se u običnom web admin panelu (isti podaci su i dalje dostupni kroz API, `/api/v1/admin/site-content/*`). Svaka sekcija ima svoju stranicu za izmenu:

- **O nama** (`/o-nama`), **Politika privatnosti**, **Uslovi korišćenja** — uvod plus lista sekcija; svaka sekcija ima naslov, paragrafe, listu, zaključne paragrafe i opcione pod-sekcije (jedan nivo). Paragrafi mogu sadržati HTML (npr. link).
- **FAQ** — pitanja i odgovori.
- **Partnerski program** — uvod, koraci (redni broj se dodeljuje po redosledu) i prednosti.
- **Uvod na početnoj**, **Zašto mi**, **Uvod stranice Naš tim** — tekstovi i kartice na početnoj strani i strani tima.
- **Hero početne**, **Uvod stranice Usluge / Paketi / Blog**, **Uvod prodavnice** (uvod + „zašto kod nas“ kartice + česta pitanja), **Kontakt stranica i lokacija** (uvod, adresa, Google Maps embed, napomena o Google prijavi) — ranije hardkodirano u presenterima; sada u bazi i u javnom API-ju (`GET /api/v1/home`, `/contact-page`, `/list-intro/:page`, `/testimonials`, `/blog/archive/:type/:slug`), pa EJS i Angular prikazuju isto.
- **SEO stranica** (`/admin/sajt/sadrzaj/seo-stranica`) — SEO naslov i opis svih 13 statičkih/listing stranica (početna, usluge, paketi, prodavnica, blog, tim, saradnici, kontakt, O nama, FAQ, politika, uslovi, partnerski program). Backend je jedini izvor: isti podatak koristi EJS sajt i javni API `GET /api/v1/page-seo/:page` (title, description, canonical, robots, OG/Twitter, JSON-LD; početna nosi i Organization JSON-LD), a Angular frontend ga samo primenjuje.

Izmena je odmah vidljiva na sajtu, a svako čuvanje ulazi u audit log (`SITE_CONTENT_*_UPDATED`). Potrebna je dozvola `manage_site_content`.

### SEO ključne reči

Usluge, paketi, proizvodi i blog imaju posebnu SEO stranicu (`/…/:id/seo`) za ključne reči; saradnici imaju SEO naslov, opis i ključne reči direktno u formi za izmenu.

## Nadzor i izveštavanje

Administratori imaju pristup operativnom izveštavanju i tragu odgovornosti koji pokriva akcije preduzete na platformi — u potpunosti pokriveno u `10-logovi-i-revizija.md`. Odvojeno od toga, administratori vide i poslovne brojke — zakazivanja, prodaju, provizije, kupone — pokriveno u `13-poslovni-izvestaji.md`.