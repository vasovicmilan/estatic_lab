# Logovi i Revizija

Platforma održava dve različite vrste evidencije u svrhu nadzora, koje odgovaraju na dve različite vrste pitanja.

## Izveštavanje o operativnom stanju

Sistem kontinuirano prati kako sam sajt funkcioniše — koliko saobraćaja dobija, koliko zahteva uspeva naspram onih koji ne uspevaju, i koliko brzo stranice odgovaraju. Ovo je dostupno administratorima u dva oblika:

- **Pregled uživo za danas** — snimak trenutne dnevne aktivnosti u realnom vremenu, dostupan u bilo kom trenutku bez čekanja da se dan završi.
- **Istorijska evidencija** — pretraživa arhiva svakog prethodnog dnevnog pregleda, omogućavajući administratorima da se osvrnu unazad i uoče obrasce ili uporede periode.

Ovo odgovara na pitanja poput: da li sajt trenutno funkcioniše normalno, da li je bio neuobičajen skok grešaka određenog dana, i koji delovi sajta najsporije odgovaraju.

## Trag odgovornosti

Odvojeno, platforma održava detaljnu evidenciju značajnih akcija koje preduzimaju administratori i drugo osoblje — kreiranje ili izmena partnera, podešavanje naknade zaposlenog, odobravanje ili odbijanje isplate, ažuriranje cene proizvoda, i slične akcije u okviru kataloga i upravljanja ljudima.

Za svaku evidentiranu akciju, sistem beleži:

- **Ko** ju je izvršio, i koju rolu je imao u tom trenutku.
- **Kada** se desila.
- **Šta se promenilo**, konkretno — za izmenu, tačno koja polja su izmenjena i koje su im vrednosti bile pre i posle.
- **Odakle** — IP adresa i pregledač sa kojeg je akcija izvršena.
- **Da li je uspela** — uključujući razlog ako nije.

Ovo znači da pitanja poput "ko je promenio ovu cenu, i koja je bila pre", "ko je odobrio ovu isplatu, i kada", ili "da li je ova akcija zaista uspela" imaju direktan, pouzdan odgovor, umesto oslanjanja na pamćenje ili neformalne beleške.

## Tehničko logovanje grešaka i zahteva

Pored dva zapisa iznad, sam server piše tehničke logove (dnevno rotirani fajlovi u `logs/` folderu, čuva se 30 dana): `app` (opšti događaji - cron poslovi, integracije, upozorenja), `error` (samo zaista ozbiljni problemi) i `http` (jedan red po zahtevu). Osetljiva polja (lozinke, tokeni, CSRF tokeni i slično) se maskiraju pre nego što se bilo šta upiše.

Svaka greška koju aplikacija obradi dobija kratak **ID greške** (8 hex znakova, generiše ga `generateErrorId()` u `crypto.service.js`). Isti ID se pojavljuje u log redu (polje `errorId` i `[id]` u poruci), u `X-Error-ID` response header-u, na stranici greške koju vidi posetilac ("ID greske") i u JSON odgovoru greške (`error.id`) - pa kad korisnik prijavi problem, pretraga logova po tom jednom ID-ju pronalazi tačan događaj.

Greške su klasifikovane tako da se važne izdvajaju:

- **`Unexpected error`** - stvarni bag (bilo šta što aplikacija nije namerno bacila). Loguje se na `error` nivou (ide u `error.log`) i šalje se Telegram alarm.
- **`Server error`** - namerna aplikativna greška sa 5xx statusom. Isto tretiranje: `error` nivo i Telegram alarm.
- **`Handled error`** - rutinski klijentski ishodi (404 za nepostojeću stranicu ili skener koji ispituje sajt, 403 za istekao CSRF token, greške validacije). Loguju se samo na `warn` nivou, bez alarma - očekivane su i inače bi zatrpale prave probleme.
