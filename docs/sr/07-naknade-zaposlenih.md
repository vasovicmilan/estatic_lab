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

## Gde se provizija uklapa pored partnerskog programa

Ceo ovaj odeljak se odnosi na ono što zaposleni lično zarađuje za obavljanje usluge. Potpuno je nezavisan od provizije partnerskog referala (pogledajte `06-partnerski-program.md`) — oba mogu da se primene na isti termin bez ikakvog konflikta: partner je možda zaradio proviziju kada je osnovni paket originalno kupljen putem njegovog referalnog linka, i odvojeno, koji god zaposleni kasnije obavi seansu iz tog paketa zarađuje sopstvenu proviziju na vrednost sopstvenog rada.
