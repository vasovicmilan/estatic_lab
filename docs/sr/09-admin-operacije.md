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

Administrator (ili zaposleni) takođe može direktno kreirati termin iz admin panela (`/admin/termini/rucno-kreiranje`) umesto da ga klijent sam zakaže — za walk-in klijente, poklone, nagrade, i slične slučajeve. Pri tome se opciono može ručno podesiti cena za taj konkretan termin, umesto cene iz kataloga usluge — pogledajte `02-usluge-zakazivanje-termini.md` za punu mehaniku i razlog zašto je ovo namerno odvojeno od sistema kupona.

## Kupovine paketa

Pošto se kupovine paketa evidentiraju od strane administratora umesto da ih klijent sam vrši (pogledajte `03-paketi-i-kupovine.md`), ovo je i mesto gde se kupovina paketa zaista kreira — biranjem klijenta, paketa, i opciono primenom koda za popust, sa prikazom konačne cene pre nego što se kupovina finalizuje.

## Marketing alati

Kodovi za popust, kuponi povezani sa referalima, i strana isplata partnerskog programa se svi upravljaju iz admin panela, pored opšteg marketinškog sadržaja poput newsletter-a i preporuka klijenata.

## Sadržaj sajta

Naslovna (hero) slika početne strane se menja iz admin panela (Sadržaj i marketing → Sadržaj sajta, `/admin/sajt`), bez potrebe za izmenom koda ili redeploy-om. Podaci se čuvaju u jednom (singleton) `SiteSettings` dokumentu — ako nikad nije ručno postavljena, koristi se podrazumevana slika iz koda. Ovo je namerno odvojeno od `business.config.js`, koji ostaje statičan, kod-definisan izvor istine za identitet biznisa (naziv, adresa, radno vreme...) — `SiteSettings` je uređivan sadržaj koji se menja bez deploy-a, spreman da se u budućnosti proširi (npr. sadržaj stranice "O nama").

## Nadzor i izveštavanje

Administratori imaju pristup operativnom izveštavanju i tragu odgovornosti koji pokriva akcije preduzete na platformi — u potpunosti pokriveno u `10-logovi-i-revizija.md`.