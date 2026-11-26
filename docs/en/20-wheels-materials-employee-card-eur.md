# Prize Wheels, Downloadable Materials, Employee Card and Prices in Euros

This document describes four independent areas: multiple prize wheels with leads, downloadable materials, the public employee card and showing prices in euros.

## 1. Prize wheels (multiple wheels)

- **`Wheel` model**: every wheel has a unique `slug`, a name, an active flag and an optional validity period. The default wheel has the slug `tocak`; the slug `vrti` is reserved (it is the spin route).
- **Public pages**: `/tocak` (default) and `/tocak/:slug`. An unknown slug returns 404.
- **Spinning**: `POST /tocak/vrti` with the field `wheel` (slug). The route is exempt from the CSRF check and is limited by `RATE_LIMIT_WHEEL_MAX` (default 80 requests per 10 minutes per client).
- **When a wheel is open**: it is active, within its dates and has at least 2 winnable prizes. Prizes can be added below that minimum, but cannot be reduced below it.
- **Prizes**: `WheelPrize.key` is globally unique (coupons are linked through `wheelPrizeKey`). There is one fallback prize per wheel.
- **Leads**: uniqueness is per wheel: `(wheel, email)` and `(wheel, phone.hash)`. The same person may spin another wheel. The lead list has a "Wheel" column and the CSV export contains it.
- **Admin**: `/admin/tocak` (choose a wheel with `?tocak=`) and `/admin/tocak/tockovi` (create, edit, delete; a new wheel can copy the prizes of an existing one). Deleting is for the `admin` role only.
- **Migration**: at startup the service assigns old prizes and leads to the default wheel. The script `scripts/migrate-multi-wheel.js` (dry run by default, `--apply` for the real change) removes the old unique indexes `email_1` and `phone.hash_1`. Run it on a copy of the database first.

## 2. Downloadable materials

- Public: `/materijali/:slug` (page), `/materijali/:slug/pregled` (preview) and `/materijali/:slug/preuzmi` (download).
- Admin: `/admin/materijali`, requires the `MANAGE_MARKETING` permission.
- Uploads go through multer; for larger files nginx needs `client_max_body_size` of at least `25m`.

## 3. Employee card

- Every employee has at most one card (`EmployeeCard`), edited at `/moj-nalog/vizitka`.
- The public address is `/vizitka/:slug`; the slug is 8 random characters (without easily confused ones). The contact is downloaded as vCard 3.0 (`/kontakt.vcf`) and the QR code is offered as SVG and PNG.
- **Privacy**: nothing personal is public by default; every field is switched on separately (`show`). The card is public only once the employee turns on `isPublic`.
- An employee who does not perform services (e.g. device marketing) can feature up to 6 active shop items (`pinnedProducts`, enabled with `show.products`). The card then has a products section with links to `/prodavnica/<slug>`; inactive items are skipped and the section is hidden when the shop module is off. The links currently carry no partner code (connecting them to the partner program is the planned next step).
- An employee can highlight up to 3 of their active services. The photo is copied once from the expert profile.
- The booking button leads to booking with that employee preselected (`?employeeId=`).
- **Admin**: `/admin/vizitke` lists all cards; an administrator can disable a card (`adminDisabled`), which overrides the employee's choice.
- Views and downloads are counted.

## 4. Prices in euros

- The display is informative only. Cart, orders, payment and schema.org stay in dinars.
- The fields are optional: product/variation (`priceEur`, `compareAtPriceEur`), service, package (`totalPriceEur`, `basePriceEur`). An empty value is stored as `null`.
- A range in euros ("from-to") is shown only if every item has a euro price. Format: `21 €`, `12,50 €`.
- Input is checked by validators (`validateEurPair`: the old price must not be lower than the new one).

## Known limitations

- Euro prices are not converted automatically and do not follow the exchange rate; they are entered by hand.
- Deleting a wheel also deletes its prizes; the leads are kept as records.
