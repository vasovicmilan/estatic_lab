# Marketing: SEO, blog, AI optimizacija i email kampanje

Ovaj fajl objašnjava **marketinški sloj platforme**: kako sajt postaje vidljiv u pretrazi (SEO), kako ga razumeju AI asistenti i odgovarajući pretraživači (AI SEO), čemu služi blog, i kako newsletter i automatski mejlovi vraćaju klijente. Za svaki deo je navedeno **šta sistem radi, zašto je tako rešeno i šta se time dobija**. Isto kao i ostala dokumentacija, ovde su i poznata ograničenja, bez uvijanja.

Marketing nije poseban modul sa sopstvenim zastavicama: SEO i newsletter rade u svakoj instanci, a blog je modul `blog` (videti `16-modularni-feature-flagovi.md`). Kad je modul isključen, njegove stranice vraćaju 404, ne ulaze u `sitemap.xml` i ne pominju se u `llms.txt`.

## Cela slika u jednoj tabeli

| Cilj | Šta sistem radi | Gde |
|---|---|---|
| Da ih pretraga nađe | Svaka stranica ima naslov, opis, canonical adresu, Open Graph/Twitter kartice i strukturirane podatke (JSON-LD) | `src/seo/` |
| Da pretraga zna šta postoji | `sitemap.xml` se generiše iz baze, `robots.txt` se generiše iz uključenih modula | `sitemap.service.js`, `seo.controller.js` |
| Da ih razumeju AI asistenti | `llms.txt` (generisan iz baze) + isti strukturirani podaci + otvoren `robots.txt` | `llms-txt.service.js` |
| Da se redovno objavljuje sadržaj | Blog sa zakazanom objavom, blokovskim uređivačem, FAQ blokovima, kategorijama i tagovima | `post.model.js`, `post-jobs.js` |
| Da se klijent vrati | Newsletter sa segmentima, zakazane kampanje, mejl dobrodošlice i podsetnici korpe | `campaign.service.js`, `news-letter.service.js`, `cart-reminder-jobs.js` |
| Da se preporuka isplati | Partnerski program (opisan odvojeno u `06-partnerski-program.md`) | |

## 1. SEO (klasična pretraga)

### Šta svaka stranica dobija

Za svaku vrstu sadržaja (usluga, paket, proizvod, blog objava, kategorija, tag, stručnjak, statična stranica) postoji poseban "builder" u `src/seo/builders/`. Svi daju isti oblik rezultata:

- **Naslov** sa nazivom sajta kao sufiksom (bez dupliranja ako ga naslov već sadrži) i **opis** skraćen na dužinu koju pretraga prikazuje.
- **`robots` oznaka po stranici**: `index, follow`, ili `noindex, follow` ako je sadržaj označen kao neindeksiran (`isIndexable`).
- **Canonical adresa** i **Open Graph / Twitter kartice** (slika, naslov, opis), tako da deljenje na društvenim mrežama izgleda ispravno.
- **Strukturirani podaci (JSON-LD)**, ali samo oni koji stvarno odgovaraju stranici (tabela ispod).

| Stranica | Strukturirani podaci |
|---|---|
| Svaka stranica | Podaci o firmi: tip `HealthAndBeautyBusiness` (sa zakazivanjem), `Store` (samo prodavnica) ili `Organization`; adresa, kontakt, logo i **radno vreme** |
| Usluga | `Service` sa po jednom ponudom (`Offer`, cena i valuta) za svaku aktivnu varijantu, FAQ (`FAQPage`) i putanja `BreadcrumbList` |
| Paket, proizvod | `Product` sa brendom i ponudom (`Offer`, cena i valuta); paket dodatno ima FAQ (`FAQPage`) |
| Početna | `WebSite` sa poljem za pretragu (`SearchAction`) |
| Blog objava | `BlogPosting` (autor, datum objave i izmene), FAQ izvučen iz blokova sadržaja, putanja |

### Odluke koje stoje iza toga

**Ocene i recenzije su na firmi (`provider`), ne na usluzi.** Googleov alat za prikaz zvezdica u rezultatima priznaje samo ograničen spisak tipova (npr. lokalni biznis, proizvod), a `Service` nije na njemu. Zato se prosečna ocena i recenzije iz odobrenih utisaka klijenata (`testimonial`) pišu na `HealthAndBeautyBusiness` unutar usluge. Isti podaci, ali u obliku koji pretraga zaista može da prikaže. Utisak postaje javan tek kad ga admin odobri i kad je klijent dao izričit pristanak.

**Radno vreme dolazi iz podešavanja, a ne iz koda.** Ako je admin podesio stalni raspored salona (`/admin/sajt`), taj se koristi. Ako nije, radno vreme se izvodi iz smena zaposlenih. Bez modula zakazivanja ne postoje smene, pa se radno vreme tada ne objavljuje.

