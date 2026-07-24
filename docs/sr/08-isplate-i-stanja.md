# Isplate i Stanja

Ovo se podjednako odnosi na oba tipa zarade koje platforma prati proviziju za: **partneri** (provizija od referala) i **zaposleni na proviziji** (provizija od usluga).

## Kako se računa stanje zarade

U bilo kom trenutku, finansijska pozicija zarade se sastoji od tri broja:

- **Zarađeno** — ukupna provizija koju je akumulirao, kroz sve na šta je zaradio proviziju.
- **Isplaćeno** — ukupno koje mu je već zaista isplaćeno.
- **Rezervisano** — provizija koja je odobrena ali još uvek prolazi kroz period pregleda opisan u relevantnom izvoru zarade (na primer, period vraćanja porudžbine kod referirane porudžbine iz prodavnice).

Njegovo zaista **raspoloživo** stanje — ono što zaista može da zatraži ili mu bude isplaćeno odmah — je ukupno zarađeno, umanjeno za ono što je već isplaćeno, umanjeno za sve što je još uvek rezervisano. Ovaj obračun je uvek zasnovan na stvarnim, trenutnim brojkama umesto na tekućem zbiru koji bi mogao da izgubi sinhronizaciju, tako da tačno odražava pravo stanje njegovog naloga u trenutku provere, uključujući sve isplaćeno od poslednje provere.

## Zahtev za isplatu

Zarada može podneti zahtev za bilo koji iznos do svog trenutno raspoloživog stanja. Sistem neće prihvatiti zahtev za više od toga, tako da ne postoji način da se zatraži novac koji još nije zaista raspoloživ.

## Kako se zahtev rešava

Administrator koji pregleda zahtev za isplatu može:

- **Odobriti** ga, označavajući ga kao prihvaćen i u toku.
- **Označiti kao isplaćen**, kada je novac zaista poslat.
- **Odbiti** ga, uz objašnjenje koje zarada može da vidi.

Odvojeno, administrator takođe može **direktno evidentirati isplatu** — za situacije kada je novac promenio ruke van uobičajenog toka zahteva (na primer, gotovinsko plaćanje lično) i jednostavno treba da bude odraženo u sistemu naknadno, bez potrebe da zarada prethodno podnese zahtev za to.

Bez obzira koji put se koristi, zarada biva obaveštena putem email-a čim se status njegove isplate promeni, uključujući razlog ako je zahtev odbijen — tako da nikada ne ostane u nedoumici šta se desilo sa zahtevom koji je podneo.
