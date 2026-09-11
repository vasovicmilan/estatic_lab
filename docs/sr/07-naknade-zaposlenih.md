# Naknade Zaposlenih

## Dva načina na koja se zaposleni plaćaju

Svaki zaposleni je postavljen pod jedan od dva modela naknade:

- **Plata** — fiksni dogovor, na koji ništa u ovom dokumentu ne utiče.
- **Provizija** — zarađuje utvrđen procenat od vrednosti usluga koje lično obavi.

## Provizija na normalno plaćenom terminu

Za jednostavan, normalno plaćen termin, zarada zaposlenog na proviziji je jednostavno njegov procenat primenjen na ono što je klijent zaista platio za taj termin (nakon bilo kog koda za popust, ako je korišćen).

## Teži slučaj: seansa plaćena kroz Paket

Klijent koji je već kupio paket sa više seansi ne plaća ništa novo u trenutku kada zaista iskoristi jednu od tih seansi — platio je unapred, potencijalno po značajno povoljnijoj bandl ceni. Ovo stvara stvarno pitanje na koje poslovanje mora imati pravi odgovor: šta bi zaposleni na proviziji trebalo da zaradi za obavljanje te seanse, s obzirom da nema nove naplate u tom trenutku od koje bi se računao procenat?

Nijedan od dva očigledna odgovora nije tačan. Plaćanje zaposlenog na osnovu pune normalne cene usluge platilo bi mu više nego što je poslovanje zaista naplatilo za tu konkretnu seansu, pošto je klijent dobio bandl popust. Neplaćanje ničega, jer nema nove naplate, značilo bi da stvarno obavljen posao ostaje nenaknađen.

### Pristup: pravedno vrednovati seansu, po istoj stopi popusta koju je klijent dobio

Sistem ovo rešava vrednujući seansu pokrivenu paketom na isti način na koji je *poslovanje* vrednuje — po normalnoj ceni usluge, umanjenoj za istu ukupnu stopu koju paket klijenta predstavlja.

Konkretno: kada je paket kupljen, sistem već zna i normalnu, neumanjenu vrednost svega uključenog u njemu, i koliko je klijent zaista ukupno platio. To poređenje utvrđuje stvarnu stopu popusta paketa. Kada zaposleni kasnije obavi jednu konkretnu seansu iz tog paketa, njegova provizija se računa na normalnu cenu te seanse, prilagođenu za tu istu stopu popusta — ne punu cenu, i ne nulu.

**Primer sa brojkama:** paket koji pokriva 5 seansi tretmana normalno po ceni od 3.000 RSD svaka (15.000 RSD ako se kupuju pojedinačno) prodaje se kao bandl za 12.000 RSD — ukupan popust od 20%. Zaposleni na proviziji od 10% koji obavi jednu od tih seansi zarađuje proviziju na 3.000 × 0,8 = 2.400 RSD, odnosno 240 RSD — pravedan deo onoga što je poslovanje zaista ostvarilo za tu konkretnu seansu, proporcionalno njenoj normalnoj vrednosti u odnosu na svaku drugu uslugu u paketu.

Ovaj pristup takođe prirodno obrađuje pakete koji objedinjuju više od jedne vrste usluge zajedno, pošto normalna cena svake usluge određuje njen pravedan udeo u ukupnoj vrednosti paketa — skuplja uključena usluga se ispravno vrednuje više od jeftinije, obe umanjene po istoj ukupnoj stopi.

## Minimalna garantovana provizija po seansi

Iznad proporcionalnog vrednovanja opisanog gore postoji jedna zaštitna mera: **minimalna provizija po seansi** (`minimumSessionCommission`, podrazumevano 500 RSD). Podesiva je administratoru u bilo kom trenutku kroz `/admin/sajt` → odeljak "Provizija", bez izmene koda ili restarta servera — isti obrazac kao i ostale konfigurabilne vrednosti pomenute kroz ovu dokumentaciju.

### Zašto postoji

Proporcionalno vrednovanje je pravedno u proseku, ali ima manu na krajnjim vrednostima: ako je paket prodat po veoma niskoj promotivnoj ceni, ili čak potpuno poklonjen (plaćena cena 0 RSD), procenat od skoro-nula vrednosti seanse ispada skoro-nula provizija — iako je zaposleni obavio potpuno isti fizički rad kao i za redovno plaćenu seansu. Minimalna provizija garantuje da zaposleni na proviziji nikad ne zaradi manje od ovog iznosa po obavljenoj seansi, u tačno definisanim slučajevima ispod.

