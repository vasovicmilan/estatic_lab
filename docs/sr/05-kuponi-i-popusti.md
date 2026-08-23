# Kuponi i Popusti

## Šta je Kupon

**Kupon** je kod za popust koji se može iskoristiti na zakazivanje, kupovinu paketa, ili porudžbinu iz prodavnice. Može davati popust kao fiksni iznos ili kao procenat od kupovine, i može opciono biti ograničen na:

- Vremenski period u kome važi (ili bez isteka uopšte, za kod koji treba da važi neograničeno).
- Maksimalan broj ukupnih upotreba, i/ili maksimalan broj upotreba po pojedinačnom klijentu (bilo koji od njih može ostati neograničen).
- Koje konkretne usluge, pakete, ili proizvode sme da pokrije — ili bez ograničenja, važeći za bilo šta.

## Gde se Kupon može koristiti

Isti sistem kupona opslužuje tri različita konteksta kupovine — zakazivanje usluge, kupovinu paketa, i porudžbinu iz prodavnice. Zakazivanje i kupovina paketa dele jedan zajednički deo kupona (vrsta popusta, vrednost, ograničenja) — dosledno ponašanje bez obzira na koje od to dvoje kupon primenite.

**Porudžbine iz prodavnice su odvojene.** Katalog artikala ide od sitnog potrošnog materijala do skupih uređaja vrednih nekoliko hiljada evra, pa isti procenat ili iznos popusta retko ima smisla za oboje. Zato kupon ima **poseban, opcioni deo posvećen isključivo artiklima** — sopstvena vrsta popusta, vrednost, i ograničenja, potpuno nezavisna od dela za usluge/pakete. Ako taj deo nije eksplicitno podešen, kupon se **uopšte ne može iskoristiti** na porudžbini iz prodavnice, bez obzira šta kaže deo za usluge/pakete — namerno restriktivan podrazumevani izbor, da se referalni kod ili promotivni kod napravljen za usluge nikad slučajno ne primeni na skup uređaj.

Oba dela — za usluge/pakete i za artikle — mogu opciono imati **gornju granicu iznosa popusta**, bez obzira na to da li je popust procenat ili fiksan iznos. Ovo je posebno bitno kod procentualnog popusta: procenat koji je razuman za uobičajenu uslugu može biti neproporcionalno visok kada se primeni na skup artikal, pa granica deluje kao sigurnosna mreža.

## Kuponi i partnerski program

Kupon može opciono biti povezan sa konkretnim **Partnerom**. Baš ova razlika je ono što razdvaja običan promotivni kod za popust (sezonski kod za rasprodaju, kod za lojalnost, i slično) od pravog **referalnog koda** koji zarađuje proviziju za partnera kome pripada kada se iskoristi. Pogledajte `06-partnerski-program.md` za kompletnu logiku referala i provizije — ovaj fajl pokriva samo mehaniku popusta, koja funkcioniše identično bez obzira da li je kod slučajno povezan sa partnerom ili ne.

## Kupon dobrodošlice

Prilikom svake registracije — bilo lozinkom, bilo preko Google-a — korisnik automatski dobija email sa kodom **DOBRODOSLI10** (10% popusta), koji važi za usluge i pakete. Kod je zajednički za sve nove korisnike; zaštita od višestrukog korišćenja istog kupona od strane istog korisnika ide preko postojećeg `maxUsesPerUser` ograničenja na samom kuponu (podrazumevano 1), ne preko generisanja posebnog koda po korisniku.

Kupon se kreira automatski, lenjo, pri prvoj registraciji ikada (`coupon.service.js`'s `ensureWelcomeCoupon`) — nije potrebno ručno ga praviti u admin panelu. Ako se greškom obriše, sledeća registracija će ga ponovo napraviti sa istim podrazumevanim podešavanjima (10%, bez `productDiscount` bloka, dakle ne važi za porudžbine artikala).

Podrazumevana podešavanja (procenat, vrednost, kod) se mogu promeniti u svakom trenutku direktno iz admin panela (Marketing → Kuponi) — jednom kreiran, kupon se dalje ponaša kao bilo koji drugi i ne prepisuje se pri sledećim pozivima `ensureWelcomeCoupon`. Sam kod je definisan u `src/config/marketing.config.js` (`WELCOME_COUPON_CODE`, `WELCOME_COUPON_DISCOUNT_VALUE`) — ako se kod ikad promeni tamo, prethodno kreirani kupon sa starim kodom ostaje u bazi kao običan kupon i mora se ručno obrisati/deaktivirati.