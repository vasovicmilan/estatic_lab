# Estetik Lab — Poslovna logika, od početka do kraja

Ovaj dokument sistematski prolazi kroz svaki poslovni domen platforme: koji je bio stvarni poslovni problem, koji pristup je izabran (i zašto, uključujući alternative koje su razmotrene i odbačene), i tačno kako je rešenje implementirano. Cilj je da bude referenca na koju se možeš vratiti za bilo koji deo sistema bez potrebe da rekonstruišeš rezonovanje iz koda.

Redosled prati prirodan tok posla: prvo ko sme šta (korisnici/role), zatim šta se prodaje i kako (usluge, termini, paketi, prodavnica), zatim kako se to plaća i popust primenjuje (kuponi), zatim ko od toga zarađuje pored samog biznisa (partneri, zaposleni, isplate), zatim kako se sistem povezuje sa spoljnim svetom (Google Calendar, SrediMe) i komunicira sa ljudima (notifikacije), i na kraju kako sve to ostaje vidljivo, bezbedno i provereno (admin, logovi, testovi).

---

## 1. Korisnici, role i dozvole

**Poslovni izazov.** Platforma ima nekoliko suštinski različitih vrsta ljudi koji je koriste — klijenti, terapeuti, partneri koji dovode klijente, i vlasnik/administrator — svaki sa različitim pravima pristupa. Trebalo je rešenje koje ne zahteva pisanje novog koda svaki put kada se pojavi nova kombinacija ovlašćenja (npr. "menadžer prodavnice" koji sme da menja cene ali ne i da odobrava isplate).

**Pristup.** Razdvojen je **identitet** (Korisnik — nalog, prijava, kontakt podaci) od **profila** (Zaposleni, Partner — specijalizovane sposobnosti koje se dodaju na osnovni identitet) i od **Role** (koja određuje šta osoba sme). Rola je definisana kao lista granularnih **dozvola** (npr. `manage_coupons`, `manage_appointments_all`, `view_logs`), ne kao fiksni "tip korisnika" ušiven u kod.

**Zašto ovaj pristup.** Alternativa — hardkodovati "if (role === 'admin')" provere po celom kodu — bi značila da svaka nova kombinacija ovlašćenja (npr. rola koja sme da vidi finansije ali ne i da menja katalog) zahteva izmenu koda na desetinama mesta. Sa granularnim dozvolama, nova rola je samo nov red u bazi sa odgovarajućom listom dozvola — nula izmena koda.

**Kako je rešeno.**
- Jedna osoba može istovremeno biti i Zaposleni i Partner (npr. terapeut koji je i sam partner) — sistem to podržava bez konflikta jer su to odvojeni profili, ne uzajamno isključive role.
- Svaka rola ima **prioritet** (Admin > Zaposleni > Partner > Korisnik). Kada se neko unapredi u profil Zaposlenog ili Partnera, sistem menja njegovu Rolu **samo ako je nova rola viša po rangu** od trenutne. Ovo sprečava da unapređenje admina u partnera (npr. radi testiranja partnerskog programa) slučajno **degradira** njegov pristup — zadržava Admin rolu, dobija Partner profil ispod nje.
- Dozvole su definisane kao enum na nivou modela (`PERMISSIONS` u `role.model.js`) — jedini izvor istine koji koriste i middleware za proveru pristupa i admin forma za uređivanje rola, tako da se ne mogu slučajno dodeliti nepostojeće/pogrešno-otkucane dozvole.

---

## 2. Katalog usluga i proces zakazivanja

**Poslovni izazov.** Salon nudi tretmane koji dolaze u više varijanti (različita trajanja, broj seansi, cene za suštinski istu uslugu). Zakazivanje mora da spreči duplo zakazivanje istog terapeuta u isto vreme, mora da poštuje realno radno vreme svakog terapeuta, i mora da ostavi prostor za pripremu/čišćenje između termina — a da pritom klijent i dalje ima izbor da li želi konkretnog terapeuta ili "bilo koga slobodnog".

**Pristup.** Usluga → Varijanta (konkretna kombinacija trajanja/cene/broja seansi) → Termin, sa dostupnošću izračunatom u realnom vremenu iz radnog vremena terapeuta minus već zauzeti termini (uključujući termine sa SrediMe pijace, videti sekciju 13), sa ugrađenim baferom od 30 minuta sa obe strane svakog termina.

**Zašto ovaj pristup.** Bafer od 30 minuta nije proizvoljan broj — direktno odražava stvarnu potrebu (priprema prostora, aparata, čišćenje) i primenjuje se dosledno svuda gde se dostupnost računa, uključujući i eksterne SrediMe termine, tako da nema mesta gde bi se dva termina zakazana kroz različite kanale sudarila bez razmaka.

