# Usluge, Zakazivanje i Termini

## Katalog usluga

**Usluga** je tretman koji poslovanje nudi (vrsta masaže, tretman lica, tretman na aparatima, itd.). Svaka Usluga može imati više **varijanti** — različita trajanja, različit broj seansi, različite cene za suštinski isti tretman. Klijent koji zakazuje uslugu uvek bira konkretnu varijantu, ne samo uslugu samu po sebi.

## Proces zakazivanja

Zakazivanje je vođen proces u tri koraka:

1. **Izbor varijante** usluge koju klijent želi.
2. **Izbor termina** — bilo sa konkretnim zaposlenim, ili prepuštajući sistemu da izabere prvog dostupnog kvalifikovanog za tu uslugu.
3. **Potvrda kontakt podataka**, i opciono primena koda za popust u ovom trenutku.

Dostupnost termina se računa na osnovu radnog vremena svakog zaposlenog, umanjeno za termine koje već ima zakazane, sa ugrađenim razmakom od 30 minuta sa obe strane svakog postojećeg termina, tako da zakazivanja jedno za drugim ne kolidiraju bez prostora za pripremu ili čišćenje. Isti ovaj proračun uzima u obzir i termine koji stižu preko SrediMe-a, eksterne pijace za zakazivanje na kojoj je poslovanje takođe prisutno — pogledajte `11-eksterne-integracije.md` za detalje te sinhronizacije.

> Brojevi navedeni u ovom dokumentu (30 minuta razmaka, 24 sata rok otkazivanja, itd.) su **podrazumevane vrednosti** — admin ih može promeniti u bilo kom trenutku kroz `/admin/sajt` (Politika zakazivanja), bez izmene koda ili restart-a servera. Videti `09-admin-operacije.md`.

### Politika zakazivanja — šta admin podešava

Sve vrednosti ispod se menjaju u `/admin/sajt` (sekcija **Politika zakazivanja**), važe odmah (bez restarta) i imaju podrazumevanu vrednost koja važi dok se ne promene:

| Podešavanje | Podrazumevano | Šta radi |
|---|---|---|
| Razmak između termina (`bufferMinutes`) | 30 min | Rezervisano pre i posle svakog termina za pripremu/čišćenje |
| Korak ponuđenih termina (`slotGridMinutes`) | 30 min | Na kojim razmacima se nude termini: 15 min, 30 min, 45 min ili 1 sat (09:00, 10:00…). Dozvoljeno je 5–240 min; vrednost 0 se odbija jer bi zaglavila generisanje termina |
| Minimalna najava za novo zakazivanje (`bookingMinLeadMinutes`) | 60 min | Termin koji počinje ranije od „sada + najava" se ne nudi i server ga odbija pri zakazivanju. U 11:51 sa najavom od 60 min prvi ponuđeni termin je 13:00 (12:51 zaokruženo na mrežu). Administrator i zaposleni pri ručnom kreiranju termina su izuzeti |
| Rok za samostalno otkazivanje (`userCancellationCutoffHours`) | 24 h | Koliko unapred klijent sme sam da otkaže |
| Rok za pomeranje / prag istog dana (`rescheduleCutoffHours`, `rescheduleSameDayFloorHours`) | 24 h / 4 h | Videti „Izmena postojećeg termina" |
| Minimalna najava za novo vreme (`rescheduleMinLeadMinutes`) | 30 min | Isto pravilo kao najava iznad, ali za **pomeranje** postojećeg termina |

Minimalna najava je računanje sa trenutkom (instant), pa ne zavisi od vremenske zone ni od prelaska na letnje/zimsko računanje vremena. Ista provera se radi na dva mesta — pri izradi liste slobodnih termina i pri samom upisu — da stara otvorena stranica ili ručno sastavljen zahtev ne bi mogli da zakažu prekasan termin.