**Prazna polja se izostavljaju, ne šalju se prazna.** Dok PIB ili matični broj nisu dodeljeni, uopšte se ne pojavljuju u strukturiranim podacima. Alati za proveru označavaju prazna polja kao grešku, a odsutno polje je ispravan način da se kaže "nije primenljivo".

**Jedan izvor istine za adresu sajta.** Ranije su statične stranice imale canonical bez `www`, a stranice usluga sa `www`, zavisno od toga na koju adresu je posetilac stigao, pa je pretraga videla duplirane stranice. Sada obe putanje koriste `BUSINESS.siteUrl` (`business.config.js`), pa canonical uvek ima istu adresu.

**Statične stranice se uređuju iz admin panela.** Za 13 stranica (početna, usluge, paketi, prodavnica, blog, naš tim, saradnici, kontakt, o nama, FAQ, politika privatnosti, uslovi korišćenja, partnerski program) admin menja naslov, opis i "ne indeksiraj" bez izmene koda. Prikazuju se samo stranice uključenih modula.

### `sitemap.xml` i `robots.txt`

- **`sitemap.xml` se pravi iz baze pri svakom zahtevu** (`sitemap.service.js`), pa ne može da zastari: nova usluga, proizvod ili objava je u njemu čim je aktivna. Unosi za usluge, pakete, proizvode, objave, stručnjake i saradnike imaju `lastmod` iz stvarnog datuma poslednje izmene. Kategorije i tagovi **nemaju** `lastmod`, jer dodavanje proizvoda u kategoriju ne menja sam dokument kategorije, a izmišljen datum bi pretrazi slao lažan signal.
- **`robots.txt` se pravi iz uključenih modula** (`buildRobotsTxt`). Uvek zabranjuje `/admin`, `/nalog`, `/moj-nalog` i `/newsletter/odjava`. Putanju `/zakazivanje` zabranjuje samo kad je zakazivanje uključeno. Ta stranica nije sadržaj nego stanje jednog zakazivanja, sa beskonačno mnogo varijanti kroz parametre. Roboti su na njoj trošili stvaran budžet pretraživanja (oko 2000 poseta za dva meseca u pristupnim logovima), a nema šta da se indeksira.
- **Stranice sa ličnim ili privremenim stanjem su `noindex`**: koraci zakazivanja, rezultati pretrage bloga i stranica uputstava (`/uputstva`).
- **Stari linkovi se ne gube.** Tabela preusmerenja (`Redirect`) omogućava da obrisana ili preimenovana stranica vodi trajnim preusmerenjem (301) na novu, ili da vrati 410 "trajno uklonjeno". 410 je bolji od običnog 404 za adresu koja je ranije bila indeksirana, jer pretrazi kaže da je zaboravi umesto da je stalno proverava.

### Šta se time dobija

Stranica koja se pojavi u pretrazi izgleda uredno (naslov, opis, zvezdice, cene, radno vreme), ne konkuriše samoj sebi (canonical), ne troši budžet pretraživanja na beskorisne stranice (`robots.txt`) i ne ostavlja mrtve linkove (`sitemap.xml` + preusmerenja). Sve to ostaje tačno kad se katalog menja, jer se izvodi iz podataka, a ne piše ručno.

## 2. AI SEO (da sajt razumeju AI asistenti)

AI asistenti i pretraživači koji odgovaraju punim rečenicama ne čitaju sajt kao čovek. Traže **činjenice koje mogu da citiraju**: šta firma nudi, po kojoj ceni, gde se nalazi, kad radi i šta kažu klijenti. Platforma te činjenice daje na tri mesta:

1. **`/llms.txt`** je običan markdown indeks namenjen jezičkim modelima (format `llmstxt.org`): opis firme, kontakt, spisak usluga (do 100) sa opisom, paketi sa cenom, kategorije prodavnice, deset najnovijih članaka i ključne stranice. **Generiše se iz baze** pri svakom zahtevu, kao i `sitemap.xml`, pa ne može da zastari. Opis firme prati uključene module, pa instanca samo sa prodavnicom ne tvrdi da nudi online zakazivanje. Cela sekcija isključenog modula se izostavlja, ne ostavlja se prazan naslov sa mrtvim linkom.
2. **Strukturirani podaci** iz prethodne sekcije: cene po varijanti, ocene, radno vreme, adresa i FAQ. To su isti podaci koje asistent traži kad odgovara na "koliko košta..." ili "da li rade u subotu...".
3. **`robots.txt` ne zabranjuje nijednog robota** (`User-agent: *`, `Allow: /`). Sajt je svesno otvoren i za AI pretraživače, jer je vidljivost u njihovim odgovorima cilj. Zabranjeni su samo delovi koji ni ljudima ne treba da budu javni.