**Kako je rešeno.**
- Kada klijent ne bira konkretnog terapeuta, sistem **u trenutku kreiranja termina** (ne u trenutku prikaza dostupnosti) ponovo proverava ko je zaista slobodan — sprečava da dva klijenta koja vide isti slobodan termin istovremeno oba uspeju da zakažu (race condition zaštićena atomskim MongoDB transakcijama sa `findOneAndUpdate` uslovnim filterom, ne read-modify-save pristupom).
- Ako je slobodan **tačno jedan** terapeut, sistem ga automatski dodeljuje (nema stvarne odluke koja se odlaže). Ako su slobodna **dva ili više**, termin se namerno ostavlja nedodeljen — to je prava poslovna odluka i prepuštena je administratoru.
- **Plaćanje** ide na jedan od dva međusobno isključiva načina: normalna cena varijante (umanjena za kupon ako postoji) ili pokriveno postojećim paketom (bez nove naplate — trošak je već pokriven pri kupovini paketa). Termin plaćen paketom ne može istovremeno nositi svoj kupon jer nema nove naplate koju bi kupon uopšte umanjio.
- **Životni ciklus**: Na čekanju → Potvrđen → Završen (ili Odbijen / Otkazan / Nije se pojavio/la usput). Klijent otkazuje sopstveni termin samo do 24h unapred (štiti osoblje od otkazivanja u poslednji čas); osoblje/admin mogu otkazati bez tog ograničenja.
- **Preraspodela** (promena *ko* izvodi termin) i **pomeranje** (promena *kada*) su namerno odvojene akcije sa različitim ovlašćenjima. Pomeranje ima stepenasta pravila zavisno koliko je vremena ostalo do termina:

| Vreme do termina | Dozvoljeno |
|---|---|
| 24h+ | Bilo koji budući dan/vreme |
| 4–24h | Samo drugo vreme *istog* dana |
| <4h | Nije dozvoljeno (osim za administratora) |

- **Resursi sa ograničenim kapacitetom** (npr. ESMA aparat, sto) su modelovani kao poseban koncept — svaki resurs ima `capacity` (koliko istovremenih termina podržava), a neaktivan resurs se tretira kao kapacitet 0 svuda gde se dostupnost računa, na jednom mestu (`resource.service.js`), tako da usluga koja zavisi od resursa automatski postaje nedostupna za zakazivanje kad resurs padne van pogona.

---

## 3. Ručno kreiranje termina od strane osoblja

**Poslovni izazov.** Ne dolaze svi termini iz toka gde klijent sam zakazuje — walk-in klijenti, dobitnici nagradnih igara, pokloni. Ovi termini često imaju cenu koja se razlikuje od kataloške (npr. besplatno za dobitnika nagrade), a postojeći sistem kupona nije prirodno rešenje.

**Pristup i zašto.** Razmotrena su dva pristupa za "posebnu cenu": (1) kroz kuponski sistem, (2) direktan ručni unos cene, dostupan samo osoblju. Izabran je drugi, iz dva razloga: **matematički** — kupon umanjuje kataloušku cenu za procenat/fiksni iznos, ne zamenjuje je potpuno, pa ne bi mogao izraziti npr. "0 RSD" na čist način; **bezbednosno** — kupon je kod koji teoretski može biti ponovo iskorišćen ili procureti, dok ručna cena nikad ne napušta admin panel.

**Kako je rešeno.**
- Novi ulaz u sistem (`/admin/termini/rucno-kreiranje`) koristi **potpuno istu transakcionu logiku** kao javno zakazivanje (provera dostupnosti, resursa, sudara termina, auto-dodela terapeuta) — nije duplirana logika, samo je proširen postojeći `bookAppointment` sa opcionim `priceOverride` i `actorRole` parametrom.
- `priceOverride` je dozvoljen samo kada je `actorRole` "admin" ili "employee" (provereno na servisnom nivou, ne samo na nivou rute — odbrana u dubinu), i **isključuje** kupon i plaćanje paketom za taj termin.
- Termin kreiran ovako je označen (`manualBooking: true` u bazi) radi transparentnosti i izveštavanja — vidljivo na stranici detalja termina.
- Administrator može izabrati postojećeg registrovanog korisnika (kontakt podaci se automatski preuzimaju sa naloga) ili uneti podatke novog klijenta (kreira se gostinski nalog, isto kao kod javnog zakazivanja bez prijave).
- Za razliku od javnog zakazivanja, ovde je dozvoljen datum u prošlosti — za naknadno evidentiranje nečega što se već desilo.
- Trenutno ograničeno na administratora u praksi — zaposleni nemaju pristup `/admin` panelu uopšte (imaju svoj odvojeni portal), iako je servisni sloj već spreman za `actorRole: "employee"` ako se ikad odluči da im se ovo otvori.

---

## 4. Podsetnici pre termina

**Poslovni izazov.** Zaboravljeni termini znače izgubljeno vreme terapeuta koje se ne može nadoknaditi. Trebalo je automatsko podsećanje koje ne zavisi od toga da administrator ručno prati kalendar.

**Pristup.** Email podsetnik **24h** i **4h** pre početka, samo za **potvrđene** termine (termin na čekanju nije siguran, pa se ne podseća).

