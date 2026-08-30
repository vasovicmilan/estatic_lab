# Commission on a package bought via a partner referral

When a package is bought through a partner's referral code, two discounts combine: the partner's coupon and the package's own built-in discount. The system has to correctly calculate commission for both the partner (based on what was actually paid) and the employee (proportional to the service's true, undiscounted value) - this is a real business rule from the internal docs, not a made-up example.

<video src="../../videos/provizija-za-paket-sa-preporukom/merged.en.burned.webm" controls width="720"></video>

_titl je zapečen u video - ne treba spoljni .vtt fajl_

## 1. Register

The customer registers.

![registracija](../../screenshots/provizija-za-paket-sa-preporukom/01-registracija.png)

## 2. Log in

The customer logs into their account.

![prijava](../../screenshots/provizija-za-paket-sa-preporukom/02-prijava.png)

## 3. Admin logs in

The admin logs in to assign the package.

![admin-prijava](../../screenshots/provizija-za-paket-sa-preporukom/03-admin-prijava.png)

## 4. Open the account menu

The admin clicks the dropdown showing their name in the top-right corner.

![admin-ulazak-otvara-nalog-meni](../../screenshots/provizija-za-paket-sa-preporukom/04-admin-ulazak-otvara-nalog-meni.png)

## 5. Enter the admin panel

The admin picks "Admin panel" from the menu, opening the site's admin area.

![admin-ulazak-otvara-admin-panel](../../screenshots/provizija-za-paket-sa-preporukom/05-admin-ulazak-otvara-admin-panel.png)

## 6. Open the "Catalog" menu

The admin clicks the "Catalog" group in the admin menu.

![admin-paketi-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/06-admin-paketi-otvara-meni.png)

## 7. Open purchased packages

The admin picks "Purchased packages" from the menu.

![admin-paketi-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/07-admin-paketi-bira-stavku.png)

## 8. Assign a new package

The admin clicks "Assign package".

![admin-paketi-klik-na-dodaj](../../screenshots/provizija-za-paket-sa-preporukom/08-admin-paketi-klik-na-dodaj.png)

## 9. Assign the package with a partner coupon

The admin picks the customer and package, enters the partner's coupon code - the discount applies immediately to the package purchase.

![admin-dodeljuje-paket-sa-kuponom](../../screenshots/provizija-za-paket-sa-preporukom/09-admin-dodeljuje-paket-sa-kuponom.png)

## 10. Book a session from the package

The customer books an appointment, paying from the already-purchased package - no additional charge.

![klijent-rezervise-seansu](../../screenshots/provizija-za-paket-sa-preporukom/10-klijent-rezervise-seansu.png)

## 11. Open the "Scheduling" menu

The admin clicks the "Scheduling" group in the admin menu.

![admin-termini-otvara-meni](../../screenshots/provizija-za-paket-sa-preporukom/11-admin-termini-otvara-meni.png)

## 12. Open the appointments list

The admin picks "Appointments" from the menu.

![admin-termini-bira-stavku](../../screenshots/provizija-za-paket-sa-preporukom/12-admin-termini-bira-stavku.png)

## 13. Search for the appointment

The admin searches the list by the customer's email.

![admin-termini-pretraga](../../screenshots/provizija-za-paket-sa-preporukom/13-admin-termini-pretraga.png)

## 14. Open the appointment

The admin opens the appointment the customer booked from the package.

![admin-termini-otvaranje-rezultata](../../screenshots/provizija-za-paket-sa-preporukom/14-admin-termini-otvaranje-rezultata.png)

## 15. Admin completes the appointment

The admin confirms then completes the appointment - this is when the employee's commission is calculated, correctly proportional to the combined discount.

![admin-zavrsava-termin](../../screenshots/provizija-za-paket-sa-preporukom/15-admin-zavrsava-termin.png)
