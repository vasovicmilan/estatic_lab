# Bekapi (Backup)

**Faza 1 (ovaj dokument): lokalno, na istom serveru, dnevno.** Datiran snimak baze podataka i uploadovanih slika/videa, upisan u folder na istom serveru na kom app radi, automatski se briše posle perioda čuvanja. Ovo je namerno prvi korak, ne cela priča — štiti od toga da app ili baza upadnu u loše stanje (loša migracija, slučajno masovno brisanje, oštećeni podaci), ali ne štiti od toga da sam server umre ili disk otkaže. Sinhronizacija ovih datiranih foldera negde van servera (drugi računar, USB, Google Drive) je Faza 2, namerno još nije napravljena — vredi prvo pustiti Fazu 1 da radi i potvrditi je nekoliko dana.

## Šta se bekapuje, i zašto

- **Baza podataka** — kompletan `mongodump`, gzip-kompresovan u jedan arhiv fajl (`db.gz`). Sve iz MongoDB-a: korisnici, termini, porudžbine, proizvodi, usluge, podešavanja, sve.
- **Uploadovane slike/video** — gzip tarball (`uploads.tar.gz`) samo `images/` i `videos/` podfoldera unutar `UPLOAD_PUBLIC_PATH` (videti `multer.config.js` za kompletan spisak podfoldera — usluge, paketi, proizvodi, kategorije, postovi, testimonijali, eksperti, partneri, sajt, video thumbnail-ovi).

**Šta namerno NIJE uključeno**: ostatak `src/public/` foldera (kompajlirani CSS, icon-subset font, bilo koji drugi build output). `DEPLOYMENT.md` već dokumentuje da se to regeneriše po serveru preko `npm run build:css` / `npm run build:icons` — to nisu podaci, to su build artefakti, i bekapovanje toga bi samo svaki dan pravilo veći bekap bez razloga.

## Pokretanje

```bash
npm run backup:daily
```

Ovo pokreće `scripts/backup.js`, koji:

1. Čita `BACKUP_DIR` i `MONGO_URI` iz okruženja (`.env` — videti `.env.example`). Odbija da se pokrene ako `BACKUP_DIR` nije podešen, umesto da pogađa podrazumevanu vrednost — skripta za bekap nikad ne sme da upiše negde neočekivano.
2. Kreira `BACKUP_DIR/YYYY-MM-DD/` za danas.
3. Pokreće `mongodump --uri=$MONGO_URI --archive=.../db.gz --gzip`. Ako ovo ne uspe, ili proizvede prazan fajl, ceo run se tretira kao neuspešan (exit kod 1, Telegram alert preko postojećeg kanala za operativna obaveštenja — videti `09-admin-operacije.md`) i ništa dalje se ne dešava — konkretno, stari bekapi se **ne** brišu pri neuspešnom run-u, tako da jedna loša noć nikad ne košta i prošlonedeljne dobre bekape.
4. Pakuje `images/`/`videos/` u `uploads.tar.gz` (preskače se, ne tretira se kao greška, ako nijedan folder još ne postoji — potpuno nov deployment bez ijednog uploada).
5. Briše svaki datiran folder stariji od `BACKUP_RETENTION_DAYS` (podrazumevano 14).

## Podešavanje servera (jednom po serveru)

**Instalirati MongoDB Database Tools** (obezbeđuje `mongodump`/`mongorestore`) — ovo je OS-nivo paket, odvojen od svega u `package.json`, pošto komunicira direktno preko MongoDB wire protokola, ne preko Mongoose-a:

```bash
# Debian/Ubuntu
wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo tee /etc/apt/trusted.gpg.d/mongodb.asc
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-database-tools
```

Potvrditi sa `mongodump --version`.

**Podesiti env promenljive** u `.env` na serveru (videti `.env.example`):

```
BACKUP_DIR=/var/backups/estatic-lab
BACKUP_RETENTION_DAYS=14
```

Proveriti da `BACKUP_DIR` postoji i da je upisiv za korisnika koji pokreće cron job (skripta sama pravi datirane podfoldere, ali roditeljski folder mora već postojati i biti upisiv).

**Dodati cron unos** — noćni, van vršnog opterećenja termin, pokrenut kao isti korisnik koji vodi app (da vlasništvo fajlova odgovara svemu ostalom što app upisuje):

```bash
crontab -e
# Svake noći u 03:30 po serverskom vremenu:
30 3 * * * cd /path/to/estatic_lab && /usr/bin/npm run backup:daily >> /var/log/estatic-lab-backup.log 2>&1
```

Ovo je namerno **sistemski cron**, ne `node-cron` unutar app-a (za razliku od ostalih zakazanih poslova u `jobs/scheduler.js` — videti `10-logovi-i-revizija.md`). Raspored bekapa ne sme zavisiti od toga da li je app proces živ i zdrav — ako je app pukao, baš te noći i dalje želite da se bekap izvrši.

## Vraćanje (restore)

Za dati datiran folder bekapa, npr. `/var/backups/estatic-lab/2026-09-19/`:

```bash
# Baza — vraća u ono na šta pokazuje MONGO_URI. --drop zamenjuje postojeće
# kolekcije umesto da ih spaja sa novim podacima, što je skoro uvek ono što
# se želi kod restore-a.
mongorestore --uri="$MONGO_URI" --archive=/var/backups/estatic-lab/2026-09-19/db.gz --gzip --drop

# Uploadi — vraća images/ i videos/ nazad na mesto. UPLOAD_PUBLIC_PATH je
# podrazumevano src/public ako nije podešen (videti .env.example).
tar -xzf /var/backups/estatic-lab/2026-09-19/uploads.tar.gz -C "$UPLOAD_PUBLIC_PATH"
```

Vraćanje na drugi server (prava migracija, ne samo oporavak istog servera) radi na isti način — putanje unutar tarball-a počinju sa `images/...`/`videos/...`, ne apsolutnom putanjom originalnog servera, pa se čisto raspakuje u bilo koji `UPLOAD_PUBLIC_PATH`.

## Šta još nedostaje (Faza 2, još nije napravljena)

- **Kopije van servera (offsite)**: danas, bekap koji živi na istom disku kao baza koju bekapuje ne štiti od toga da taj disk/server potpuno otkaže. Sinhronizacija `BACKUP_DIR`-a na drugu lokaciju (drugi računar, montiran USB disk, `rclone` ka Google Drive-u, itd.) je prirodan sledeći korak, čim se Faza 1 potvrdi da radi ispravno nekoliko dana.
- **Vežbe vraćanja (restore drill)**: ništa od ovoga još nije isprobano na pravoj produkcijskoj bazi (komande za restore u ovom dokumentu su ispravna upotreba MongoDB Database Tools-a, ali "komande su ispravne" i "stvarno smo ovo jednom uradili" nisu isti nivo sigurnosti) — vredi uraditi pravu probu vraćanja u baciti-posle bazu pre nego što se na ovo osloni u pravoj hitnoj situaciji.