**Zašto ovaj pristup.** Razmotrena su dva načina provere "da li je vreme za podsetnik": usko vremensko poklapanje sa učestalošću cron zadatka (npr. cron svakih 15 min, provera "tačno u prozoru od 15 min"), ili širok prozor uz nezavisnu oznaku "već poslato" po terminu. Izabran je drugi — **otporniji na prekide rada servera**. Ako cron zadatak propusti nekoliko ciklusa (restart, deploy), sledeći ciklus uhvata sve zakasnele podsetnike umesto da ih trajno preskoči, jer guard polje (`reminder24hSentAt`/`reminder4hSentAt`), ne uskost prozora, sprečava duplo slanje.

**Kako je rešeno.**
- Cron proverava svakih 15 minuta (`src/jobs/appointment-reminder-jobs.js`), konfiguracija prozora u jednom fajlu (`src/config/reminder.config.js`) — dodavanje trećeg prozora (npr. 1h pre) je jedan red koda, bez izmene logike zadatka ili rasporeda.
- Email sadržaj uvek prikazuje **tačan datum/vreme**, ne relativnu tvrdnju ("sutra", "za par sati") — ostaje tačan i ako pošalje kasnije nego planirano.

---

## 5. Paketi sa više seansi

**Poslovni izazov.** Standardni wellness model cenovne politike — klijent koji plati unapred za više seansi dobija nižu cenu po seansi. Problem: kad se paket kupi kao bandl (posebno kada meša više različitih usluga), ne postoji direktan odgovor na pitanje "koliko *konkretno* ova jedna seansa zapravo vredi" — a taj odgovor je neophodan kasnije za obračun provizije zaposlenog (sekcija 8).

**Pristup.** U trenutku kupovine paketa, sistem **snima** (ne izračunava naknadno) dve stvari: tačnu normalnu cenu po seansi za svaku uključenu uslugu u tom trenutku, i stvarnu stopu popusta koju ceo bandl predstavlja u odnosu na zbir pojedinačnih cena.

**Zašto ovaj pristup.** Alternativa — izračunavati "vrednost seanse" naknadno na osnovu trenutnih cenovnika — bi bila netačna ako se cenovnik u međuvremenu promeni, i ne bi imala jasan odgovor za paket koji meša više usluga. Snimanje u trenutku kupovine čini ovo vremenski stabilnim zapisom, nezavisnim od budućih promena cenovnika.

**Kako je rešeno.**
- Pošto se kupovine paketa plaćaju van platforme (lično, transfer), **administrator** evidentira kupovinu nakon što je plaćanje primljeno, sa mogućnošću primene kupona pre finalizacije.
- Sistem prati po uslužnoj stavci unutar paketa: ukupno kupljeno, iskorišćeno, i trenutno rezervisano (zakazano ali nije završeno — vraća se nazad ako termin propadne).
- Otkazivanje kupovine paketa ispravno poništava sve vezano za nju, uključujući bilo koju već odobrenu partnerske proviziju (sekcija 7).

---

## 6. Prodavnica, proizvodi i porudžbine

**Poslovni izazov.** Pored usluga, prodaju se i fizički proizvodi — od sitnog potrošnog materijala do skupih aparata koji se ne mogu poslati standardnom poštom. Treba sistem koji radi za oba ekstrema bez posebnog koda za svaki.

**Pristup.** Proizvod → Varijacija (veličina/konfiguracija, svaka sa sopstvenom cenom i zalihom) → Korpa → Porudžbina sa definisanim životnim ciklusom, i eksplicitna podela dostave na **standardnu** (fiksna, automatski obračunata) i **teretnu** (veliki/teški artikli).

**Zašto ovaj pristup za dostavu.** Automatski obračun cene dostave za teretne artikle nije moguć bez stvarnog dogovora sa kurirskom službom — cena zavisi od konkretne isporuke. Umesto da se porudžbina finalizuje sa netačnom (ili nikakvom) cenom dostave, porudžbina sa bar jednim teretnim artiklom ide na **čekanje procene**: administrator ručno unosi stvarnu cenu, i tek tada klijent može da potvrdi porudžbinu putem linka poslatog na email.

**Kako je rešeno.**
- Gosti (neprijavljeni) mogu kompletirati kupovinu i potvrđuju porudžbinu putem sigurnog linka na email — nije potreban nalog.
- Životni ciklus: Na čekanju → U obradi → Poslato → Dostavljeno → **Završeno** (konačno, nema puta nazad ka otkazivanju/vraćanju/povraćaju novca odatle). Ova konačnost direktno određuje tajming partnerske provizije (sekcija 7).
- Usput moguće grane: Otkazana (pre slanja), Vraćena (nakon prijema), Povraćaj novca.
- Zalihe se umanjuju u trenutku plaćanja (checkout), a vraćaju automatski pri otkazivanju/vraćanju porudžbine (rezervisane količine se oslobađaju nazad na stanje).
- Svaka varijacija proizvoda ima sopstveni prag niskog stanja zaliha (`lowStockThreshold`, podrazumevano 5) — posebno po varijaciji jer aparat i sitan potrošni materijal za njega realno imaju vrlo različite pragove. Pad ispod praga pokreće Telegram/email upozorenje (sekcija 12).

