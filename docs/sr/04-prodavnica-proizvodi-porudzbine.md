# Prodavnica, Proizvodi i Porudžbine

## Katalog proizvoda

Pored usluga, platforma prodaje fizičke **Proizvode** (maloprodajne artikle, proizvode za negu kod kuće, i slično). Svaki proizvod može imati više **varijacija** — različite veličine, formulacije, ili konfiguracije — svaka sa sopstvenom cenom i nivoom zaliha koji se prati nezavisno.

## Korpa i plaćanje

Klijenti kreiraju korpu (bilo da su prijavljeni ili razgledaju kao gosti) i prolaze kroz standardan proces plaćanja: kontakt i podaci za dostavu, opcioni kod za popust, i potvrda porudžbine. Gosti potvrđuju porudžbinu putem sigurnog linka poslatog na email, tako da ne moraju da kreiraju nalog da bi završili kupovinu.

## Životni ciklus porudžbine

Porudžbina prolazi kroz definisan niz dok se realizuje:

**Na čekanju → U obradi → Poslato → Dostavljeno → Završeno**

Usput, porudžbina može umesto toga biti **otkazana** (pre slanja), **vraćena** (nakon što je klijent primi), ili joj **novac vraćen**. Kada porudžbina dostigne status **Završeno**, ona je zaista finalna — ne postoji put nazad odatle ka otkazivanju, vraćanju, ili povraćaju novca. Ova konačnost je direktno bitna za to kako se tajming provizije na porudžbinama sa referalom određuje (pogledajte `06-partnerski-program.md`) — završena porudžbina se tretira kao potpuno zatvorena, bez ičega što bi još moglo da bude poništeno.

## Popusti na porudžbinama

Porudžbina može nositi jedan kod za popust, primenjen prilikom plaćanja, na isti način kao i zakazivanje. Pogledajte `05-kuponi-i-popusti.md` za kako kodovi za popust funkcionišu i na šta mogu biti ograničeni.

## Ručno kreiranje porudžbine

Administrator može direktno da napravi porudžbinu (`/admin/porudzbine/rucno-kreiranje`) — za telefonske porudžbine, poklone, pakete proizvoda i artikle sa "cenom na upit". Porudžbina zaobilazi korpu i potvrdu emailom, ali posle toga se ponaša kao svaka druga (isti statusi, isti email kupcu, ista provizija pri završetku).

- **Više proizvoda** — dugmetom "Dodaj proizvod" dodaje se red po proizvodu (proizvod, varijanta, količina), do 20 stavki. Zalihe se skidaju za svaku stavku u istoj transakciji: ako za bilo koju nema dovoljno, ništa se ne upisuje.
- **Cena po proizvodu** — polje je podrazumevano prazno i znači kataloška cena varijante. Ako kupac nije platio redovnu cenu za neki proizvod, upiši cenu po komadu samo u taj red; ostali ostaju na katalošku. Upisana `0` je prava cena (besplatno), ne "prazno".
- **Finalna cena proizvoda** — opciono polje. Kad je popunjeno, **zamenjuje sve** cene proizvoda, i kataloške i ručno upisane: zbir proizvoda biće tačno taj iznos. Pošto se u porudžbini čuva cena svake stavke (za prikaz, račun i izveštaj prodaje po proizvodu), finalni iznos se srazmerno raspoređuje na stavke prema njihovim cenama pre zamene, tako da stavke uvek daju tačno finalni iznos (razlika od par para ide na poslednju stavku). Ako su sve stavke bile na 0, deli se po količini. Dostava se unosi posebno i dodaje preko finalne cene.
- **Cena na upit** — proizvod označen kao "cena na upit" zahteva ili ručnu cenu u svom redu ili finalnu cenu cele porudžbine; sistem nikad ne uzima njegovu internu referentnu cenu kao naplaćenu.
- Forma uživo prikazuje zbir proizvoda, dostavu i ukupno, a posle greške (npr. nema zaliha) zadržava sve što je uneto. U audit logu ostaje zabeleženo koje stavke i koja finalna cena su uneti.

## Dostava

Katalog proizvoda ide od sitnog potrošnog materijala do velikih/teških uređaja koji se ne mogu poslati redovnom poštom. Svaki proizvod je označen kao **standardna** dostava (uobičajena, fiksna cena, obračunata automatski pri plaćanju) ili **teretna** (veliki/teški artikal).

Kada korpa sadrži bar jedan artikal iz teretne kategorije, cena dostave se ne obračunava automatski — porudžbina ide na čekanje procene, a administrator ručno unosi stvarnu cenu dostave (npr. nakon dogovora sa kurirskom službom) pre nego što klijent uopšte može da potvrdi porudžbinu putem linka koji je dobio na email. Ovo sprečava da porudžbina sa neispravnom (ili nikakvom) cenom dostave ikad postane finalna.