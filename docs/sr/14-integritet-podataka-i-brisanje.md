# Integritet Podataka i Logika Brisanja

Ovaj dokument objašnjava šta se tačno dešava kada se bilo šta obriše u sistemu -
šta blokira brisanje, šta se automatski čisti, i šta se namerno ne dira. Napisan
je direktno iz izvornog koda (`src/services/*.service.js`), potvrđeno unit i
integracionim testovima (`npm run test:coverage` - 2511 testova, 901 suite, svi
prolaze).

Ne postoji jedno univerzalno pravilo "briši i počisti sve" - svaki tip veze
između entiteta pripada jednom od četiri nivoa strogosti, u zavisnosti od toga
**šta ta veza predstavlja**. To je vodeći princip celog sistema:

> Da li je ova veza obećanje nekome (novac, rezervacija, istorija) ili je samo
> trenutna oznaka/konfiguracija koja se sutra može promeniti bez posledica?

---

## Četiri nivoa

### Nivo 0 - Strukturalna hijerarhija: tvrda blokada, bez izuzetka

Kad jedan zapis strukturno zavisi od drugog (roditelj → dete), sistem ne
pokušava sam da pogodi šta bi trebalo da se desi sa decom - to je uvek
odluka administratora.

| Entitet | Blokira se ako... |
|---|---|
| **Category** | ima bilo koju podkategoriju (`parent` pokazuje na nju) |

```js
// category.service.js
const children = await categoryRepo.findCategories({ filters: { parent: categoryId }, limit: 1 });
if (children.total > 0) badRequest("Kategorija ima podkategorije - premestite ih ili obrišite prvo");
```

Nema automatskog premeštanja dece na "root" ili slično - moraš ih ručno
premestiti ili obrisati prvo.

---

### Nivo 1 - Aktivna poslovna obaveza: tvrda blokada, bez auto-fix-a

Ovo su veze gde brisanje ima **stvarnu, nepovratnu posledicu** - novac,
rezervacija, ili istorija koja mora ostati čitljiva. Sistem odbija brisanje i
kaže tačno zašto, umesto da nešto tiho "popravi" umesto tebe.

| Entitet | Blokira se ako... | Poruka korisniku |
|---|---|---|
| **Service** | postoji `pending`/`confirmed` termin | "Usluga ima termine na čekanju ili potvrđene termine" |
| **Service** | korisnik ima aktivan kupljen paket sa neiskorišćenim seansama baš te usluge | "Korisnici imaju aktivne kupljene pakete sa neiskorišćenim seansama" |
| **Service** | neki **Paket** je i dalje sastavljen od te usluge | Greška **imenuje tačan paket** koji blokira |
| **Package** | ima BILO KOJU kupovinu - čak i završenu ili isteklu | "Paket je kupljen... ne može biti obrisan" |
| **Product** | je u živoj korpi bilo kog korisnika | "Proizvod se nalazi u korpi..." |
| **Product** | je deo porudžbine koja je trenutno u toku (nije istekla) | "Proizvod je deo porudžbine koja je u toku" |
| **Employee** | ima `pending`/`confirmed` termin | Predlaže deaktivaciju umesto brisanja |
| **Employee** | ima proviziju na čekanju koja nije obračunata | Predlaže deaktivaciju |
| **Employee** | ima nerešen zahtev za isplatu | Predlaže deaktivaciju |
| **Partner** | ima proviziju na čekanju | - |
| **Partner** | ima nerešen zahtev za isplatu | - |
| **User** | ima porudžbine, termine ili kupljene pakete | Upućuje na GDPR-stil brisanje ličnih podataka umesto trajnog brisanja |
| **User** | je povezan sa profilom zaposlenog ili partnera | "prvo uklonite tu vezu" |
| **Resource** (prostor/oprema sa kapacitetom) | koristi ga bilo koja Usluga | Greška **imenuje usluge** koje ga koriste |
| **Role** | je označena kao podrazumevana (`isDefault`) | - |
| **Role** | je rezervisano ime (`admin`/`employee`/`user`) | "koristi se po nazivu na više mesta u sistemu" |
| **Campaign** | je već poslata | - |

**Najstroži od svih je Package** - za razliku od Usluge (čiji Appointment ima
sopstveni snapshot naziva/cene/trajanja, pa preživi brisanje usluge), kupovina
paketa (`PackagePurchase`) **nema snapshot imena samog paketa** - samo snapshot
pojedinačnih stavki. Brisanje ikad-prodatog paketa bi trajno onesposobilo i
istorijsku porudžbinu da pokaže šta je kupac zapravo kupio. Zato je blokada
bezuslovna, bez obzira na status kupovine.

**Product je blaži** - stvarna `Order` istorija **ne blokira** brisanje
proizvoda, jer `Order.items[]` već snapshotuje naziv/cenu/sliku u trenutku
kupovine (isti princip kao kod Usluge). Blokira samo ono što bi se **stvarno
polomilo** da proizvod nestane: korpa (koja namerno ne snapshotuje ništa, uvek
prikazuje živu cenu) i porudžbina u toku (koja će po završetku umanjiti zalihu
baš tog proizvoda).