---

## 7. Kuponi i popusti

**Poslovni izazov.** Isti sistem kodova za popust treba da opslužuje tri različita konteksta kupovine (zakazivanje, kupovina paketa, porudžbina iz prodavnice) — ali katalog prodavnice ide od sitnog potrošnog materijala do aparata vrednih nekoliko hiljada evra, pa isti procenat/iznos popusta retko ima smisla za sve.

**Pristup.** Zakazivanje i kupovina paketa dele **jedan zajednički deo** kupona (vrsta popusta, vrednost, ograničenja) — dosledno ponašanje bez obzira koje od to dvoje koristite. Porudžbine iz prodavnice su namerno **odvojene**: kupon ima poseban, **opcioni** deo posvećen isključivo artiklima.

**Zašto ovaj pristup.** Ako taj poseban deo za artikle nije eksplicitno podešen, kupon se **uopšte ne može iskoristiti** na porudžbini iz prodavnice — namerno restriktivan podrazumevani izbor. Alternativa (kupon automatski važi svuda ako nije eksplicitno ograničen) bi značila da referalni/promotivni kod napravljen za usluge slučajno postane iskoristiv i na skupom aparatu, sa neproporcionalnim popustom. Oba dela (usluge/paketi i artikli) mogu imati gornju granicu iznosa popusta — bitno posebno kod procentualnog popusta, gde razuman procenat za uobičajenu uslugu postaje neproporcionalno visok iznos na skupom artiklu.

**Kako je rešeno.**
- Kupon opciono nosi ograničenja: vremenski period važenja, maksimalan broj ukupnih upotreba i/ili po klijentu (bilo koje od njih može ostati neograničeno), i koje konkretne usluge/pakete/proizvode pokriva.
- Kupon može opciono biti povezan sa konkretnim Partnerom — ta veza je ono što razdvaja običan promotivni kod od pravog referalnog koda koji zarađuje proviziju (sekcija 8). Mehanika popusta je identična u oba slučaja.

### Kupon dobrodošlice

**Poslovni izazov.** Novi korisnici treba da dobiju podsticaj za prvu kupovinu, automatski, bez ručnog rada administratora po svakoj registraciji.

**Kako je rešeno.** Pri svakoj registraciji (lozinkom ili Google-om), korisnik automatski dobija email sa kodom **DOBRODOSLI10** (10% popusta na usluge/pakete, ne i na artikle). Kod je **zajednički** za sve nove korisnike — zaštita od višestrukog korišćenja od strane istog klijenta ide preko već postojećeg `maxUsesPerUser` ograničenja na samom kuponu (podrazumevano 1), umesto generisanja posebnog jedinstvenog koda po korisniku (jednostavnije, manje zapisa u bazi, ista zaštita). Kupon se kreira automatski, lenjo, pri prvoj registraciji ikada — samoispravljajući se ako se greškom obriše.

**Otkriven i ispravljen propust tokom rada:** Google prijava je ranije uopšte **ne slala nikakav email** (ni potvrdu, ni kupon), pošto Google email dolazi već verifikovan i stara logika je to tumačila kao "nema šta da se pošalje". Sada Google korisnici dobijaju posvećen "dobrodošli" email sa istim kuponom.

---

## 8. Partnerski / referalni program

**Poslovni izazov.** Partneri (spoljni saradnici) dovode klijente putem sopstvenih linkova i treba da zarade proviziju na ono što ti klijenti kupe — ali "kupe" pokriva tri suštinski različite vrste transakcija (zakazivanje, kupovina paketa, porudžbina) sa vrlo različitim stepenom "je li ovo zaista finalno" u trenutku kupovine.

**Pristup — pripisivanje referala.** Referalni kod u URL-u (bilo koje stranice, ne samo početne) se pamti za posetioca **30 dana**, bez obzira koliko drugih stranica pregleda ili da li kupuje odmah. Kod se automatski primenjuje kao popust u trenutku stvarnog zakazivanja/plaćanja — klijent ne mora ništa da pamti ili ponovo unosi.

**Zašto ovaj pristup.** 30-dnevni prozor odražava realno ponašanje kupca (razgleda, ode, vrati se kasnije) — kraći prozor bi partneru nepravedno oduzeo zasluge za spor, ali stvaran, put do kupovine.

**Izuzetak — opšti kontakt upiti.** Referal se pripisuje kontakt upitu samo kad je posetilac stigao na kontakt stranicu iz *konkretnog* razloga vezanog za taj referal (npr. link "kontaktirajte nas o ovom paketu"). Nepovezan, opšti upit ne nosi pripisivanje — štiti od toga da partner dobije zasluge za nešto što nema veze sa njegovim referalom.