**FAQ je glavni "citabilni" oblik.** Usluge imaju sopstvena pitanja i odgovore, a u blog objavama se FAQ blok iz uređivača automatski pretvara u `FAQPage` strukturirane podatke. Pitanje i odgovor su u formi koju asistent može doslovno da prenese.

**Šta sistem NE radi, i šta ne obećava.** Ne meri se da li i koliko često asistenti citiraju sajt. Nema praćenja AI pojavljivanja, a prepoznavanje robota po User-Agent-u (`bot-detection.util.js`) služi samo tome da se robotima ne prave sesije, ne za statistiku. Nijedan asistent ne garantuje da koristi `llms.txt`, pa je to jeftin, održiv signal, ne zagarantovan kanal. Pravi efekat se vidi tek kad se uvede merenje, na primer pitanja klijentima "kako ste nas našli" ili pregled posećenosti po izvoru.

## 3. Blog

Blog je modul `blog` i ima tri uloge: redovan sadržaj koji pretraga voli, odgovori na pitanja klijenata (i izvor za AI odgovore, vidi gore) i tema za newsletter.

**Šta objava ima** (`post.model.js`):

- **Životni ciklus:** nacrt, zakazana, objavljena, arhivirana. Zakazana objava mora imati budući datum, a posao koji radi na svakih 5 minuta (`post-jobs.js`) je prebacuje u objavljenu kad datum stigne. Prelaz se upisuje u dnevnik revizije kao radnja sistema, kao i ručna promena statusa. Sadržaj se tako priprema unapred, a objavljuje se kad treba, bez dežurstva.
- **Blokovski uređivač** umesto jednog polja sa tekstom: pasus, naslov, slika, galerija, citat, lista, video, tabela, kartice, obaveštenje, **FAQ**, dugme, razdelnik i reference na usluge i proizvode. Struktura je nešto što pretraga i AI asistenti mogu da razumeju (naslovi, pitanja i odgovori), a ne zbijen HTML.
- **Vreme čitanja** se računa automatski (oko 200 reči u minuti) pri svakoj izmeni sadržaja.
- **Naslovna slika je obavezna.** Bez nje objava nema valjanu Open Graph karticu pri deljenju.
- **SEO polja po objavi:** sopstveni naslov, opis (do 160 znakova), ključne reči i "ne indeksiraj". Ako SEO naslov nije unet, koristi se naslov objave.
- **Isticanje i brojač pregleda:** objave se mogu istaći (sa sopstvenim redosledom), a pregledi se broje, pa se mogu prikazati najčitanije.
- **Kategorije i tagovi** su zajednički za usluge, proizvode i objave (razdvojeni po domenu), a njihove arhive su u `sitemap.xml`. Autor se piše kao `Person` u strukturiranim podacima, a bez autora kao organizacija.

**Zašto zakazivanje i blokovi:** blog koji se objavljuje u naletima pa utihne ne pomaže u pretrazi, a admin koji mora da bude pred računarom u 9h da klikne "objavi" neće to raditi dugo.

## 4. Newsletter i kampanje

### Prijava, pristanak i odjava

- Posetilac se prijavljuje formom u podnožju ili preko JSON API-ja, sa izborom **interesovanja**: opšte (`general`), proizvodi (`products`) i partnerstvo (`partnership`). Prijava bez izbora dobija `general`.
- **Dokaz pristanka.** `consentedAt` se upisuje jednom, pri prvoj prijavi, i nikad se ne prepisuje. To je trajan odgovor na pitanje "kad je ova osoba prvi put pristala", koje bi postavio zahtev vezan za zaštitu podataka. `subscribedAt` se, za razliku od njega, menja pri svakoj ponovnoj prijavi.
- Ponovna prijava **spaja** interesovanja, ne prepisuje ih, pa dodavanje "proizvoda" ne briše raniji izbor.
- Svaki mejl sadrži **link za odjavu sa jedinstvenim tokenom** (`/newsletter/odjava/:token`). Odjavljeni pretplatnik se ne briše, nego dobija status `unsubscribed`, tako da se vidi da ne sme da dobije kampanju. Odjava ne traži prijavu.
- Pri prijavi se odmah šalje **mejl dobrodošlice**.

### Kampanje (`campaign.service.js`)

Admin pravi kampanju u istom blokovskom uređivaču: naslov, pasus, slika, dugme, **referenca na uslugu**, **referenca na proizvod** i razdelnik. Reference su zgodne jer kampanja povlači ime, sliku i link iz kataloga. Relativni linkovi se pri slanju pretvaraju u apsolutne, jer ih mejl klijent ne bi razrešio.

