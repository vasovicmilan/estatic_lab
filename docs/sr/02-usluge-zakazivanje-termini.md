# Usluge, Zakazivanje i Termini

## Katalog usluga

**Usluga** je tretman koji poslovanje nudi (vrsta masaže, tretman lica, tretman na aparatima, itd.). Svaka Usluga može imati više **varijanti** — različita trajanja, različit broj seansi, različite cene za suštinski isti tretman. Klijent koji zakazuje uslugu uvek bira konkretnu varijantu, ne samo uslugu samu po sebi.

## Proces zakazivanja

Zakazivanje je vođen proces u tri koraka:

1. **Izbor varijante** usluge koju klijent želi.
2. **Izbor termina** — bilo sa konkretnim zaposlenim, ili prepuštajući sistemu da izabere prvog dostupnog kvalifikovanog za tu uslugu.
3. **Potvrda kontakt podataka**, i opciono primena koda za popust u ovom trenutku.

Dostupnost termina se računa na osnovu radnog vremena svakog zaposlenog, umanjeno za termine koje već ima zakazane, sa ugrađenim razmakom od 30 minuta sa obe strane svakog postojećeg termina, tako da zakazivanja jedno za drugim ne kolidiraju bez prostora za pripremu ili čišćenje. Isti ovaj proračun uzima u obzir i termine koji stižu preko SrediMe-a, eksterne pijace za zakazivanje na kojoj je poslovanje takođe prisutno — pogledajte `11-eksterne-integracije.md` za detalje te sinhronizacije.

Kada klijent ne zahteva konkretnog zaposlenog, sistem dodeljuje prvu zaista dostupnu osobu za tu uslugu u trenutku zakazivanja — proveravano u tačnom trenutku kreiranja termina, tako da dva klijenta koja zakazuju isti termin u isto vreme ne mogu oba uspeti i završiti sa duplim zakazivanjem. Ako je dostupno više od jednog zaposlenog, termin se namerno ostavlja nedodeljen umesto da se nasumično bira, tako da tu odluku donosi administrator.

## Šta zakazivanje košta

Zakazani termin se naplaćuje na jedan od dva načina, i uvek samo jedan od njih za bilo koji termin:

- **Normalno plaćen** — cena varijante navedena u cenovniku, umanjena za kod za popust ako je primenjen.
- **Pokriven postojećim paketom** — ako klijent poseduje ranije kupljen paket sa više seansi koji uključuje ovu uslugu, može iskoristiti jednu od preostalih seansi umesto ponovnog plaćanja. U ovom slučaju nema nove naplate za sam termin — trošak je već pokriven prilikom kupovine paketa.

Ova dva puta se međusobno isključuju po dizajnu: termin plaćen paketom ne može *takođe* nositi sopstveni odvojeni kod za popust, pošto nema nove naplate koju bi kupon uopšte mogao da umanji.

## Životni ciklus termina

Termin prolazi kroz definisan skup faza:

- **Na čekanju** — zakazan, čeka potvrdu.
- **Potvrđen** — prihvaćen od strane zaposlenog ili admina.
- **Završen** — termin se odigrao. Ovo je i trenutak kada bilo koja provizija vezana za termin postaje isplativa (pogledajte `07-naknade-zaposlenih.md` i `06-partnerski-program.md`).
- **Odbijen** — odbijen pre nego što se odigrao.
- **Otkazan** — otkazan. Klijent koji otkazuje sopstveni termin je ograničen rokom od 24 sata unapred, što štiti osoblje od otkazivanja u poslednjem trenutku; osoblje i admin mogu otkazati termin u ime klijenta bez tog ograničenja.
- **Nije se pojavio/la** — termin je bio potvrđen, ali klijent nikada nije došao.

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

## Ručno kreiranje termina od strane osoblja

Osim što klijent sam zakazuje termin kroz javni tok zakazivanja, administrator (i zaposleni) mogu direktno kreirati termin iz admin panela (`/admin/termini/rucno-kreiranje`) — za walk-in klijente koji dođu bez prethodne rezervacije, poklone, nagrade sa nagradnih igara, i slične slučajeve gde termin nije rezultat klijentovog sopstvenog zakazivanja.

Ovaj tok koristi potpuno istu mehaniku kao i javno zakazivanje (transakciona provera dostupnosti, resursa, i sudara termina, automatsko/ručno dodeljivanje zaposlenog) — jedina razlika je odakle dolazi zahtev, i opcija ručnog podešavanja cene:

- **Ručno podešena cena** — dostupna samo administratoru i zaposlenom (nikad javnom zakazivanju), i namerno **isključuje** kupon i plaćanje paketom za taj termin — kombinovanje bi bilo i matematički pogrešno (kupon umanjuje cenu iz kataloga za procenat/fiksan iznos, a ne zamenjuje je potpuno) i bezbednosno rizično (kupon je kod koji bi teorijski mogao biti ponovo iskorišćen; ručna cena nikad ne napušta admin panel). Termin kreiran na ovaj način je označen (`manualBooking` u bazi, prikazano na stranici detalja termina) radi transparentnosti i izveštavanja.
- **Postojeći korisnik ili walk-in** — administrator može izabrati postojećeg registrovanog korisnika (kontakt podaci se automatski preuzimaju sa njegovog naloga, osim ako se izričito unesu drugačiji), ili uneti podatke novog klijenta koji nema nalog — u tom slučaju se kreira gostinski nalog, isto kao i kod javnog zakazivanja bez prijave.
- Za razliku od javnog zakazivanja, ručno kreiranje termina **dozvoljava datum u prošlosti** — korisno za naknadno evidentiranje nečega što se već desilo (npr. walk-in koji je već obavljen).

## Podsetnici pre termina

Za svaki **potvrđen** termin, klijent automatski dobija email podsetnik **24 sata** i ponovo **4 sata** pre početka termina (`src/jobs/appointment-reminder-jobs.js`, konfiguracija prozora u `src/config/reminder.config.js`). Zakazani zadatak (cron) proverava na svakih 15 minuta, ali sama provera koristi širok vremenski prozor ("bilo kada između sada i granice prozora") umesto uskog vremenskog poklapanja sa učestalošću cron-a — svaki termin ima svoju nezavisnu oznaku da li je podsetnik već poslat (`reminder24hSentAt`, `reminder4hSentAt` na Appointment modelu), pa čak i ako cron zadatak propusti nekoliko ciklusa (npr. zbog restart-a servera), sledeći ciklus će uhvatiti sve zakasnele podsetnike umesto da ih trajno preskoči.

Podsetnik se šalje samo za termine sa statusom `confirmed` — termini koji čekaju potvrdu (`pending`) ne dobijaju podsetnik, pošto termin još uvek nije siguran. Email sadržaj uvek prikazuje tačan datum/vreme termina umesto relativne tvrdnje tipa "sutra"/"za par sati" — ovo je namerno, da bi email ostao tačan čak i ako se pošalje kasnije nego što je predviđeno (npr. nakon dužeg prekida rada servera).

Ako se u budućnosti želi treći prozor (npr. 1 sat pre termina), dovoljno je dodati novi unos u `reminder.config.js` — i cron raspored (`scheduler.js`) i sama logika slanja (`appointment-reminder-jobs.js`) su vođeni tom konfiguracijom, bez potrebe za dodatnim izmenama koda.