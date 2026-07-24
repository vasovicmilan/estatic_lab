# Usluge, Zakazivanje i Termini

## Katalog usluga

**Usluga** je tretman koji poslovanje nudi (vrsta masaže, tretman lica, tretman na aparatima, itd.). Svaka Usluga može imati više **varijanti** — različita trajanja, različit broj seansi, različite cene za suštinski isti tretman. Klijent koji zakazuje uslugu uvek bira konkretnu varijantu, ne samo uslugu samu po sebi.

## Proces zakazivanja

Zakazivanje je vođen proces u tri koraka:

1. **Izbor varijante** usluge koju klijent želi.
2. **Izbor termina** — bilo sa konkretnim zaposlenim, ili prepuštajući sistemu da izabere prvog dostupnog kvalifikovanog za tu uslugu.
3. **Potvrda kontakt podataka**, i opciono primena koda za popust u ovom trenutku.

Dostupnost termina se računa na osnovu radnog vremena svakog zaposlenog, umanjeno za termine koje već ima zakazane, sa ugrađenim razmakom između termina tako da zakazivanja jedno za drugim ne kolidiraju.

Kada klijent ne zahteva konkretnog zaposlenog, sistem dodeljuje prvu zaista dostupnu osobu za tu uslugu u trenutku zakazivanja — proveravano u tačnom trenutku kreiranja termina, tako da dva klijenta koja zakazuju isti termin u isto vreme ne mogu oba uspeti i završiti sa duplim zakazivanjem.

## Šta zakazivanje košta

Zakazani termin se naplaćuje na jedan od dva načina, i uvek samo jedan od njih za bilo koji termin:

- **Normalno plaćen** — cena varijante navedena u cenovniku, umanjena za kod za popust ako je primenjen.
- **Pokriven postojećim paketom** — ako klijent poseduje ranije kupljen paket sa više seansi koji uključuje ovu uslugu, može iskoristiti jednu od preostalih seansi umesto ponovnog plaćanja. U ovom slučaju nema nove naplate za sam termin — trošak je već pokriven prilikom kupovine paketa.

Ova dva puta se međusobno isključuju po dizajnu: termin plaćen paketom ne može *takođe* nositi sopstveni odvojeni kod za popust, pošto nema nove naplate koju bi kupon uopšte mogao da umanji.

## Životni ciklus termina

Termin prolazi kroz definisan skup faza:

- **Na čekanju** — zakazan, čeka potvrdu.
- **Potvrđen** — prihvaćen od strane zaposlenog ili admina.
- **Završen** — termin se odigrao. Ovo je i trenutak kada bilo koja provizija vezana za termin postaje isplativa (pogledajte `07-naknade-zaposlenih.md` i `06-partnerski-program.md`).
- **Odbijen** — odbijen pre nego što se odigrao.
- **Otkazan** — otkazan, od strane klijenta ili u njegovo ime, sa graničnim rokom istog dana koji štiti od otkazivanja u poslednjem trenutku.
- **Nije se pojavio/la** — termin je bio potvrđen, ali klijent nikada nije došao.

Ko sme da pomeri termin iz jedne faze u drugu zavisi od njegove role — klijent može da otkaže sopstveni predstojeći termin, ali samo osoblje ili admin mogu da označe nešto kao završeno ili da klijent nije došao.
