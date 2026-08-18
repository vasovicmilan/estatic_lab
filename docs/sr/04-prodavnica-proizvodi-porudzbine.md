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

## Dostava

Katalog proizvoda ide od sitnog potrošnog materijala do velikih/teških uređaja koji se ne mogu poslati redovnom poštom. Svaki proizvod je označen kao **standardna** dostava (uobičajena, fiksna cena, obračunata automatski pri plaćanju) ili **teretna** (veliki/teški artikal).

Kada korpa sadrži bar jedan artikal iz teretne kategorije, cena dostave se ne obračunava automatski — porudžbina ide na čekanje procene, a administrator ručno unosi stvarnu cenu dostave (npr. nakon dogovora sa kurirskom službom) pre nego što klijent uopšte može da potvrdi porudžbinu putem linka koji je dobio na email. Ovo sprečava da porudžbina sa neispravnom (ili nikakvom) cenom dostave ikad postane finalna.