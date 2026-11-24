# Claude kao asistent: pristup preko API tokena

**Status: implementirano (faze 1 do 4).** Claude radi u produkciji kao poseban nalog sa sopstvenom rolom, preko API tokena koji ti praviš i opozivaš u panelu. Sve što pravi ili menja ostaje nacrt dok ga ti ne objaviš ili aktiviraš. Plan i obrazloženje su na kraju dokumenta.

## 1. Kako to radi, ukratko

- **Nalog + rola.** Napraviš običnog korisnika (npr. "Claude asistent") sa rolom **claude asistent**. To je nalog bez stvarne lozinke koju neko koristi.
- **Token.** U `/admin/api-tokeni` praviš token za taj nalog: naziv, oblasti, rok (1 do 90 dana). Tajna (`elk_...`) vidi se samo jednom, u bazi ostaje samo hash.
- **Claude** šalje `Authorization: Bearer elk_...` na `/api/v1/admin/*`.
- **Opoziv** je dugme u istom ekranu; radi odmah. Pored toga postoji prekidač **"Pauziraj sve tokene"** (blokira sve tokene odjednom, a tokeni ostaju sačuvani).

## 2. Šta Claude sme (i šta ne sme)

Tri nezavisna sloja; svaki mora da propusti zahtev.

1. **Dozvole role + oblasti tokena.** Efektivne dozvole su presek dozvola role i izabranih oblasti. Dozvole se čitaju **uživo iz role pri svakom zahtevu**, pa izmena role važi odmah.
2. **Allowlist ruta** (`api-token-guard.middleware.js`). Token sme samo rute navedene u tabeli ispod; sve ostalo je 403 i beleži se kao `API_TOKEN_DENIED`.
3. **Prinudni nacrti.** Server, a ne Claude, postavlja nacrt.

| Oblast | Dozvoljeno | Prinudno |
|---|---|---|
| `blog` | čitanje postova, pravljenje i izmena posta, upload slika (`/uploads/posts`, `/gallery`), čitanje kategorija i tagova | `status = draft`, bez zakazivanja. Izmena objavljenog posta ga skida sa sajta i vraća u nacrt |
| `catalog` | čitanje, pravljenje i izmena usluga, paketa i proizvoda; upload slika i galerije; čitanje kategorija, tagova i resursa | `isActive = false`. Izmena aktivnog artikla ga skida sa sajta dok ga ne aktiviraš |
| `materials` | čitanje, otpremanje i izmena materijala (PDF, katalozi, brošure do 25 MB) | `isActive = false` |

**Nikad, bez obzira na rolu:** brisanje bilo čega, objava i promena statusa posta, SEO polja (`/seo`), aktivacija, slanje i pravljenje newslettera, kuponi, korisnici, role, porudžbine, termini, isplate, kontakti, logovi, izveštaji, tekstovi i podešavanja sajta, pravljenje drugih tokena. Token važi samo na `/api/v1/admin/*` (ne na `/me`, `/employee`, `/partner`, korpi).

Čitanje ličnih podataka klijenata nije u allowlist-i: tekst u poljima koja piše bilo ko na internetu ne sme da stigne do asistenta kao instrukcija.

## 3. Ograničenja zahteva

Po tokenu (ne po IP adresi): 60 zahteva u minuti, 20 izmena u minuti, 200 izmena na dan. Menja se u `.env`: `RATE_LIMIT_TOKEN_MAX`, `RATE_LIMIT_TOKEN_WRITE_MAX`, `RATE_LIMIT_TOKEN_WRITE_DAY_MAX`.

## 4. Revizija

Svaka akcija ide u `/admin/logovi/audit` sa nalogom i oznakom `[api-token:<naziv tokena>]`. Posebne akcije: `API_TOKEN_CREATED`, `API_TOKEN_REVOKED`, `API_ACCESS_PAUSED`, `API_ACCESS_RESUMED`, `API_TOKEN_DENIED` (pokušaj van opsega). Filter "uloga" ima stavku "Claude asistent".

## 5. Uvođenje, korak po korak

1. Postavi izmene na server (`rsync`), pa `pm2 restart estetik-lab`.
2. Napravi rolu (idempotentno; vraća i menadžer role na podrazumevane definicije):
   `node src/database/seeds/run-roles-seed.js`
3. U `/admin/korisnici` napravi korisnika (npr. `claude@beautymedica.rs`), rola **claude asistent**, jaka nasumična lozinka koju nigde ne koristiš.
4. U `/admin/api-tokeni` napravi token: oblasti koje ti trebaju, rok (preporuka 7 do 30 dana). Kopiraj tajnu.
5. Tajnu predaj kao **tajnu promenljivu okruženja** u podešavanjima sesije, a ne u tekstu četa.
6. U podešavanjima mreže dodaj `beautymedica.rs` u dozvoljene domene. Ako Cloudflare ima WAF ili zaštitu od botova, dozvoli putanju `/api/v1/admin/*` sa zaglavljem `Authorization`.
7. Probaj na jednom nacrtu bloga; proveri ga u `/admin/blog` i u logu.

## 6. Kako Claude koristi API (osnovno)

- Slika: `POST /api/v1/admin/uploads/posts` (ili `products`, `services`, `packages`), multipart, polje `file`; vraća `{ img, imgDesc, ... }` koje se ubacuje u telo posta/artikla.
- Post: `POST /api/v1/admin/posts`, `PUT /api/v1/admin/posts/:id` (uvek završava kao nacrt).
- Materijal: `POST /api/v1/admin/materials`, multipart: `file` + `title` + `description`. Izmena fajla: `PUT /api/v1/admin/materials/:id`.
- Usluge, paketi, proizvodi: isto kao ostali admin API (`docs/sr/15`), uvek sa `isActive = false`.

## 7. Šta ti radiš posle

Pregledaš nacrte i objaviš ili aktiviraš: blog u `/admin/blog`, usluge/pakete/proizvode u njihovim listama, materijale u `/admin/materijali`. Ništa što je Claude uradio ne dolazi do posetilaca bez tvog klika.

## 8. Poznata ograničenja

- Izmena aktivne usluge, paketa ili proizvoda je skida sa sajta dok je ne vratiš (tako je dogovoreno: sve što Claude dotakne ti potvrđuješ). Za sitnu ispravku to znači kratko isključenje; ako to smeta, ispravku radi sam.
- Tekstovi i podešavanja sajta, kampanje, kuponi i SEO polja nisu u opsegu (nemaju koncept nacrta).
- Brojači ograničenja su u memoriji procesa; restart `pm2` ih briše.
- Token ne zamenjuje reviziju: Claude može da napiše pogrešan sadržaj, zato je sve nacrt.