### Gde se primenjuje, i gde namerno ne

Minimalna provizija se primenjuje **isključivo** u dva slučaja:

1. **Seansa pokrivena paketom** — svaka seansa gde je termin vezan za kupljeni paket (`appointment.packagePurchase` postavljen). Ako proporcionalno izračunata provizija ispadne ispod praga, zaposleni dobija prag umesto izračunate vrednosti.
2. **Ručno kreiran termin sa ručno podešenom cenom** — termin kreiran kroz `/admin/termini/rucno-kreiranje` (pogledajte `02-usluge-zakazivanje-termini.md`) gde je administrator/zaposleni eksplicitno uneo cenu umesto kataloške (poklon, nagrada, dogovorena walk-in cena). Prepoznaje se po `appointment.manualBooking` oznaci, koja se postavlja **isključivo** kada je ručna cena zaista korišćena — ne za svaki ručno kreiran termin uopšte. Ručno kreiran termin BEZ ručne cene (npr. admin samo zakazuje walk-in po redovnoj kataloškoj ceni u ime klijenta, ili plaćen iz paketa korisnika bez ikakve ručne cene) nosi normalan rizik od niske provizije kao i svaki drugi normalno plaćen termin, pa se na njega ova zaštita ne primenjuje po ovoj tački — osim ako, naravno, ne spada pod tačku 1 jer je plaćen iz paketa.

Minimalna provizija se **nikad** ne primenjuje na običan a-la-carte termin, čak ni uz kod za popust — bez obzira koliko mala ispadne izračunata provizija, ostaje tačno onolika kolika proporcija nalaže. Popust preko kupona je klijentov legitiman izbor, ne administrativna odluka o "poklanjanju" usluge, pa ne nosi istu zaštitu.

### Primer

Nastavljajući primer paketa od 5 seansi iznad (normalna cena 3.000 RSD po seansi, paket prodat za 12.000 RSD, tj. 20% popust): zaposleni na proviziji od 10% zarađuje 240 RSD po seansi iz tog paketa — iznad praga od 500 RSD, minimalna provizija tu nema efekta.

Zamislite sad da je isti paket, umesto uobičajenog popusta, prodat kao promotivni poklon za 0 RSD (npr. nagrada u nagradnoj igri). Proporcionalna provizija bi tada ispala tačno 0 RSD (3.000 × 0% stope naplate = 0). Minimalna provizija garantuje da zaposleni ipak dobije 500 RSD za tu seansu — obavio je pun tretman, samo klijent nije platio ništa za konkretan paket.

Isto važi i za ručno kreiran termin bez paketa: ako admin kreira termin za pobednika nagradne igre i ručno postavi cenu na 0 RSD, zaposleni na proviziji ipak dobija minimalnih 500 RSD, ne 0 — čak i da paket uopšte nije uključen.

### Zašto se prag ponekad primenjuje neravnomerno unutar istog paketa

Pošto paket može objedinjavati više različitih usluga različite vrednosti (pogledajte primer sa više usluga u prethodnom odeljku), i svaka usluga zadržava svoju sopstvenu proporcionalnu vrednost, moguće je da u jednom te istom paketu neke seanse padnu ispod praga (i dobiju ga), dok druge ostanu iznad praga (i dobiju tačan izračunati procenat, bez ikakvog bonusa iznad njega). Ovo nije greška, već namerno ponašanje: jeftinija usluga u paketu je zaštićena minimalnim pragom baš zato što njena proporcionalna vrednost može ispasti premala, dok skuplja usluga u istom paketu i dalje pravedno dobija svoj stvarni, veći deo — bez da se ijedna od njih "prosečuje" sa drugom.

## Gde se provizija uklapa pored partnerskog programa

Ceo ovaj odeljak se odnosi na ono što zaposleni lično zarađuje za obavljanje usluge. Potpuno je nezavisan od provizije partnerskog referala (pogledajte `06-partnerski-program.md`) — oba mogu da se primene na isti termin bez ikakvog konflikta: partner je možda zaradio proviziju kada je osnovni paket originalno kupljen putem njegovog referalnog linka, i odvojeno, koji god zaposleni kasnije obavi seansu iz tog paketa zarađuje sopstvenu proviziju na vrednost sopstvenog rada.