Kada klijent ne zahteva konkretnog zaposlenog, sistem dodeljuje prvu zaista dostupnu osobu za tu uslugu u trenutku zakazivanja — proveravano u tačnom trenutku kreiranja termina, tako da dva klijenta koja zakazuju isti termin u isto vreme ne mogu oba uspeti i završiti sa duplim zakazivanjem. Ako je dostupno više od jednog zaposlenog, termin se namerno ostavlja nedodeljen umesto da se nasumično bira, tako da tu odluku donosi administrator.

## Šta zakazivanje košta

Zakazani termin se naplaćuje na jedan od dva načina, i uvek samo jedan od njih za bilo koji termin:

- **Normalno plaćen** — cena varijante navedena u cenovniku, umanjena za kod za popust ako je primenjen.
- **Pokriven postojećim paketom** — ako klijent poseduje ranije kupljen paket sa više seansi koji uključuje ovu uslugu, može iskoristiti jednu od preostalih seansi umesto ponovnog plaćanja. U ovom slučaju nema nove naplate za sam termin — trošak je već pokriven prilikom kupovine paketa.

Ova dva puta se međusobno isključuju po dizajnu: termin plaćen paketom ne može *takođe* nositi sopstveni odvojeni kod za popust, pošto nema nove naplate koju bi kupon uopšte mogao da umanji.

Na koraku sa kontakt podacima, „Pregled termina" odmah prikazuje cenu, popust kupona i **ukupnu cenu** čim se kupon primeni ili ukloni (isto kao „Vaša porudžbina" u prodavnici). Server svakako računa konačnu cenu sam (`finalPrice`), pa prikaz služi samo kao pregled. Termin se u adminu i u nalogu klijenta prikazuje kao **naziv usluge** u jednom redu i **varijanta** u drugom (ranije se videla samo varijanta).

## Životni ciklus termina

Termin prolazi kroz definisan skup faza:

- **Na čekanju** — zakazan, čeka potvrdu.
- **Potvrđen** — prihvaćen od strane zaposlenog ili admina.
- **Završen** — termin se odigrao. Ovo je i trenutak kada bilo koja provizija vezana za termin postaje isplativa (pogledajte `07-naknade-zaposlenih.md` i `06-partnerski-program.md`).
- **Odbijen** — odbijen pre nego što se odigrao.
- **Otkazan** — otkazan. Klijent koji otkazuje sopstveni termin je ograničen rokom od 24 sata unapred, što štiti osoblje od otkazivanja u poslednjem trenutku; osoblje i admin mogu otkazati termin u ime klijenta bez tog ograničenja.
- **Nije se pojavio/la** — termin je bio potvrđen, ali klijent nikada nije došao.

**Ponovno otvaranje** otkazanog, odbijenog ili „nije se pojavio" termina vraća ga u „Na čekanju", ali samo ako su terapeut i resursi u tom terminu u međuvremenu ostali slobodni — proverava se pre bilo kakve izmene (uključujući sesiju iz paketa). Inače se otvaranje odbija sa porukom, umesto da napravi dvostruko zakazivanje.

Ko sme da pomeri termin iz jedne faze u drugu zavisi od njegove role — klijent može da otkaže sopstveni predstojeći termin, ali samo osoblje ili admin mogu da označe nešto kao završeno ili da klijent nije došao.

Termin sa dodeljenim zaposlenim koji ima podešenu sinhronizaciju kalendara se takođe upisuje u Google Calendar tog zaposlenog, i ažurira se kako se status termina menja — pogledajte `11-eksterne-integracije.md` za tačno koje promene pokreću kreiranje, izmenu ili brisanje.

## Izmena postojećeg termina

Dve različite stvari mogu da se promene na terminu nakon zakazivanja, i to su namerno odvojene akcije:

- **Preraspodela** — menja se *ko* izvodi termin, bez diranja vremena. Dostupno administratoru, sa stranice detalja termina, bilo kom zaposlenom koji je kvalifikovan za uslugu, radi u tom tačnom terminu, i nije već zauzet u to vreme.
- **Pomeranje** — menja se *kada* se termin odigrava, bez diranja ko ga izvodi. Dostupno klijentu, dodeljenom zaposlenom, ili administratoru.