**Pristup — tajming provizije po vrsti kupovine.** Svaka od tri vrste kupovine ima tajming prilagođen tome koliko je zaista **povratna**:

| Vrsta kupovine | Kad provizija postaje isplativa | Zašto |
|---|---|---|
| Zakazan termin | Čim je termin završen | Kad je usluga pružena, ništa je više ne može poništiti |
| Porudžbina iz prodavnice | Rezervisana 2 nedelje (standardni rok vraćanja), potom automatski isplativa — ili odmah ako porudžbina pre toga dostigne finalni status | Vraćanje/otkazivanje u tom periodu poništava proviziju |
| Kupovina paketa | Odmah | Plaćeno i evidentirano van platforme, nema šta da se još ospori |

**Zašto ovaj pristup.** Da provizija na porudžbini postane isplativa odmah pri kupovini, vraćanje artikla nekoliko dana kasnije bi značilo da je partner već "zaradio" novac koji biznis mora da povuče nazad — administrativno komplikovanije i rizičnije nego čekanje kroz prirodni rok vraćanja pre isplate.

**Kako je rešeno — dalji detalji.**
- Obični promotivni kod (bez veze sa partnerom) nikad ne generiše proviziju, bez obzira kako se koristi — samo pravi referalni kod to čini.
- Partner ima **dve nezavisne stope provizije** (usluge/paketi vs. artikli) plus opcionu gornju granicu provizije po transakciji — poslednja linija odbrane ako je stopa greškom postavljena previsoko za konkretan slučaj.
- Partnerska provizija i provizija zaposlenog na istom paketu su potpuno nezavisne (sekcija 9) — partner zarađuje jednom, na samu prodaju; zaposleni zarađuje odvojeno, kad stvarno obavi seansu.
- Partnerov panel: trenutno stanje + brz zahtev za isplatu, pretraživa istorija svake zarađene provizije (filtriranje po statusu/vrsti), istorija zahteva za isplatu, i "katalog" stranica koja svakoj usluzi/paketu/proizvodu automatski dodaje njegov lični referalni link, spreman za kopiranje.

---

## 9. Naknade zaposlenih

**Poslovni izazov.** Zaposleni na proviziji zarađuje procenat od onoga što obavi — jasno za normalno plaćen termin. Ali šta se dešava kad obavi seansu iz **već kupljenog paketa**, gde klijent ne plaća ništa novo u tom trenutku? Ni "puna cena usluge" ni "ništa" nisu tačan odgovor.

**Pristup.** Seansa pokrivena paketom se vrednuje **po istoj stopi popusta koju je klijent dobio na ceo paket**, primenjenoj na normalnu cenu te konkretne usluge.

**Zašto ovaj pristup.** Puna cena bi platila zaposlenom više nego što je biznis zaista naplatio za tu seansu (klijent je dobio bandl popust). Nula bi ostavila stvarno obavljen posao nenaknađenim. Pravedno rešenje: ista procentualna redukcija koju je biznis sam prihvatio kad je prodao paket.

**Kako je rešeno.**
- Pri kupovini paketa, sistem već zna normalnu (neumanjenu) vrednost svega uključenog i koliko je klijent zaista platio — to poređenje daje stvarnu stopu popusta paketa.
- Kad zaposleni obavi seansu, provizija se računa na normalnu cenu **te** seanse, umanjenu po **toj istoj** stopi.
- **Primer sa brojkama:** paket od 5 seansi po 3.000 RSD (15.000 RSD pojedinačno) prodat za 12.000 RSD = 20% popust na ceo bandl. Zaposleni sa 10% provizije koji obavi jednu seansu zarađuje na 3.000 × 0,8 = 2.400 RSD → 240 RSD provizije.
- Ovaj pristup prirodno radi i za pakete koji mešaju više različitih usluga — normalna cena svake usluge određuje njen pravedan udeo, skuplja uključena usluga se vrednuje više od jeftinije, obe umanjene po istoj ukupnoj stopi.
- Potpuno nezavisno od partnerske provizije — oba mogu da se prime na istom terminu bez konflikta (partner je zaradio kad je paket originalno prodat preko njegovog linka; zaposleni zarađuje odvojeno kad obavi seansu).

---

## 10. Isplate i stanja

**Poslovni izazov.** I partneri i zaposleni na proviziji akumuliraju zaradu koju treba pratiti i isplatiti — sa jasnim odgovorom u svakom trenutku na "koliko zaista mogu da povučem sada".

**Pristup.** Zajednički sistem za obe vrste zarade (partnersku i zaposlenu proviziju), zasnovan na tri broja izračunata **iz stvarnih, trenutnih podataka** u trenutku provere, ne kao tekući zbir koji bi mogao izgubiti sinhronizaciju:

- **Zarađeno** — ukupna akumulirana provizija.
- **Isplaćeno** — ukupno stvarno isplaćeno.
- **Rezervisano** — provizija odobrena ali još u periodu pregleda (npr. rok vraćanja porudžbine, sekcija 8).
- **Raspoloživo** = Zarađeno − Isplaćeno − Rezervisano.

