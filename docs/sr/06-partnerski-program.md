# Partnerski / Referalni Program

Ovo je referalni sistem platforme: partneri preporučuju klijente putem sopstvenog linka, i zarađuju proviziju na ono što ti referali kupe. Ovaj fajl pokriva ceo program od početka do kraja.

## Kako se referal pripisuje

Svaki partner ima jedinstven referalni kod, ugrađen u sopstveni link koji deli (`beautymedica.rs/?code=NJEGOVKOD`, ili link ka konkretnoj usluzi, paketu, ili proizvodu sa istim kodom). U trenutku kada bilo ko poseti sajt sa tim kodom u URL-u — bilo koja stranica, ne samo početna — to se pamti za tog posetioca narednih 30 dana, bez obzira koliko drugih stranica pregleda u međuvremenu ili da li završi kupovinu tokom te iste posete.

Ovo znači da partner ispravno dobija zasluge čak i kada preporučeni klijent razgleda neko vreme, ode, i vrati se kasnije da zaista zakaže ili kupi nešto — sve dok je u okviru tog perioda od 30 dana.

## Gde se pripisivanje automatski primenjuje

Kada preporučeni posetilac dođe do trenutka stvarnog završavanja zakazivanja ili plaćanja, njegov zapamćeni referalni kod se automatski primenjuje kao popust — klijent dobija korist od partnerovog koda bez potrebe da ga sam pamti ili ponovo unosi. Ovo se dešava nezavisno za zakazivanja i za plaćanja u prodavnici, tako da posetilac koji je referiran dok je razgledao uslugu i dalje može da dobije taj isti referal ispravno prepoznat kasnije ako umesto toga kupi nešto iz prodavnice, i obrnuto.

## Pažljivo pripisivanje kod opštih upita

Jedino mesto gde se pripisivanje referala namerno strogo ograničava je opšti kontakt formular. Referal se pripisuje kontakt upitu samo kada je posetilac došao na kontakt stranicu iz *konkretnog* razloga vezanog za taj referal — na primer, prateći link "kontaktirajte nas o ovom paketu". Posetilac koji je u nekom trenutku bio referiran, ali kasnije pošalje potpuno nepovezan, opšti upit, nema taj upit pripisan referalu. Ovo štiti od toga da partner dobije zasluge za nešto što uopšte nije imalo veze sa njegovim referalom.

## Šta zapravo zarađuje proviziju partneru

Provizija se generiše konkretno kada se iskoristi referalni kod koji pripada partneru na kupovini — zakazivanju, kupovini paketa, ili porudžbini iz prodavnice. Obični promotivni kod za popust (koji nije povezan ni sa jednim partnerom) nikada ne generiše proviziju, bez obzira kako se koristi; samo pravi referalni kod to čini.

Tri vrste kupovina mogu generisati proviziju partneru, i svaka se obrađuje sa tajmingom prilagođenim tome koliko je ta vrsta kupovine zaista povratna:

- **Zakazan termin** — provizija postaje isplativa čim je termin označen kao završen. Kada je usluga zaista pružena, ne postoji ništa što bi to još moglo da poništi.
- **Porudžbina iz prodavnice** — provizija počinje kao rezervisana umesto odmah isplativa, tokom perioda od dve nedelje koji odražava standardno pravo klijenta da vrati artikal. Ako je porudžbina vraćena ili otkazana u tom periodu, provizija se ne isplaćuje. Ako porudžbina umesto toga dostigne sopstveni potpuno zatvoren status pre nego što period istekne, provizija odmah postaje isplativa — nema razloga da se dalje čeka kada je porudžbina zaista finalna. U suprotnom, kada period prođe bez vraćanja, provizija automatski postaje isplativa.
- **Kupovina paketa** — pošto se paket plaća i evidentira u trenutku kupovine (ne kroz onlajn plaćanje koje bi još moglo biti osporeno), provizija na njemu odmah postaje isplativa. Ako je kupovina paketa kasnije otkazana, provizija koja je već odobrena za nju se ispravno poništava.

## Partneri i provizija zaposlenih su nezavisni jedno od drugog

Referirana kupovina paketa i provizija zaposlenog koja se kasnije zaradi kada neko zaista iskoristi seansu iz tog paketa su dve potpuno odvojene stvari. Partner zarađuje svoju proviziju jednom, kada je referal doveo do same prodaje. Odvojeno, ako zaposleni na proviziji obavi seansu iz tog paketa, njegova sopstvena provizija se računa na stvarnu vrednost usluge koju je obavio — pogledajte `07-naknade-zaposlenih.md` za tačno kako se to pravedno vrednuje iako klijent ne plaća ništa novo na tom konkretnom terminu.

## Zahtev i primanje isplate

Partner u bilo kom trenutku može da vidi svoje tekuće brojke: koliko je ukupno zaradio, koliko mu je već isplaćeno, koliko je trenutno rezervisano (čekajući period vraćanja porudžbine iznad), i koliko je zaista raspoloživo da zatraži odmah. Može zatražiti isplatu za bilo koji iznos do onoga što je trenutno raspoloživo.

Administrator pregleda zahteve za isplatu i može ih odobriti, označiti kao isplaćene, ili odbiti uz objašnjenje — ili direktno evidentirati isplatu bez čekanja na zahtev, za slučajeve obrađene van uobičajenog toka zahteva. Bez obzira koji put se koristi, partner biva obavešten putem email-a čim se status njegove isplate promeni, tako da uvek zna gde stvari stoje bez potrebe da pita.

## Partnerov sopstveni panel

Svaki partner ima ličnu oblast naloga koja pokriva:

- Pregled trenutnog stanja i brz način da zatraži isplatu.
- Kompletnu, pretraživu istoriju svake provizije koju je zaradio, sa mogućnošću filtriranja po statusu i po vrsti kupovine iz koje potiče.
- Kompletnu istoriju svakog zahteva za isplatu koji je podneo i njegovog ishoda.
- Stranicu "katalog" koja navodi svaku uslugu, paket, i proizvod na sajtu, svaki sa već ugrađenim ličnim referalnim linkom spremnim za kopiranje — tako da deljenje konkretne ponude ne zahteva ručno sastavljanje linka.
