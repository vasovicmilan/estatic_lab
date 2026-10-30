# Video uputstva ("Edukativni kutak")

Platforma sama sebe objašnjava: **kratki video snimci pokazuju korak po korak gde se klikće**, na računaru i na telefonu, sa titlovima na srpskom i engleskom. Snimci se ne prave ručno nego ih **sam sistem snima kroz pravi pregledač** (Playwright), pa kad se ekran promeni, uputstvo se ponovo napravi jednom komandom i ne zastareva. Aplikacija ih prikazuje na stranici **`/uputstva`**, svakome samo ono što sme da vidi.

## Ko šta vidi

| Posetilac | Vidi uputstva za |
|---|---|
| Gost | sve posetioce (`public`) |
| Prijavljen korisnik | `public` + prijavljene korisnike (`user`) |
| Partner | `public` + `user` + partnere (`partner`) |
| Zaposleni | `public` + `user` + zaposlene (`employee`) |
| Administrator (dozvola `access_admin_panel`) | sve, uključujući `admin` |

Ko je za koje uputstvo određuje `e2e-tutorials/audience.json` (ime scenarija → publika). Scenario koji tu nije naveden objavljuje se kao `admin` (najstrože), uz upozorenje pri objavi. Novi scenario je jedan red u tom fajlu.

## Zašto ne običan statički folder

Statički folder (`src/public`) daje svaki fajl svakome ko pogodi adresu, pa bi administratorsko uputstvo bilo javno. Zato su videi **van `src/public`**, u folderu `storage/tutorials` (ili tamo gde pokazuje `TUTORIALS_DIR` u `.env`), i šalju se samo kroz rute koje proveravaju pristup:

- `GET /uputstva` je stranica sa spiskom, filtriranim po posetiocu.
- `GET /uputstva/video/:id/:uredjaj/:jezik.mp4` je sam video, i `GET /uputstva/poster/:id/:uredjaj.jpg` sličica. Nastavci su namerni: limiteri (aplikacije i Cloudflare) statiku prepoznaju po nastavku, pa se slike i video ne broje u limit zahteva. Pristup se i dalje proverava po fajlu.

Pravila u `src/services/tutorial-video.service.js`:

- **Provera za svaki fajl, ne samo za stranicu.** Ko pogodi adresu admin videa bez prava dobija 403, nepoznat video 404.
- **Adresa nikad ne gradi putanju.** `id`, uređaj i jezik samo biraju stavku iz `manifest.json`. Putanja iz manifesta se pritom još jednom proverava da ostane unutar foldera (zaštita od "../").
- **Keš:** javni videi se mogu keširati, a ostali samo u pregledaču samog gledaoca (`private`), da zajednički keš ne bi poslužio tuđi sadržaj. Stranica sa spiskom se uopšte ne kešira, jer zavisi od toga ko je prijavljen.
- **Premotavanje radi** (HTTP `Range` zahtevi), što je neophodno za `<video>`.
- Stranica je `noindex`.

Ako neka stavka nema verziju za izabrani uređaj (npr. samo računar), stranica prikazuje postojeću verziju uz napomenu, umesto praznog polja.

## Kako se prave (jedna komanda)

```bash
npm run tutorials:all
```

Radi 6 koraka redom: snimanje svih scenarija (računar 1920x1080 i telefon 390x844), titlovi, spajanje snimaka više aktera (npr. klijent pa admin) u jedan video, **zapeka titlova u sliku** (H.264 `.mp4`), markdown uputstva sa slikama i **objava** u `storage/tutorials`. Na kraju ispiše vreme svakog koraka. Scenario koji pukne ne zaustavlja ostale. Opcije: `-- --only <deo imena>` za jedan ili više scenarija, `-- --skip-record` da se ne snima ponovo (kad se menja samo tekst ili veličina titla).

**Koliko traje (izmereno, prvi pun prolaz sa 41 snimkom):** snimanje 1 h 06 min, spajanje 12 min, zapeka titlova 20 min, objava 14 s, **ukupno 1 h 38 min**. Treba `ffmpeg` i `ffprobe` na mašini koja snima (ne na produkcijskom serveru).

Detaljan opis svakog koraka, pisanja scenarija i naracije je u `e2e-tutorials/README.md`.

## Šta je pokriveno

Prvi pun prolaz objavio je 24 uputstva (3 javna, 9 za korisnike, 5 za partnere, 3 za zaposlene, 4 za administratore). Posle toga je napisano još 18 scenarija (svaki za računar i telefon), pa je ukupno **40 priča, 80 snimaka**: i uputstva za zaposlene i administratore sada postoje i za telefon. Svi stavke administratorskog menija imaju bar jedno uputstvo. Novi scenariji se snimaju komandom `npm run tutorials:all -- --scenario <folder>` (može se ponoviti za više foldera), a svaki mora biti upisan u `e2e-tutorials/audience.json`. Pretraga kataloga nije snimana jer na sajtu ne postoji pretraga.

## Postavljanje na server

1. Snimi lokalno (`npm run tutorials:all`).
2. Prenesi folder `storage/tutorials` na server (npr. `rsync`).
3. Na produkciji podesi `TUTORIALS_DIR` na trajan folder koji preživljava deploy, i da aplikacija ima pravo čitanja.

Folder `storage/` je u `.gitignore`: videi su generisani fajlovi i ne ulaze u git. Ako nema `manifest.json`, stranica jednostavno kaže da uputstva još nisu objavljena (nije greška).

## Poznata ograničenja

- Mobilne verzije za zaposlene i administratore nedostaju (vidi iznad).
- Videi se prave lokalno i ručno prenose, nema automatskog slanja na server.
- Titlovi su zapečeni u sliku, pa ih gledalac ne može isključiti, a jezik se bira izborom drugog fajla.
- Snimci prikazuju aplikaciju sa probnim podacima, ne sa produkcijskim, a nazivi i cene u njima su izmišljeni.
- Da li je treptanje slike na telefonu zaista otklonjeno nije potvrđeno gledanjem svih snimaka.

**Indeksiranje:** uputstva nisu namenjena pretraživačima. `robots.txt` zabranjuje `/uputstva`, a svaki odgovor iz te putanje (stranica, video i slike) nosi zaglavlje `X-Robots-Tag: noindex, nofollow, noarchive`.
