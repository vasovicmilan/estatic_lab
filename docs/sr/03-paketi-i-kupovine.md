# Paketi i Kupovine Paketa

## Šta je Paket

**Paket** je ponuda u bandlu: više seansi jedne ili više usluga, prodate zajedno po ceni nižoj nego kada bi se svaka seansa kupovala pojedinačno. Ovo je standardni model cenovne politike u wellness industriji — klijent koji se opredeli za 10 seansi unapred plaća manje po seansi od nekoga ko zakazuje jednu po jednu, u zamenu za plaćanje celog iznosa pre nego što iskoristi bilo šta.

Paket može objediniti seanse jedne usluge (npr. "10 seansi konkretnog tretmana") ili kombinovati nekoliko različitih usluga u jednu ponudu (npr. mešoviti program koji pokriva više od jedne vrste tretmana).

## Kako klijent dobija Paket

Pošto kupovine paketa uključuju stvarno plaćanje unapred prikupljeno van platforme (lično, bankovnim transferom, itd.), administrator evidentira kupovinu u ime klijenta nakon što je plaćanje zaista primljeno. U tom trenutku, admin može i primeniti kod za popust, ako klijent na to ima pravo — sistem prikazuje konačnu cenu pre nego što se kupovina finalizuje, tako da nema nagađanja oko toga koliko je klijent zaista naplaćen.

## Trošenje seansi iz Paketa

Kada klijent poseduje Paket, zakazivanje termina za jednu od uključenih usluga omogućava mu da izabere da iskoristi jednu od preostalih seansi umesto ponovnog plaćanja. Sistem prati, za svaku uslugu uključenu u paket: koliko je seansi ukupno kupljeno, koliko je iskorišćeno, i koliko je trenutno rezervisano (zakazano ali još nije završeno, tako da mogu biti vraćene nazad ako termin ne bude realizovan).

## Zašto je vrednost pojedinačne seanse iz paketa i dalje bitna interno

Iako klijent ne plaća ništa novo kada iskoristi seansu iz paketa, poslovanje i dalje mora da ima tačan interni odgovor na stvarno pitanje: **koliko konkretno ta seansa zaista vredi**, u svrhu stvari poput obračuna provizije zaposlenih (pogledajte `07-naknade-zaposlenih.md`)? Cena paketa u bandlu sama po sebi ne govori koliko od te cene odgovara bilo kojoj pojedinačnoj usluzi ili seansi — posebno kada paket meša nekoliko različitih usluga zajedno.

Sistem ovo rešava tako što, u trenutku kupovine paketa, beleži tačno koliko je svaka uključena usluga tada normalno koštala po seansi, i koliki popust ceo bandl predstavlja u poređenju sa kupovinom svega pojedinačno. Ta kombinacija — stvarna vrednost po seansi, i stvarna stopa popusta bandla — je ono što omogućava poslovanju da kasnije ispravno i pravedno vrednuje svaku seansu kada bude iskorišćena, bez potrebe da nagađa ili primenjuje fiksni broj bez obzira koja je usluga zaista obavljena.

## Otkazivanje Paketa

Kupovina paketa može biti otkazana ako je potrebno — na primer, ako klijent zatraži povraćaj novca ubrzo nakon kupovine. Otkazivanje ispravno poništava sve što je bilo vezano za tu kupovinu, uključujući poništavanje bilo koje provizije koja je već bila odobrena kao njen rezultat.
