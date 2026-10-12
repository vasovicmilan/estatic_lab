# Korisnici, Role i Dozvole

## Tipovi naloga

Svaka osoba koja koristi platformu je **Korisnik**. Korisnički nalog je osnovni identitet — prijava, kontakt podaci, podešavanja. Pored tog osnovnog naloga, osoba može dodatno imati jedan specijalizovani profil:

- **Zaposleni** — neko ko obavlja usluge i može biti zakazan za termine.
- **Partner** — neko ko preporučuje klijente poslovanju putem sopstvenog referalnog linka i zarađuje proviziju na ono što ti referali kupe.

Jedna osoba, u principu, može biti više od jednog od ovih istovremeno (zaposleni koji je istovremeno i partner, na primer) — sistem je napravljen da to podržava bez konflikta.

## Role

Svaki Korisnik ima tačno jednu **Rolu**, i Rola je ono što zapravo određuje šta osoba može da vidi i radi. Postoje četiri role:

- **Admin** — puna operativna kontrola nad platformom.
- **Zaposleni** — pristup sopstvenom kalendaru, dodeljenim terminima, i (ako je na proviziji) sopstvenoj zaradi.
- **Partner** — pristup sopstvenim alatima za referale i zaradi.
- **Korisnik** — podrazumevana rola za svakog ko se registruje; može da zakazuje termine i upravlja sopstvenim porudžbinama.

## Dozvole

Rola je definisana listom konkretnih **dozvola** — pojedinačnih mogućnosti kao što su upravljanje katalogom proizvoda, upravljanje kuponima, pregled operativnih logova, ili odobravanje isplata. Ovo je namerno granulirano: znači da platforma može podržati buduću rolu poput "menadžer prodavnice" ili "marketing koordinator" koja ima neke, ali ne sve, Admin mogućnosti, bez potrebe za novim kodom — samo novu Rolu sa odgovarajućom listom dozvola.

## Zaštita pri unapređenju

Kada neko bude unapređen u profil Zaposlenog ili Partnera, sistem mora da odluči da li Rola njegovog naloga treba da se promeni da odgovara tome. Svaka rola nosi rangiranje po **prioritetu** (Admin najviši, zatim Zaposleni, zatim Partner, zatim podrazumevana Korisnik rola najniža). Pravilo: unapređenje menja nečiju rolu samo ako nova rola ima *viši* rang od one koju osoba već ima.

Ovo postoji tako da unapređenje, recimo, Admina da bude i Partner (da bi testirao partnerski program, ili zato što je zaista i poslovni partner) nikada slučajno ne *degradira* njegov pristup — on zadržava svoju Admin rolu, dok istovremeno dobija Partner profil ispod nje sa sopstvenim referalnim linkom i praćenjem zarade.
## Web sesije: kada prestaju da važe

Web sesija (14 dana) čuva kopiju role i dozvola iz trenutka prijave. Da ta kopija ne bi preživela promenu naloga, `sessionRevalidation` (`auth.middleware.js`) najviše jednom u 60 sekundi po sesiji proverava status naloga i `tokenValidAfter` (ista polja kao za Bearer token). Sesija se odjavljuje ako je nalog suspendovan/neaktivan/obrisan ili je `tokenValidAfter` noviji od trenutka prijave. `tokenValidAfter` se pomera pri suspendovanju/deaktivaciji, **promeni role** (korisnik mora ponovo da se prijavi da bi dobio nove dozvole) i **resetu lozinke**. Ako provera ne uspe (baza nedostupna), sesija se ne prekida.

Pri prijavi (lozinka i Google) sesija dobija nov identifikator (`session.regenerate`), a `redirect` parametar prihvata samo putanju na istom sajtu (`/...`). Google prijava odbija suspendovane i nepotvrđene naloge, a postojeći lokalni nalog povezuje po email-u samo ako Google vrati `verified_email: true`.
