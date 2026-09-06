# Estatic Lab — Indeks Dokumentacije

Ova dokumentacija je podeljena na fokusirane fajlove, gde svaki pokriva jednu oblast poslovanja od početka do kraja: šta radi, zašto je tako osmišljeno, i kako se delovi uklapaju. Pogledajte indeks ispod da pronađete pravi fajl za ono što vam je potrebno.

| Fajl | Pokriva |
|---|---|
| `01-korisnici-role-dozvole.md` | Tipovi naloga, role, model dozvola, zaštita pri unapređenju |
| `02-usluge-zakazivanje-termini.md` | Katalog usluga, proces zakazivanja, životni ciklus termina |
| `03-paketi-i-kupovine.md` | Paketi sa više seansi, kako se prodaju, kako se seanse troše |
| `04-prodavnica-proizvodi-porudzbine.md` | Katalog proizvoda, korpa, plaćanje, životni ciklus porudžbine |
| `05-kuponi-i-popusti.md` | Kodovi za popust, kako se primenjuju, na šta mogu biti ograničeni |
| `06-partnerski-program.md` | Kompletan partnerski program: praćenje referala, pripisivanje, provizija, isplata |
| `07-naknade-zaposlenih.md` | Zaposleni na platu vs. na proviziju, kako se provizija računa, uključujući seanse iskorišćene iz paketa |
| `08-isplate-i-stanja.md` | Kako se računa stanje za isplatu i kako novac zaista prelazi ruke |
| `09-admin-operacije.md` | Šta administratori mogu da vide i rade na platformi |
| `10-logovi-i-revizija.md` | Operativna vidljivost i odgovornost — ko je šta uradio, i izveštaji o stanju sajta |
| `11-eksterne-integracije.md` | Dvosmerna sinhronizacija sa Google Calendar-om (kalendar po zaposlenom) i SrediMe pijacom za zakazivanje |
| `12-testiranje.md` | Tri sloja testova (jedinični, integracioni, E2E), šta svaki pokriva, kako se pokreću, i obrasci/zamke otkriveni pri pisanju E2E testova |
| `13-poslovni-izvestaji.md` | Poslovni izveštaji (zakazivanja, prodavnica, paketi, provizije, kuponi) — tekući period uživo naspram sačuvane istorije, automatsko i ručno generisanje, email i PDF |
| `14-integritet-podataka-i-brisanje.md` | Šta se dešava pri brisanju bilo kog zapisa — kada se blokira, kada se automatski čisti iz povezanih zapisa, i kada se namerno ne dira jer je prikazni sloj već otporan na obrisanu referencu |

Svaki fajl je samostalan — nije potrebno da ih čitate po redosledu, iako `06` (partnerski program) koristi pojmove iz `03`, `05` i `07`, `11` se nadovezuje na životni ciklus termina opisan u `02`, a `14` (brisanje) najviše koristi ako već poznajete entitete opisane u `02`, `03` i `04`.