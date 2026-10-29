# Provizija za paket sa preporukom partnera

Kad se paket kupi preko partnerovog koda za preporuku, dva popusta se kombinuju: kupon partnera i ugrađen popust samog paketa. Sistem mora ispravno da izračuna proviziju i partnera (na osnovu stvarno naplaćenog) i zaposlenog (proporcionalno prema pravoj, nepopustovanoj vrednosti usluge) - ovo je stvarna poslovna pravila iz interne dokumentacije, ne izmišljen primer.

<video src="../../videos/provizija-za-paket-sa-preporukom/merged.sr.burned.mp4" controls width="720"></video>

_Titlovi su zapečeni u video - nije potreban spoljni .vtt fajl_

## 1. Početna stranica

Počinjemo na početnoj stranici sajta.

![otvaranje-pocetne](../../screenshots/provizija-za-paket-sa-preporukom/01-otvaranje-pocetne.png)

## 2. Registracija

Kliknemo „Registracija“ i otvara se forma za pravljenje naloga.

![registracija-klik-registracija](../../screenshots/provizija-za-paket-sa-preporukom/02-registracija-klik-registracija.png)

## 3. Registracija

Klijent se registruje.

![registracija](../../screenshots/provizija-za-paket-sa-preporukom/03-registracija.png)

## 4. Prijava

Klijent se prijavljuje na svoj nalog.

![prijava](../../screenshots/provizija-za-paket-sa-preporukom/04-prijava.png)

## 5. Početna stranica

Administrator počinje na početnoj stranici sajta.

![admin-otvaranje-pocetne](../../screenshots/provizija-za-paket-sa-preporukom/05-admin-otvaranje-pocetne.png)

## 6. Prijava

Kliknemo „Prijava“.

![admin-login-klik-prijava](../../screenshots/provizija-za-paket-sa-preporukom/06-admin-login-klik-prijava.png)

## 7. Prijava administratora

Administrator se prijavljuje da bi dodelio paket.

![admin-prijava](../../screenshots/provizija-za-paket-sa-preporukom/07-admin-prijava.png)

## 8. Otvaranje menija naloga

Administrator kliknemo na dropdown sa svojim imenom u gornjem desnom uglu.

![admin-ulazak-otvara-nalog-meni](../../screenshots/provizija-za-paket-sa-preporukom/08-admin-ulazak-otvara-nalog-meni.png)

## 9. Ulazak u admin panel

Administrator bira „Admin panel“ iz menija, čime se otvara admin deo sajta.

![admin-ulazak-otvara-admin-panel](../../screenshots/provizija-za-paket-sa-preporukom/09-admin-ulazak-otvara-admin-panel.png)

## 10. Otvaranje menija „Katalog”

Administrator klikne na grupu „Katalog” u admin meniju.

![admin-paketi-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/10-admin-paketi-otvara-meni.png)

## 11. Otvaranje kupljenih paketa

Administrator bira „Kupljeni paketi” iz menija.

![admin-paketi-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/11-admin-paketi-bira-stavku.png)

## 12. Dodela novog paketa

Administrator klikne „Dodeli paket”.

![admin-paketi-klik-na-dodaj](../../screenshots/provizija-za-paket-sa-preporukom/12-admin-paketi-klik-na-dodaj.png)

## 13. Dodela paketa uz partnerov kupon

Administrator bira klijenta i paket, unosi kod partnerovog kupona - popust se primenjuje odmah na kupovinu paketa.

![admin-dodeljuje-paket-sa-kuponom](../../screenshots/provizija-za-paket-sa-preporukom/13-admin-dodeljuje-paket-sa-kuponom.png)

## 14. Zakažite termin

Kliknemo dugme „Zakažite termin“ - vodi pravo na spisak usluga.

![nav-zakazite-termin](../../screenshots/provizija-za-paket-sa-preporukom/14-nav-zakazite-termin.png)

## 15. Izbor usluge

U listi usluga kliknemo na izabrani tretman. Na njegovoj stranici vidimo opis i varijante (trajanje i cenu).

![otvaranje-stranice-usluge](../../screenshots/provizija-za-paket-sa-preporukom/15-otvaranje-stranice-usluge.png)

## 16. Izbor varijante

Kliknemo „Zakaži“ na željenoj varijanti i prelazimo na izbor termina.

![izbor-varijante-usluge](../../screenshots/provizija-za-paket-sa-preporukom/16-izbor-varijante-usluge.png)

## 17. Izbor datuma

Biramo datum - polje je istaknuto. Sistem prikazuje slobodne termine za taj dan, na osnovu radnog vremena zaposlenih.

![izbor-datuma](../../screenshots/provizija-za-paket-sa-preporukom/17-izbor-datuma.png)

## 18. Izbor termina

Kliknemo željeno vreme.

![izbor-termina](../../screenshots/provizija-za-paket-sa-preporukom/18-izbor-termina.png)

## 19. Rezervacija seanse iz paketa

Klijent zakazuje termin, plaćajući iz već kupljenog paketa - bez dodatne naplate.

![klijent-rezervise-seansu](../../screenshots/provizija-za-paket-sa-preporukom/19-klijent-rezervise-seansu.png)

## 20. Otvaranje menija „Zakazivanje”

Administrator klikne na grupu „Zakazivanje” u admin meniju.

![admin-termini-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/20-admin-termini-otvara-meni.png)

## 21. Otvaranje liste termina

Administrator bira „Termini” iz menija.

![admin-termini-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/21-admin-termini-bira-stavku.png)

## 22. Pretraga termina

Administrator pretražuje listu po email adresi klijenta.

![admin-termini-pretraga](../../screenshots/provizija-za-paket-sa-preporukom/22-admin-termini-pretraga.png)

## 23. Otvaranje termina

Administrator otvara termin koji klijent zakazao iz paketa.

![admin-termini-otvaranje-rezultata](../../screenshots/provizija-za-paket-sa-preporukom/23-admin-termini-otvaranje-rezultata.png)

## 24. Admin završava termin

Administrator potvrđuje pa završava termin - ovo je trenutak kad se obračunava provizija zaposlenog. Osnovica je ispravno proporcionalna kombinovanom popustu (2160), a po stopi od 10% to bi bilo 216. Pošto je termin plaćen iz paketa, zaposleni ima zagarantovan minimum po seansi (podrazumevano 500, podešava se u „Podešavanja sajta“), pa se upisuje veći iznos.

![admin-zavrsava-termin](../../screenshots/provizija-za-paket-sa-preporukom/24-admin-zavrsava-termin.png)