**Zašto ovaj pristup.** Izračunavanje iz stvarnih podataka (a ne održavanje posebnog "trenutnog stanja" polja koje se ažurira pri svakoj transakciji) eliminiše čitavu klasu bagova gde bi stanje moglo da izgubi sinhronizaciju sa stvarnim zapisima zbog propuštenog ažuriranja negde u kodu.

**Kako je rešeno.**
- Zarada može zatražiti isplatu za bilo koji iznos do trenutno raspoloživog — sistem odbija zahtev za više.
- Administrator koji rešava zahtev može: **odobriti** (prihvaćen, u toku), **označiti kao isplaćen**, ili **odbiti** uz obrazloženje vidljivo zaradi.
- Odvojeno, administrator može **direktno evidentirati isplatu** bez čekanja zahteva — za slučajeve van uobičajenog toka (npr. gotovina lično predata).
- Zarada dobija email obaveštenje čim se status isplate promeni, uključujući razlog ako je odbijena — nikad ne ostaje u nedoumici.

---

## 11. Eksterne integracije — Google Calendar i SrediMe

**Poslovni izazov.** Biznis prodaje usluge i preko sopstvenog sajta i preko **SrediMe** (eksterna pijaca za zakazivanje u oblasti lepote). Bez koordinacije, isti termin bi mogao biti zakazan na oba mesta istovremeno za istog terapeuta, a nijedan sistem ne bi znao za onaj drugi.

**Pristup.** Umesto direktne integracije sa SrediMe-ovim sistemima, oba sistema prolaze kroz **Google Calendar** kao zajedničku, neutralnu tačku — jedan kalendar po zaposlenom. Dva pravca sinhronizacije rade **različitim mehanizmima**, jer SrediMe-ova sopstvena integracija je eksplicitno jednosmerna (čita eksterne kalendare, ne piše u njih).

**Zašto ovaj pristup.** Direktna integracija sa SrediMe API-jem bi zahtevala njihovu saradnju i održavanje posebne veze; Google Calendar kao posrednik je nešto što SrediMe već podržava nativno (import kalendara), pa nije potrebna nikakva koordinacija sa SrediMe stranom uopšte — samo jednom uneti generisani iCal link u SrediMe podešavanja.

**Kako je rešeno.**

**Smer 1 (platforma → Google Calendar → SrediMe):** Svaki termin dodeljen zaposlenom sa podešenim Google Calendar ID-jem se automatski upisuje kao događaj i ažurira kako termin menja status — kreira se pri dodeli, pomera pri promeni vremena, briše i ponovo kreira na drugom kalendaru pri preraspodeli (događaj se ne može "preneti", samo ponovo napraviti), briše pri otkazivanju/odbijanju (kalendar okrenut ka spolja ne treba da prikazuje zakazivanje koje nije uspelo), ostaje netaknut pri završavanju/no-show (istorijski zapis, uvek u prošlosti, nema rizika od dupliranja). Događaj traje 30 minuta duže od stvarnog kraja termina — isti bafer koji sistem interno već koristi. SrediMe zatim čita direktno iz tog kalendara preko iCal linka — potpuno na njihovoj strani, bez daljeg učešća platforme. Ako zaposleni nema podešen kalendar, ili je servis nedostupan, ništa od ovoga ne blokira sam termin — sinhronizacija je sporedni efekat, nikad preduslov.

**Smer 2 (SrediMe → platforma):** Svaki zaposleni može imati poseban **SrediMe ICS URL** (link koji SrediMe generiše za izvoz njihovih zakazivanja). Cron zadatak proverava taj feed **svakih 15 minuta** i kešira pronađene termine kao "zauzete" blokove — uparene sa prethodnim proverama (pomeranje ažurira postojeći unos), automatski uklonjene kad zakazivanje nestane iz feed-a (otkazivanje na SrediMe strani). Ovi keširani blokovi se tretiraju **potpuno isto** kao sopstveni termini platforme na dva mesta: pri prikazu dostupnih termina klijentu, i ponovo kao poslednja provera **u trenutku** stvarnog potvrđivanja novog zakazivanja (jer prikaz koji je klijent video može biti zastareo par minuta).

Poznato, uzano ograničenje: pri preraspodeli/pomeranju **postojećeg** termina, padajuća lista zaposlenih filtrira po istim SrediMe blokovima, ali sam upis te dve akcije ih ponovo ne proverava na isti način kao novo zakazivanje — vredi zatvoriti u budućnosti.

Periodična provera (umesto trenutne notifikacije od SrediMe-a) je namerni kompromis — mnogo jednostavnija i otpornija implementacija, po ceni prozora od najviše 15 minuta kašnjenja.

---

## 12. Notifikacije — email i Telegram

**Poslovni izazov.** Klijenti, osoblje, i administrator treba da znaju kad se nešto bitno desi — bez potrebe da neko ručno proverava stanje sistema.

