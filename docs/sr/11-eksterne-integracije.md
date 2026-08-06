# Eksterne Integracije — Google Calendar i SrediMe

Poslovanje takođe nudi svoje usluge preko **SrediMe**, eksterne pijace za zakazivanje u oblasti lepote — klijenti mogu da zakažu direktno preko SrediMe-a, ne samo preko ovog sajta. To stvara očigledan rizik: termin bi mogao biti zakazan i ovde i na SrediMe-u u isto vreme, za istog zaposlenog, a da nijedan sistem ne zna za onaj drugi.

Umesto direktne integracije sa SrediMe-ovim sopstvenim sistemima, obe strane prolaze kroz **Google Calendar** kao zajedničku, neutralnu tačku susreta — jedan kalendar po zaposlenom. Ovaj fajl pokriva oba smera te sinhronizacije, i zašto rade različito jedan od drugog.

## Smer 1: ova platforma → Google Calendar → SrediMe

Svaki zaposleni može opciono imati podešen **Google Calendar ID** na svom profilu. Kada ga ima, svaki termin dodeljen tom zaposlenom se automatski upisuje u taj kalendar kao događaj, i ažurira se kako se termin menja:

- **Kreiranje** — čim termin ima dodeljenog zaposlenog (odmah pri zakazivanju, ili kasnije ako ga admin dodeli), na kalendaru tog zaposlenog se kreira događaj.
- **Pomeranje** — vreme postojećeg događaja se ažurira na licu mesta.
- **Preraspodela drugom zaposlenom** — događaj se briše sa kalendara prethodnog zaposlenog i kreira iznova na novom (događaj se ne može "preneti" između dva različita kalendara, samo ponovo kreirati).
- **Otkazivanje ili odbijanje** — događaj se briše. Sam termin ostaje zabeležen u ovom sistemu bez obzira na to; samo njegov trag u kalendaru nestaje, pošto kalendar okrenut ka spolja nema potrebe da prikazuje zakazivanje koje nije uspelo.
- **Završavanje ili označavanje da se klijent nije pojavio** — događaj ostaje netaknut, kao istorijski zapis. Oboje ovo se dešava isključivo terminima koji su već u prošlosti, pa nema rizika od budućeg duplog zakazivanja ni u jednom slučaju.
- **Trajno brisanje od strane administratora** — događaj se briše, isto kao pri otkazivanju.

Kalendarski događaj termina traje 30 minuta duže od njegovog stvarnog kraja — isti razmak koji sam mehanizam zakazivanja interno već koristi (pogledajte `02-usluge-zakazivanje-termini.md`) — tako da sistem koji čita ovaj kalendar vidi isti prozor "zauzetosti" koji ova platforma već primenjuje, umesto da mora sam da zna za tu politiku razmaka.

Ako zaposleni nema podešen Google Calendar, ili je servis za sinhronizaciju nedostupan, ništa od ovoga ne blokira sam termin — sinhronizacija kalendara je sporedni efekat zakazivanja, nikada preduslov za njega.

**Uloga SrediMe-a u ovom smeru:** SrediMe čita direktno iz tog istog Google kalendara (preko "tajne adrese" iCal linka koji Google generiše za njega, unetog jednom u SrediMe-ova podešavanja za tog zaposlenog). Ovo je jednosmerno i u potpunosti na SrediMe-ovoj strani — ova platforma nema dalje učešće nakon što je događaj već na kalendaru.

## Smer 2: SrediMe → ova platforma

Obrnut smer — saznavanje o zakazivanju koje je klijent napravio *preko SrediMe-a* — radi drugačije, jer SrediMe ne upisuje u zajednički Google Calendar; on samo čita iz njega.

Umesto toga, svaki zaposleni može imati podešen poseban **SrediMe ICS URL** (link koji SrediMe generiše za izvoz zakazivanja tog zaposlenog sa SrediMe-a). Zakazani zadatak proverava taj feed na svakih 15 minuta, za svakog zaposlenog koji ga ima podešenog, i beleži ono što pronađe kao keširan skup "zauzetih" vremenskih blokova — po jedan unos za svako SrediMe zakazivanje, uparen sa istim zakazivanjem pri sledećim proverama tako da pomeranje termina ažurira postojeći unos, i automatski uklonjen čim se to zakazivanje više ne pojavljuje u feed-u (otkazivanje na SrediMe strani).

Ovi keširani zauzeti blokovi se tretiraju potpuno isto kao i sopstveni termini ove platforme, na dva mesta:

- **Kada se klijentu prikazuju dostupni termini**, SrediMe zakazivanja se oduzimaju od dostupnosti na isti način kao i postojeći termini.
- **U trenutku kada se novo zakazivanje stvarno potvrđuje** — uključujući i automatski izbor zaposlenog od strane sistema kada klijent nije zahtevao konkretnog — isti SrediMe-izvedeni zauzeti blokovi se ponovo proveravaju kao poslednja zaštita, ne samo u trenutku prikaza termina, pošto prikaz koji je klijent video može biti zastareo nekoliko minuta do trenutka kada stvarno zakaže.

> Lista dostupnih zaposlenih koju administrator vidi pri preraspodeli ili pomeranju postojećeg termina je takođe filtrirana prema istim SrediMe zauzetim blokovima. Sam upis za te dve akcije, međutim, ne proverava ih ponovo na isti način kao novo zakazivanje — uzak, ali poznat propust koji vredi zatvoriti.

Pošto se ova provera dešava po periodičnom rasporedu a ne u realnom vremenu, postoji neizbežan — ali ograničen, najviše 15 minuta — prozor u kom zakazivanje napravljeno na SrediMe-u još uvek nije preuzeto ovde. Ovo je namerni kompromis: periodično proveravanje je mnogo jednostavnije i otpornije nego oslanjanje na to da SrediMe obavesti ovaj sistem tog istog trenutka kad se nešto promeni, po ceni tog malog prozora. Isti razmak od 30 minuta koji se koristi svuda drugde u mehanizmu zakazivanja primenjuje se i na ove blokove, radi doslednosti.

## Zašto dva odvojena mehanizma umesto jednog zajedničkog kalendara

Bilo bi jednostavnije kada bi SrediMe upisivao sopstvena zakazivanja direktno u isti Google Calendar u koji ova platforma piše, i kada bi sve teklo kroz jedan zajednički kalendar u oba smera. Međutim, SrediMe-ova sopstvena integracija ne radi tako — njihov uvoz kalendara je eksplicitno jednosmeran (oni čitaju eksterne kalendare, ne pišu u njih), tako da je poseban, nezavisan SrediMe-okrenuti mehanizam preuzimanja zaista neophodan da bi se zatvorila petlja u drugom smeru.