---

### Nivo 2 - Trenutna konfiguracija: automatsko čišćenje, u transakciji

Ovo su veze koje **ne predstavljaju obećanje nikome** - samo trenutno stanje
koje se sutra može promeniti bez ičije štete. Umesto blokade, brisanje prolazi
i sistem sam očisti referencu iz svih mesta gde se pojavljuje - sve u jednoj
MongoDB transakciji (`session.withTransaction`), pa ako bilo koji korak
čišćenja pukne, **ništa se ne commit-uje** - ni samo brisanje.

| Kad se briše... | Automatski se čisti iz... |
|---|---|
| **Category** (bez podkategorija) | `Product.categories[]`, `Service.categories[]`, `Package.categories[]`, `Post.categories[]` |
| **Tag** | `Package.tags[]`, `Post.tags[]`, `Product.tags[]`, `Service.tags[]` |
| **Service** (posle Nivo-1 provera) | `Employee.services[]`, `Coupon.applicableServices[]`, `Product.relatedServices[]` |
| **Package** (posle Nivo-1 provera) | `Coupon.applicablePackages[]` |
| **Product** (posle Nivo-1 provera) | `Coupon.applicableProducts[]`, tuđi `relatedProducts[]`, `Service.relatedProducts[]` |
| **Partner** (posle Nivo-1 provera) | `Coupon.partner` (unset) |

Bitna razlika prema **Tag**-u: Category ima strukturu (Nivo 0 iznad) pa i dalje
može biti blokirana ako ima decu, dok Tag **nema hijerarhiju** i **nikad se ne
blokira** - uvek se briše i tiho izbriše iz svega što ga referencira. Tačno to
smo iskoristili maločas kad smo spajali 7 dupliranih blog tagova - sigurno je
raditi jer sistem sam čisti referencu, nema rizika od "zaboravljene" reference.

---

### Nivo 3 - Meki cross-link: ni blokada ni čišćenje, samo null-safe prikaz

Ovo je najsuptilniji nivo - reference koje se **ne čiste nikad**, ali to je
namerno, jer je svaki potrošač te reference već napisan da preživi `null`
posle populate-a (tj. da referencirani zapis više ne postoji).

| Referenca | Ostaje "visi" posle brisanja... | Ali se bezbedno tretira ovde |
|---|---|---|
| `Order.coupon`, `Appointment.coupon`, `PackagePurchase.coupon`, `TemporaryOrder.coupon` | ...**Coupon**-a | `appointment.coupon?.code \|\| null` u mapperima - jednostavno se ne prikaže kupon |
| `Employee.expert` | ...**Expert**-a | `employee.mapper.js`: `if (!employee.expert) return null` |
| `Product.relatedPosts[]`, `Service.relatedPosts[]` | ...**Post**-a | `product.mapper.js`: `.filter((p) => p && typeof p === "object" && p.title)` - obrisan post se tiho izbaci iz liste povezanih objava |
| `Expert.services[]` | ...**Service**-a | `expert.mapper.js`: `.filter((svc) => svc && typeof svc === "object" && svc.name)` - isti obrazac |
| `Testimonial.service`, `Testimonial.product` | ...**Service**-a ili **Product**-a | `testimonial.mapper.js`: `if (!testimonial.service) return null` - testimonijal ostaje, samo bez te veze |

Ovo NIJE propust - proverio sam svaki od ovih slučajeva direktno u mapper
sloju i svuda postoji eksplicitan null-safe fallback. Sistem je svesno odlučio
da za ove "meke" veze cena transakcionog čišćenja nije vredna toga kad
prikazni sloj i onako već preživljava `null` bez pucanja.

**Jedna sitna kozmetička nedoslednost** (ne funkcionalna greška): u
`expert.mapper.js`, `brojUsluga: expert.services?.length || 0` broji sirovu
dužinu niza *pre* filtriranja - ako se obriše usluga koju je neki ekspert imao
u svom `services[]`, `getServiceNames()` će je ispravno izbaciti iz prikazane
liste imena, ali brojka u admin listi ("broj usluga") ostaje stara dok neko
sledeći put ne sačuva taj profil eksperta. Bezopasno, samo zastareo broj u
jednoj admin koloni.

---

## Entiteti bez ikakve zaštite (prost delete)

Ovi zapisi nemaju **nijednu** povratnu referencu iz drugih modela (proverio
sam `ref: "X"` kroz ceo `src/models/`), pa jednostavno brisanje bez ijedne
provere jeste ispravno ponašanje, ne rupa:

- **Testimonial**
- **BusinessPartner** (saradnik)
- **Subscriber** (newsletter pretplatnik)
- **PackagePurchase** (administrativno hard-brisanje kupovine, van gornje Coupon reference)
- **TemporaryOrder**

---

## Posebni slučajevi - brisanje sa sporednim efektom

Dva brisanja rade nešto više od same DB operacije:

**Appointment** - ako je termin još `pending`/`confirmed` i drži rezervisanu
(a ne još iskorišćenu) sesiju iz paketa, ta sesija se **prvo vraća** klijentu
pre brisanja termina (`packagePurchaseService.releaseSession(...)`) - inače bi
klijent ostao sa "fantomskom" rezervacijom koja se nikad ne može ni iskoristiti
ni osloboditi. Posle brisanja, emituje se `appointment:deleted` event koji
čisti odgovarajući Google Calendar event - bez ovoga bi obrisan termin ostavio
svoj slot zauzet u Google kalendaru zauvek.

**User (trajno brisanje)** - namenjeno je samo nalozima bez ikakve istorije.
Za korisnika koji ima porudžbine/termine/pakete, poruka eksplicitno upućuje na
"brisanje ličnih podataka" (GDPR-stil anonimizacija) kao ispravnu alternativu
- trajno brisanje bi obrisalo i istoriju koja mora ostati (npr. iz finansijskih/
poreskih razloga).

---

## Brza referentna tabela

| Entitet | Nivo 0 (struktura) | Nivo 1 (blokira) | Nivo 2 (auto-čisti) | Nivo 3 (null-safe) |
|---|:---:|:---:|:---:|:---:|
| Category | ✅ podkategorije | - | ✅ Product/Service/Package/Post | - |
| Tag | - | - | ✅ Package/Post/Product/Service | - |
| Service | - | ✅ termini, aktivne sesije, Package | ✅ Employee/Coupon/Product | - |
| Package | - | ✅ bilo koja kupovina | ✅ Coupon | - |
| Product | - | ✅ korpa, aktivan checkout | ✅ Coupon/relatedProducts/Service | - |
| Employee | - | ✅ termini, provizije, isplate | - | - |
| Partner | - | ✅ provizije, isplate | ✅ Coupon.partner | - |
| User | - | ✅ porudžbine/termini/pakovi/veze | - | - |
| Resource | - | ✅ koristi ga Service | - | - |
| Role | - | ✅ default/rezervisano ime | - | - |
| Campaign | - | ✅ već poslata | - | - |
| Appointment | - | - | (sporedni efekat: oslobađa sesiju + briše Calendar event) | - |
| Coupon | - | - | - | ✅ Order/Appointment/Package Purchase/TemporaryOrder |
| Expert | - | - | - | ✅ Employee.expert |
| Post | - | - | - | ✅ Product/Service.relatedPosts |
| Service (kao Nivo-3 meta) | - | - | - | ✅ Expert.services[] |
| Service/Product (kao Nivo-3 meta) | - | - | - | ✅ Testimonial.service / Testimonial.product |
| Testimonial, BusinessPartner, Subscriber, PackagePurchase, TemporaryOrder | - | - | - | (nema referenci - prost delete) |

---

## Testna pokrivenost

Iz `npm run test:coverage` (unit + integration): **2511 testova, 901 suite, 0
neuspešnih**, ukupna pokrivenost linija **82.21%**. Svaki scenario u ovom
dokumentu ima odgovarajući test na service nivou (`*.service.test.js`) koji
proverava tačno ponašanje opisano ovde, uključujući i "aborts the whole
transaction and never reaches the terminal delete when a cleanup step fails"
slučaj za svaki Nivo-2 entitet.

## Zaključak

**Da, logika brisanja je urađena kako treba.** Ovo nije subjektivna ocena -
proverio sam je metodom koja ne ostavlja prostora za nagađanje: uzeo sam svaki
`ref: "X"` iz svakog modela u `src/models/`, i za svaku takvu vezu proverio da
li pripada tačno jednom od gore opisanih nivoa - blokira se, čisti se
transakciono, ili je dokazano null-safe u prikaznom sloju. Nema nijedne
reference u celom projektu koja ne pripada nijednom od ova tri obrasca.

Tri stvari posebno izdvajam kao dokaz da je ovo namerno projektovano, ne
posledica navike ili kopiranja koda:

1. **Doslednost principa, ne doslednost koda.** Category i Tag imaju skoro
   identičnu ulogu (taksonomija), ali se ne ponašaju identično - Category
   blokira na podkategorije jer ima strukturu, Tag nikad ne blokira jer je
   ravan. To je razlika u *prirodi* veze, ne previd.
2. **Transakciona sigurnost svuda gde ima više koraka čišćenja.** Svaki
   Nivo-2 slučaj ima test koji specifično proverava da neuspešan korak
   čišćenja prekine celu operaciju, uključujući sam delete - nijedan delete
   ne može ostaviti bazu u pola obrisanom stanju.
3. **Null-safety na Nivou 3 je proverena, ne pretpostavljena.** Za svih pet
   "mekih" veza (Coupon, Expert, Post→relatedPosts, Expert.services,
   Testimonial.service/product) postoji eksplicitan `if (!x) return null` ili
   `.filter(...)` u mapper sloju - nijedna se ne oslanja na sreću.

Jedina stvar koju sam pronašao vredna spominjanja je gore opisana kozmetička
sitnica (`brojUsluga` broji pre filtriranja) - ne utiče na tačnost podataka,
samo na prikaz jedne brojke u admin listi dok se profil ponovo ne sačuva. Ne
bih to prioritizovao.