**Pristup.** Dva kanala za dve različite publike: **email** za sve transakcione/lične notifikacije (klijent, zaposleni, partner), **Telegram** za operativna obaveštenja administratoru u realnom vremenu (nova prodaja, greška, nisko stanje zaliha).

**Kako je rešeno — email notifikacije klijentu/zaposlenom/partneru:**
- Nalog: potvrda registracije (sa kuponom dobrodošlice), dobrodošlica za Google prijavu (sa kuponom), preuzimanje gostinskog naloga, reset lozinke, promena lozinke, deaktivacija naloga.
- Termini: primljen, potvrđen, otkazan, **podsetnik** (24h/4h), promena statusa, preraspodela drugom zaposlenom (obaveštava novog terapeuta).
- Porudžbine: zahtev za potvrdu (gost), primljena, promena statusa (uključujući slanje, dostavu).
- Paketi: kupovina kreirana, kupovina otkazana.
- Isplate: promena statusa zahteva (partner i zaposleni).
- Newsletter: dobrodošlica pri prijavi, kampanje pretplatnicima.

**Kako je rešeno — email notifikacije administratoru:** nov termin, otkazan termin — sa direktnim linkom ka detaljima u admin panelu, i temom prefiksovanom kategorijom (npr. "[TERMIN] ...") za lako filtriranje/pretraživanje inboksa.

**Kako je rešeno — Telegram operativna obaveštenja:** nov termin, otkazan termin, promena statusa termina, preraspodela, nova porudžbina, otkazana porudžbina, promena statusa porudžbine, **nisko stanje zaliha** (po pragu specifičnom za varijaciju proizvoda), nov kontakt upit, nov testimonijal, novi korisnik, nova kupovina paketa — plus poseban kanal za **alarme o greškama** (sistemski izuzeci sa throttling-om protiv spam-a istom greškom).

**Zašto odvojen Telegram kanal za greške.** Operativna obaveštenja (nov termin) i alarmi o greškama imaju različitu hitnost i različitu publiku pažnje — administrator treba da vidi grešku odmah, ali ne treba da mu se prekine tok rada zbog svake rutinske prodaje. Throttling na alarmima o greškama sprečava da jedna greška koja se ponavlja (npr. pao eksterni servis) zatrpa Telegram sa identičnim porukama svake sekunde.

---

## 13. Sadržaj sajta

**Poslovni izazov.** Naslovna slika početne strane (hero) je bila hardkodovana u kodu — svaka promena zahtevala je izmenu koda i redeploy, iako je to čisto sadržajna, ne tehnička odluka.

**Pristup.** Novi, poseban, admin-uređiv `SiteSettings` model (singleton dokument), namerno **odvojen** od `business.config.js` koji ostaje statičan, kod-definisan izvor istine za identitet biznisa (naziv, adresa, radno vreme).

**Zašto ovaj pristup.** `business.config.js` je namerno statičan jer promena identiteta biznisa (adresa, naziv) je retka i po prirodi bliža kodu/deployu. Hero slika je sadržaj koji se realno menja sezonski/marketinški, i to od strane administratora bez tehničkog znanja — zaslužuje sopstveni, jednostavan admin ekran, spreman da se u budućnosti proširi (npr. sadržaj "O nama" stranice) bez potrebe za novim modelom.

**Kako je rešeno.** Admin forma (`/admin/sajt`) sa upload-om slike, koristeći isti mehanizam za obradu i skladištenje slika kao ostatak kataloga (kategorije, proizvodi). Ako nikad nije ručno postavljena, koristi se podrazumevana slika iz koda — nema praznog/pokvarenog stanja.

---

## 14. Admin operacije, logovi i revizija

**Poslovni izazov.** Administrator treba punu operativnu kontrolu — ali i pouzdan odgovor na pitanja poput "ko je promenio ovu cenu i kada", "da li je sajt danas normalno radio", ili "da li je ova akcija zaista uspela" — bez oslanjanja na pamćenje ili neformalne beleške.

**Pristup — dve odvojene vrste evidencije, za dve različite vrste pitanja:**

**Operativno izveštavanje** — kako sam sajt *funkcioniše* (saobraćaj, stopa uspešnih/neuspešnih zahteva, brzina odgovora). Dva oblika: pregled uživo za tekući dan, i pretraživa istorijska arhiva prethodnih dana za poređenje perioda i uočavanje obrazaca.

**Trag odgovornosti (audit log)** — koje su *poslovne* akcije preduzete od strane osoblja (kreiranje/izmena partnera, podešavanje naknade zaposlenog, odobravanje/odbijanje isplate, ažuriranje cene). Za svaku evidentiranu akciju: ko (i koju rolu je imao u tom trenutku), kada, **šta se tačno promenilo** (polje po polje, vrednost pre i posle), odakle (IP adresa, pregledač), i da li je uspela (sa razlogom ako nije).

**Zašto dve odvojene evidencije.** Ovo su fundamentalno različita pitanja sa različitim publikom (operativno izveštavanje zanima "da li sajt radi", audit log zanima "ko je šta uradio i zašto") — mešanje u jedan sistem bi otežalo pretragu za oba slučaja.

