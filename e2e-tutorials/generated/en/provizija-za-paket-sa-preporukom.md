# Commission on a package bought via a partner referral

When a package is bought through a partner's referral code, two discounts combine: the partner's coupon and the package's own built-in discount. The system has to correctly calculate commission for both the partner (based on what was actually paid) and the employee (proportional to the service's true, undiscounted value) - this is a real business rule from the internal docs, not a made-up example.

<video src="../../videos/provizija-za-paket-sa-preporukom/merged.en.burned.mp4" controls width="720"></video>

_Subtitles are burned into the video - no external .vtt file needed_

## 1. Home page

We start on the site's home page.

![otvaranje-pocetne](../../screenshots/provizija-za-paket-sa-preporukom/01-otvaranje-pocetne.png)

## 2. Registration

We click “Registracija” and the account form opens.

![registracija-klik-registracija](../../screenshots/provizija-za-paket-sa-preporukom/02-registracija-klik-registracija.png)

## 3. Register

The customer registers.

![registracija](../../screenshots/provizija-za-paket-sa-preporukom/03-registracija.png)

## 4. Log in

The customer logs into their account.

![prijava](../../screenshots/provizija-za-paket-sa-preporukom/04-prijava.png)

## 5. Home page

The administrator starts on the site's home page.

![admin-otvaranje-pocetne](../../screenshots/provizija-za-paket-sa-preporukom/05-admin-otvaranje-pocetne.png)

## 6. Log in

We click “Prijava”.

![admin-login-klik-prijava](../../screenshots/provizija-za-paket-sa-preporukom/06-admin-login-klik-prijava.png)

## 7. Admin logs in

The admin logs in to assign the package.

![admin-prijava](../../screenshots/provizija-za-paket-sa-preporukom/07-admin-prijava.png)

## 8. Open the account menu

The admin clicks the dropdown with their name in the top right corner.

![admin-ulazak-otvara-nalog-meni](../../screenshots/provizija-za-paket-sa-preporukom/08-admin-ulazak-otvara-nalog-meni.png)

## 9. Enter the admin panel

The admin chooses “Admin panel” from the menu, which opens the admin part of the site.

![admin-ulazak-otvara-admin-panel](../../screenshots/provizija-za-paket-sa-preporukom/09-admin-ulazak-otvara-admin-panel.png)

## 10. Open the "Catalog" menu

The admin clicks the "Catalog" group in the admin menu.

![admin-paketi-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/10-admin-paketi-otvara-meni.png)

## 11. Open purchased packages

The admin picks "Purchased packages" from the menu.

![admin-paketi-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/11-admin-paketi-bira-stavku.png)

## 12. Assign a new package

The admin clicks "Assign package".

![admin-paketi-klik-na-dodaj](../../screenshots/provizija-za-paket-sa-preporukom/12-admin-paketi-klik-na-dodaj.png)

## 13. Assign the package with a partner coupon

The admin picks the customer and package, enters the partner's coupon code - the discount applies immediately to the package purchase.

![admin-dodeljuje-paket-sa-kuponom](../../screenshots/provizija-za-paket-sa-preporukom/13-admin-dodeljuje-paket-sa-kuponom.png)

## 14. Book an appointment

We click the “Zakažite termin” button - it leads straight to the list of services.

![nav-zakazite-termin](../../screenshots/provizija-za-paket-sa-preporukom/14-nav-zakazite-termin.png)

## 15. Choosing a service

In the list of services we click the treatment we want. Its page shows the description and the variants (duration and price).

![otvaranje-stranice-usluge](../../screenshots/provizija-za-paket-sa-preporukom/15-otvaranje-stranice-usluge.png)

## 16. Choosing a variant

We click “Zakaži” on the variant we want and move on to choosing a time.

![izbor-varijante-usluge](../../screenshots/provizija-za-paket-sa-preporukom/16-izbor-varijante-usluge.png)

## 17. Choosing a date

We choose a date - the field is highlighted. The system shows the free slots for that day, based on the employees' working hours.

![izbor-datuma](../../screenshots/provizija-za-paket-sa-preporukom/17-izbor-datuma.png)

## 18. Choosing a time slot

We click the time we want.

![izbor-termina](../../screenshots/provizija-za-paket-sa-preporukom/18-izbor-termina.png)

## 19. Book a session from the package

The customer books an appointment, paying from the already-purchased package - no additional charge.

![klijent-rezervise-seansu](../../screenshots/provizija-za-paket-sa-preporukom/19-klijent-rezervise-seansu.png)

## 20. Open the "Scheduling" menu

The admin clicks the "Scheduling" group in the admin menu.

![admin-termini-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/20-admin-termini-otvara-meni.png)

## 21. Open the appointments list

The admin picks "Appointments" from the menu.

![admin-termini-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/21-admin-termini-bira-stavku.png)

## 22. Search for the appointment

The admin searches the list by the customer's email.

![admin-termini-pretraga](../../screenshots/provizija-za-paket-sa-preporukom/22-admin-termini-pretraga.png)

## 23. Open the appointment

The admin opens the appointment the customer booked from the package.

![admin-termini-otvaranje-rezultata](../../screenshots/provizija-za-paket-sa-preporukom/23-admin-termini-otvaranje-rezultata.png)

## 24. Admin completes the appointment

The admin confirms then completes the appointment - this is when the employee's commission is calculated. The base is correctly proportional to the combined discount (2160); at a 10% rate that would be 216. Because the session was paid from a package, the employee has a guaranteed per-session minimum (500 by default, set in “Podešavanja sajta”), so the higher amount is recorded.

![admin-zavrsava-termin](../../screenshots/provizija-za-paket-sa-preporukom/24-admin-zavrsava-termin.png)
