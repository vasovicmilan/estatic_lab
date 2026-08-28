# Poslovni Izveštaji

Platforma odvojeno prati dve vrste izveštaja. `10-logovi-i-revizija.md` pokriva **operativno** stanje sajta — saobraćaj, greške, brzinu odgovora. Ovaj fajl pokriva **poslovne** brojke — koliko se zarađuje i kroz koje kanale: zakazivanja, prodavnicu, pakete, provizije i kupone. To su dva različita pitanja, pa i dva odvojena sistema izveštavanja, iako dele isti obrazac (tekući period uživo, istorija sačuvana po periodu, email sa PDF prilogom).

## Šta izveštaj sadrži

Svaki poslovni izveštaj ima pet celina:

- **Zakazivanja** — ukupan broj termina, prihod, stopa ne-pojavljivanja klijenata, raspodela po statusu termina, i razbijanje prihoda po usluzi i po terapeutu.
- **Prodavnica** — ukupan broj porudžbina, prihod, prosečna vrednost porudžbine, i najprodavaniji proizvodi.
- **Paketi** — koliko je paketa prodato u periodu i koliki je prihod od njih.
- **Provizije** — koliko su zaposleni i partneri zaradili i koliko im je već isplaćeno u tom periodu (videti `07-naknade-zaposlenih.md` i `08-isplate-i-stanja.md` za kako se sami iznosi računaju).
- **Kuponi** — koliko puta su kuponi iskorišćeni i koliki je ukupan dat popust, razloženo po pojedinačnom kuponu.

## Periodi

Izveštaj postoji u pet varijanti: dnevni, nedeljni, mesečni, kvartalni i godišnji. Granice svakog perioda (kad tačno počinje i završava se "dan" ili "nedelja") računaju se u vremenskoj zoni poslovanja (Europe/Belgrade), ne u UTC-u na kom server radi — bez toga bi granica dana pomerena za dva sata dovela do toga da poneki termin iz kasnih večernjih sati upadne u pogrešan dan.

## Tekući period naspram istorije

Ovo je najbitnija razlika za razumevanje sistema: **tekući, još nezavršen period** i **istorija završenih perioda** funkcionišu na potpuno različit način.

Tekući period — recimo, današnji dan pre nego što se završi — nikad se ne čuva u bazi. Umesto toga, svaki put kad se otvori početna stranica poslovnih izveštaja u administraciji, brojke se preračunavaju uživo, u tom trenutku, direktno iz zakazivanja i porudžbina koje postoje do tog momenta. To je namerno: period koji je još u toku nema konačne brojke, pa čuvanje "trenutnog stanja" u bazi ne bi imalo smisla — sledećeg minuta bi već bilo zastarelo. Isti princip se koristi i za operativne izveštaje u `10-logovi-i-revizija.md`.

Kad se period zaista završi (prošao je ceo dan, cela nedelja, itd.), sistem generiše i **trajno sačuva** njegov konačan snimak. Taj snimak se više ne menja i vidljiv je u istoriji, sa dugmetom za detaljan pregled po pojedinačnom periodu.

## Automatsko i ručno generisanje

Za svaki tip perioda postoji zakazani noćni zadatak koji, čim se period završi, izračuna i sačuva njegov konačan izveštaj, a zatim ga pošalje administratoru na email. Isto se može pokrenuti i ručno, po istom obrascu kao operativni izveštaji:

```
npm run report:business-daily
npm run report:business-weekly
npm run report:business-monthly
npm run report:business-quarterly
npm run report:business-yearly
```

Ovo je korisno kad treba odmah generisati izveštaj za prethodni period bez čekanja na noćni ciklus, ili kad se ručno proverava da li izveštavanje radi ispravno.

## Email i PDF

Svaki sačuvan (ne tekući) izveštaj se šalje administratoru na email, sa istim brojkama prikazanim i u administraciji. Uz email ide i **PDF verzija** izveštaja kao prilog — pogodna za arhiviranje ili deljenje van sistema. Ista PDF verzija se može preuzeti i naknadno, u bilo kom trenutku, sa stranice detalja bilo kog sačuvanog izveštaja u administraciji, dugmetom "Preuzmi PDF".

Generisanje PDF-a ne može da zaustavi slanje email-a — ako iz nekog razloga PDF ne uspe da se napravi, email sa brojkama ipak stiže, samo bez priloga.

Svi PDF izveštaji na platformi (poslovni izveštaj i potvrda porudžbine) koriste ugrađen font koji ispravno prikazuje sve znakove srpske latinice (š, đ, č, ć, ž). Podrazumevani fontovi u PDF alatu koji platforma koristi ih ne podržavaju — bez ugrađenog fonta, ta slova bi u PDF-u nestajala ili se pogrešno prikazivala.

## Gde se sve ovo vidi u administraciji

Početna stranica poslovnih izveštaja (`/admin/poslovni-izvestaji`) prikazuje svih pet tipova perioda uživo, jasno obeleženih kao takvi. Svaki tip ima svoju istoriju (`/admin/poslovni-izvestaji/istorija/:tip`), a svaki sačuvan period svoju stranicu detalja sa punom raspodelom po kategorijama i dugmetom za PDF.