**Admin operacije — pregled.** Puna kontrola kataloga (usluge/varijante, paketi, proizvodi/varijacije, kategorije/tagovi, blog), puno upravljanje ljudima (korisnici, zaposleni sa naknadom/uslugama/radnim vremenom/kalendarom, partneri) sa zaštitom pri unapređenju (sekcija 1), puna vidljivost i kontrola nad terminima i porudžbinama (uključujući ručno kreiranje termina, sekcija 3), evidentiranje kupovina paketa, marketinški alati (kuponi, referalne veze, isplate), i sadržaj sajta (sekcija 13).

---

## 15. Bezbednost i infrastruktura

**Poslovni izazov.** Produkciona platforma koja obrađuje lične podatke i plaćanja treba da bude otporna na uobičajene napade bez oslanjanja isključivo na "security through obscurity".

**Kako je rešeno (kratak pregled — ne poslovna logika u strogom smislu, ali direktno štiti poslovanje):**
- **UFW firewall** ograničen na Cloudflare IP opsege — server nije direktno dostupan van Cloudflare-a.
- **Cloudflare Authenticated Origin Pulls (mTLS)** — server prihvata samo saobraćaj koji je zaista prošao kroz Cloudflare, ne bilo koji zahtev koji tvrdi da jeste.
- **CSRF sync sloj** na svim formama koje menjaju stanje.
- **Telegram bezbednosni alarmi** sa throttling-om protiv spam-a (sekcija 12).
- **Audit log** kao gore opisano — odvraća i otkriva zloupotrebu iznutra, ne samo napade spolja.

---

## 16. Testiranje

**Poslovni izazov.** Poslovna logika ovog obima (obračun provizije, validacija kupona, prelazi statusa, transakciona zaštita od duplog zakazivanja) mora ostati tačna kroz stalne izmene — greška u obračunu provizije direktno znači pogrešnu isplatu novca.

**Pristup — tri odvojena sloja, svaki proverava drugačiju stvar:**

| Sloj | Šta proverava | Alat |
|---|---|---|
| Jedinični (unit) | Pojedinačne servisne funkcije izolovano (baza mokovana) | Node ugrađeni test runner |
| Integracioni | Kontroler + validator + servis + repozitorijum zajedno, za dati HTTP zahtev | `supertest` + `mongodb-memory-server` |
| E2E | Stvaran tok kroz pravi pregledač i pravi server | Playwright + Chromium |

**Zašto sva tri, ne samo jedan.** Jedinični test dokazuje da obračun provizije daje tačan broj. Integracioni dokazuje da HTTP zahtev sa pogrešnim podacima vrati tačan status kod (a ne 500 gde treba 400, ili obrnuto — tiho progutana greška). E2E dokazuje da klijent *stvarno može* da završi kupovinu od početka do kraja kroz pravu formu, uključujući stvari koje samo pregledač radi (skrivena polja, JS vidžeti, sesijski kolačići).

**Trenutno stanje.** Preko 1700 jediničnih testova, sa finansijski najosetljivijim servisima (`commission.service.js`, `payout-request.service.js`, `resource.service.js`) na 100% pokrivenosti linija i funkcija. 23 E2E testa, po jedan (ili više) po ključnom poslovnom toku od početka do kraja — zakazivanje sa provizijom, kupon sa posebnim popustom za artikle, otkazivanje sa vraćanjem zaliha, kompletan ciklus isplate, i tako dalje.

---

## Kako se delovi uklapaju — brz pregled zavisnosti

```
Korisnici/Role (1)
   │
   ├─→ Usluge/Zakazivanje (2) ──→ Ručno kreiranje termina (3) ──→ Podsetnici (4)
   │         │
   │         └─→ Paketi (5)
   │
   ├─→ Prodavnica/Porudžbine (6)
   │
   ├─→ Kuponi (7) ←── koristi se u (2), (5), (6)
   │         │
   │         └─→ Kupon dobrodošlice (podsekcija 7)
   │
   ├─→ Partnerski program (8) ←── referalni kuponi iz (7), kupovine iz (2)/(5)/(6)
   │
   ├─→ Naknade zaposlenih (9) ←── seanse iz paketa (5)
   │
   └─→ Isplate (10) ←── zajedničko za (8) i (9)

Eksterne integracije (11) ←── nadovezuje se na životni ciklus termina (2)
Notifikacije (12) ←── prate skoro svaki događaj iz (2)–(10)
Sadržaj sajta (13), Admin/Logovi (14), Bezbednost (15), Testiranje (16) ── prožimaju sve gore navedeno
```

---

*Ovaj dokument odražava stanje sistema kroz zajedničku istoriju rada na projektu. Za tehničke detalje (nazivi fajlova, tačne putanje, konvencije koda) pogledaj `docs/sr/` — ovaj fajl namerno ostaje na nivou poslovnog rezonovanja, ne implementacije.*