- **Ciljanje:** po interesovanjima. Prazan izbor znači **svi aktivni pretplatnici**.
- **Statusi:** nacrt, zakazana, u slanju, poslata, neuspela. Zakazana kampanja mora imati budući datum. Može se i odmah poslati ("Pošalji sada").
- **Zakazano slanje** radi posao na svakih 5 minuta (`campaign-jobs.js`).
- **Nema dvostrukog slanja.** Posao prvo atomski "preuzme" kampanju (zakazana → u slanju), pa samo jedan od dva preklopljena ciklusa može da je pošalje. Ako slanje pukne (npr. mejl provajder ne radi), kampanja prelazi u **neuspela**, a ne vraća se u red za ponovni pokušaj: automatsko ponavljanje bi ponovo slalo onima koji su poruku već dobili. Admin se obaveštava preko Telegrama.
- **Poslata kampanja se ne menja i ne briše.** To je istorijski zapis onoga što je stvarno otišlo. Čuvaju se broj poslatih i neuspelih mejlova, a svako slanje ostaje u dnevniku revizije (`CAMPAIGN_SENT`), i ručno i zakazano (sa akterom "sistem").

### Automatski mejlovi koji vraćaju klijenta

| Mejl | Kada | Šta nudi |
|---|---|---|
| Dobrodošlica korisniku | Pri registraciji | Kupon `DOBRODOSLI10`: 10% na usluge i pakete, jednom po korisniku (kreira se sam) |
| Podsetnik korpe, korak 1 | Korpa nepromenjena 24h | Samo podsetnik, bez popusta |
| Podsetnik korpe, korak 2 | Korpa nepromenjena 72h | Kupon `VRATISE10` (10%) |

Podsetnici korpe rade samo uz modul prodavnice, svako jutro u 7:30 i 7:40 (po vremenskoj zoni salona, ne servera), da mejl ne stigne u 3h ujutru samo zato što je baš tada korpa prešla prag. Sledeći popust za istu osobu moguć je tek posle 90 dana, da popust ne postane navika. Svaka promena korpe vraća brojač na početak, pa se ponovno napuštanje računa kao nova epizoda. Izvor svih konstanti je `marketing.config.js` i `cart-reminder.config.js`.

## 5. Šta ovo daje poslovno (zbirno)

| Odluka | Razlog | Korist |
|---|---|---|
| SEO se izvodi iz podataka, ne piše ručno | Katalog se stalno menja | Nema zastarelih naslova, cena ni linkova |
| Ocene na firmi, ne na usluzi | Pretraga prikazuje zvezdice samo za određene tipove | Zvezdice u rezultatima |
| `robots.txt` zabranjuje stranice sa stanjem | Beskonačne varijante troše budžet pretrage | Pretraga stiže do stvarnog sadržaja |
| `llms.txt` + JSON-LD + otvoren `robots.txt` | AI asistenti traže činjenice koje mogu da citiraju | Šansa da se firma pominje u AI odgovorima |
| Blog sa zakazanom objavom | Redovnost je važnija od brzine | Stalan sadržaj bez dežurstva |
| Segmenti i jedan klik odjave | Pošiljalac ne sme da zatrpava one koje tema ne zanima | Manje odjava, uredan pristanak |
| Atomsko preuzimanje kampanje, bez automatskog ponavljanja | Dvostruko slanje je gore od propuštenog | Niko ne dobija istu poruku dvaput |
| Podsetnik pa popust, sa pauzom od 90 dana | Popust se ne deli svakome i stalno | Povraćaj korpi bez navikavanja na popust |

## Poznata ograničenja

- **Nema statistike kampanja.** Ne beleže se otvaranja ni klikovi, samo broj poslatih i neuspelih. Ne zna se koja tema radi bolje, pa se odluke o sadržaju donose po utisku ili po poslovnim izveštajima (prodaja, kuponi), ne po odzivu na mejl.
- **Slanje je jedan po jedan,** redom, bez grupisanja. Za stotine pretplatnika je to u redu, za desetine hiljada bi trebalo grupisanje i ograničenje brzine kod provajdera.
- **Nema zasebnog "double opt-in" potvrđivanja** adrese. Prijava važi odmah, a dokaz je `consentedAt`. Ako pravni savet traži potvrdu putem mejla, to je novi korak.
- **AI efekat nije izmeren** (vidi sekciju 2).
- **Strukturirani podaci i `robots.txt` pregledani su po modulima** (tip firme, `Disallow` za zakazivanje), ali nisu provereni spoljnim alatom za validaciju posle svake izmene. Vredi povremeno proveriti ključne stranice u Googleovom testu bogatih rezultata.
- Pravni tekstovi (politika privatnosti, uslovi) su polazna tačka i moraju ih pregledati pravnik, posebno deo o newsletter-u i kolačićima.