Pomeranje termina zavisi od toga koliko je vremena ostalo do *trenutnog* početka termina, za svakog osim administratora (administrator može da pomeri termin bez obzira na to koliko je blizu):

| Vreme do trenutnog početka termina | Šta je dozvoljeno |
|---|---|
| 24 sata ili više | Bilo koji budući dan i vreme (uz iste provere radnog vremena i dostupnosti kao pri novom zakazivanju) |
| Između 4 i 24 sata | I dalje dozvoljeno, ali samo na drugo vreme *istog kalendarskog dana* |
| Manje od 4 sata | Nije dozvoljeno |

Bez obzira na to koji se prag primenjuje, novo izabrano vreme uvek mora biti bar 30 minuta od trenutka kada se pomeranje zahteva — niko ne može da pomeri termin na vreme koje je praktično već sada.

### Šta se proverava pri samom upisu (slobodno/zauzeto)

Pomeranje i preraspodela ne veruju padajućoj listi ni prikazu koji je korisnik video: provera se ponavlja **u trenutku upisa**, kao i pri novom zakazivanju. Redovi ispod su isti skup pravila, a razlika je samo u tome šta se menja.

| Provera | Pomeranje | Preraspodela |
|---|---|---|
| Neradni dan salona (praznik, godišnji odmor) | da, **i za administratora** | nije potrebna (vreme se ne menja) |
| Zaposleni radi u tom terminu (radno vreme) | da | da (za novog zaposlenog) |
| Nema sudara sa drugim terminima zaposlenog, uz razmak od 30 minuta | da | da |
| **Nema SrediMe bloka** u tom terminu (vidi `11-eksterne-integracije.md`) | **da** | **da** |
| Kapacitet resursa (aparat, sto) | da | nije potrebna (resursi ostaju isti) |
| Poslednja zaštita od istovremenog upisa | jedinstveni indeks (zaposleni, početak) u bazi | — |

Ove provere važe za **sve aktere, uključujući administratora**: štite ispravnost podataka (dvostruko zauzet zaposleni ili aparat), a ne samo klijenta. Administrator zaobilazi samo vremenska pravila iz tabele iznad (prag od 24h/4h i minimum od 30 minuta unapred). Termin koji još nema dodeljenog zaposlenog preskače provere zaposlenog, ali neradni dan i resursi se proveravaju.

> **Istorija:** do oktobra 2026. ni pomeranje ni preraspodela nisu na upisu proveravale SrediMe blokove (lista za izbor jeste), što je bio poznat propust. Zatvoreno je i pokriveno testovima (`appointment.service.test.js`).

## Ručno kreiranje termina od strane osoblja

Osim što klijent sam zakazuje termin kroz javni tok zakazivanja, administrator (i zaposleni) mogu direktno kreirati termin iz admin panela (`/admin/termini/rucno-kreiranje`) — za walk-in klijente koji dođu bez prethodne rezervacije, poklone, nagrade sa nagradnih igara, i slične slučajeve gde termin nije rezultat klijentovog sopstvenog zakazivanja.

Ovaj tok koristi potpuno istu mehaniku kao i javno zakazivanje (transakciona provera dostupnosti, resursa, i sudara termina, automatsko/ručno dodeljivanje zaposlenog) — jedina razlika je odakle dolazi zahtev, i dve dodatne opcije koje javno zakazivanje nema:

- **Ručno podešena cena** — dostupna samo administratoru i zaposlenom (nikad javnom zakazivanju), i namerno **isključuje** kupon i plaćanje paketom za taj termin — kombinovanje bi bilo i matematički pogrešno (kupon umanjuje cenu iz kataloga za procenat/fiksan iznos, a ne zamenjuje je potpuno) i bezbednosno rizično (kupon je kod koji bi teorijski mogao biti ponovo iskorišćen; ručna cena nikad ne napušta admin panel). Termin kreiran na ovaj način je označen (`manualBooking` u bazi, prikazano na stranici detalja termina) radi transparentnosti i izveštavanja — uključujući i to da li zaposleni na proviziji za taj termin dobija minimalnu garantovanu proviziju, pogledajte `07-naknade-zaposlenih.md`.
- **Plaćanje iz postojećeg paketa korisnika** — kad se izabere postojeći registrovani korisnik i usluga/varijanta koju pokriva neki od njegovih kupljenih paketa, forma to automatski prepoznaje (ista provera kao i kod javnog zakazivanja, `findUsablePurchaseForService`) i nudi opciju da se termin plati iz tog paketa umesto zasebno — potpuno ista mehanika kao gore u "Šta zakazivanje košta" (rezervacija seanse pri kreiranju, stvarno trošenje tek pri završetku termina). Ovo je namerno dostupno samo kad **nije** korišćena ručna cena — te dve opcije su međusobno isključive, isto kao i kupon.
- **Postojeći korisnik ili walk-in** — administrator može izabrati postojećeg registrovanog korisnika (kontakt podaci se automatski preuzimaju sa njegovog naloga, osim ako se izričito unesu drugačiji), ili uneti podatke novog klijenta koji nema nalog — u tom slučaju se kreira gostinski nalog, isto kao i kod javnog zakazivanja bez prijave.
- Za razliku od javnog zakazivanja, ručno kreiranje termina **dozvoljava datum u prošlosti** — korisno za naknadno evidentiranje nečega što se već desilo (npr. walk-in koji je već obavljen).
- Polje za datum i vreme se uvek tumači kao lokalno (Beograd) zidno vreme koje je admin uneo/izabrao, bez obzira na to u kojoj vremenskoj zoni radi sam server — isto pravilo koje važi za zakazivanje objave na blogu (`zonedInputToUtcDate`, pogledajte `src/utils/date.time.util.js`).

## Podsetnici pre termina

Za svaki **potvrđen** termin, klijent automatski dobija email podsetnik **24 sata** i ponovo **4 sata** pre početka termina (`src/jobs/appointment-reminder-jobs.js`, konfiguracija prozora u `src/config/reminder.config.js`). Zakazani zadatak (cron) proverava na svakih 15 minuta, ali sama provera koristi širok vremenski prozor ("bilo kada između sada i granice prozora") umesto uskog vremenskog poklapanja sa učestalošću cron-a — svaki termin ima svoju nezavisnu oznaku da li je podsetnik već poslat (`reminder24hSentAt`, `reminder4hSentAt` na Appointment modelu), pa čak i ako cron zadatak propusti nekoliko ciklusa (npr. zbog restart-a servera), sledeći ciklus će uhvatiti sve zakasnele podsetnike umesto da ih trajno preskoči.

Podsetnik se šalje samo za termine sa statusom `confirmed` — termini koji čekaju potvrdu (`pending`) ne dobijaju podsetnik, pošto termin još uvek nije siguran. Email sadržaj uvek prikazuje tačan datum/vreme termina umesto relativne tvrdnje tipa "sutra"/"za par sati" — ovo je namerno, da bi email ostao tačan čak i ako se pošalje kasnije nego što je predviđeno (npr. nakon dužeg prekida rada servera).

Ako se u budućnosti želi treći prozor (npr. 1 sat pre termina), dovoljno je dodati novi unos u `reminder.config.js` — i cron raspored (`scheduler.js`) i sama logika slanja (`appointment-reminder-jobs.js`) su vođeni tom konfiguracijom, bez potrebe za dodatnim izmenama koda.

**Unazad.** Admin i zaposleni mogu ručno da kreiraju termin i u prošlosti (unos onoga što je već odrađeno van aplikacije) po katalogskoj ceni, iz paketa ili sa ručnom cenom; zabrana prošlosti i minimalna najava važe samo za samostalno zakazivanje korisnika.
