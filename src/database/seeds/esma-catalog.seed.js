import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Service from "../../models/service.model.js";
import Package from "../../models/package.model.js";
import { logInfo } from "../../utils/logger.util.js";

/**
 * Seeds the taxonomy + services for the ESMA Favorit device line, plus the studio's
 * classic hand massages. Grounded in ESMA's own published procedure list (esma.ru):
 * relaksacija, miostimulacija, elektrolipoliza/iglolipoliza, limfodrenaža, lifting,
 * elektroporacija, mikrostrujna terapija, miolifting, interferentne struje,
 * elektroforeza, biorevitalizacija (laser), ultrafonoforeza, VF kavitacija,
 * ultrazvučni piling, galvanizacija.
 *
 * Category shape: Masaže / Struja / ESMA are top-level; Laser i Ultrazvuk su
 * children of ESMA (Category.parent) — per the requested taxonomy.
 *
 * IMPORTANT — sessions live on Package, not on a Service's own package variants:
 * every variant embedded directly on a Service (Service.packages[]) is a single,
 * directly-bookable appointment (sessions: 1). That's a hard rule, not a style
 * choice — booking a Service variant through the normal flow always creates exactly
 * one Appointment at that variant's full price, with no ledger tracking further
 * visits. A PackagePurchase (the thing that actually tracks "N of M sessions used")
 * is only ever created by an admin manually granting a top-level Package
 * (see package-purchase.service.js — "no self-serve purchase flow, by design").
 * So any "buy N sessions for a bulk price" offer has to be a real top-level Package
 * that references a Service's (sessions: 1) variant with its own items[].sessions —
 * putting sessions > 1 directly on a Service variant would just be a price tag with
 * no backing mechanism, silently overcharging a customer for one single visit.
 *
 * All seeded Services and Packages are created with isActive: false (draft) since
 * there are no real photos and Service enforces an image before it can publish.
 * Review copy/pricing and add images in the admin panel, then activate.
 *
 * Re-run safety: Services/Packages/Categories/Tags all upsert by slug. Service
 * package-variant sub-documents are matched and preserved BY THEIR OWN slug across
 * re-runs (not blindly replaced) specifically so their _ids stay stable — Package
 * documents hold direct references to those _ids (items[].servicePackageId), and
 * regenerating them on every run would silently orphan every Package that points
 * at them. Don't rename a variant's slug after a Package already references it.
 */

const DOMAIN = "service";

// ---------------------------------------------------------------------------
// Categories — top-level first, then children (need the parent's _id)
// ---------------------------------------------------------------------------

const topLevelCategories = [
  {
    slug: "masaze",
    name: "Masaže",
    shortDescription: "Klasične ručne masaže — opuštanje, antistres, anticelulit, sportski oporavak.",
  },
  {
    slug: "struja",
    name: "Struja",
    shortDescription: "Tretmani zasnovani na električnoj stimulaciji — miostimulacija, mikrostrujna terapija, limfna drenaža strujom.",
  },
  {
    slug: "esma",
    name: "ESMA",
    shortDescription:
      "Tretmani na profesionalnom ruskom aparatu ESMA Favorit, koji u jednom uređaju kombinuje miostimulaciju, limfnu drenažu, mikrostrujnu terapiju, ultrazvuk i lasersku biorevitalizaciju.",
  },
];

const childCategories = [
  {
    slug: "laser",
    name: "Laser",
    parentSlug: "esma",
    shortDescription: "Laserska biorevitalizacija i regeneracija kože na ESMA Favorit laseru niske snage.",
  },
  {
    slug: "ultrazvuk",
    name: "Ultrazvuk",
    parentSlug: "esma",
    shortDescription: "Ultrazvučni piling, ultrafonoforeza i VF kavitacija na ESMA Favorit aparatu.",
  },
];

// ---------------------------------------------------------------------------
// Tags — the individual ESMA modalities + massage styles, used for filtering
// ---------------------------------------------------------------------------

const tagDefs = [
  { slug: "relaksacija", name: "Relaksacija" },
  { slug: "miostimulacija", name: "Miostimulacija" },
  { slug: "neurostimulacija", name: "Neurostimulacija" },
  { slug: "limfodrenaza", name: "Limfna drenaža" },
  { slug: "elektrolipoliza", name: "Elektrolipoliza" },
  { slug: "elektroporacija", name: "Elektroporacija" },
  { slug: "lifting", name: "Lifting" },
  { slug: "miolifting", name: "Miolifting" },
  { slug: "mikrostrujna-terapija", name: "Mikrostrujna terapija" },
  { slug: "interferentne-struje", name: "Interferentne struje" },
  { slug: "elektroforeza", name: "Elektroforeza" },
  { slug: "galvanizacija", name: "Galvanizacija" },
  { slug: "biorevitalizacija", name: "Biorevitalizacija" },
  { slug: "lazeroterapija", name: "Laseroterapija" },
  { slug: "ultrafonoforeza", name: "Ultrafonoforeza" },
  { slug: "vf-kavitacija", name: "VF kavitacija" },
  { slug: "ultrazvucni-piling", name: "Ultrazvučni piling" },
  { slug: "analgezija", name: "Analgezija" },
  { slug: "anticelulit", name: "Anticelulit" },
  { slug: "antistres", name: "Antistres" },
  { slug: "sportska-masaza", name: "Sportska masaža" },
  { slug: "terapeutska-masaza", name: "Terapeutska masaža" },
  { slug: "detoksikacija", name: "Detoksikacija" },
  { slug: "tonus-misica", name: "Tonus mišića" },
  { slug: "anti-aging", name: "Anti-aging" },
];

// ---------------------------------------------------------------------------
// Services — every packages[] entry is sessions: 1 (a single directly-bookable
// visit). Multi-session bundles are defined further down as top-level Packages,
// referencing these variants by slug.
// ---------------------------------------------------------------------------

const serviceDefs = [
  // ---- classic hand massages ----
  {
    slug: "relaks-masaza",
    name: "Relaks masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["relaksacija", "antistres"],
    shortDescription: "Nežna masaža celog tela koja opušta mišiće i smiruje nervni sistem.",
    longDescription:
      "Klasična relaksaciona masaža sporim, ujednačenim pokretima koja smanjuje mišićnu napetost i umor, poboljšava cirkulaciju i vraća osećaj mira. Idealna kao redovan ritual protiv svakodnevnog stresa. Dostupna kao kraći, ciljani tretman gornjeg ili donjeg dela tela, ili kao masaža celog tela.",
    defaultDuration: 60,
    features: [
      { name: "Duboko opuštanje", description: "Sporo, ritmično dejstvo na celo telo smanjuje mišićnu napetost.", icon: "bi bi-emoji-smile", order: 1 },
      { name: "Bolji san", description: "Smiruje nervni sistem i pomaže lakšem uspavljivanju posle tretmana.", icon: "bi bi-moon-stars", order: 2 },
    ],
    packages: [
      { name: "30 minuta — gornji deo tela", slug: "30-min-gornji", sessions: 1, duration: 30, totalPrice: 2000, order: 1 },
      { name: "30 minuta — donji deo tela", slug: "30-min-donji", sessions: 1, duration: 30, totalPrice: 2000, order: 2 },
      { name: "60 minuta — celo telo", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 3500, order: 3, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },
  {
    slug: "antistres-masaza",
    name: "Antistres masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["antistres", "relaksacija"],
    shortDescription: "Masaža fokusirana na vrat, ramena i leđa — zone gde se stres najviše nakuplja.",
    longDescription:
      "Kombinacija tehnika dubinskog pritiska i opuštajućih pokreta usmerena na vrat, ramena i leđa, gde se najčešće nakuplja tenzija izazvana sedenjem i stresom. Smanjuje glavobolje izazvane napetošću i poboljšava pokretljivost vrata i ramena. Dostupna kao kraći tretman vrata i ramena ili leđa, ili kao kompletan antistres tretman.",
    defaultDuration: 60,
    features: [
      { name: "Fokus na vrat i ramena", description: "Ciljano opuštanje zona najviše izložene stresu i lošem držanju.", icon: "bi bi-activity", order: 1 },
      { name: "Manje napetosti", description: "Smanjuje glavobolje i ukočenost izazvanu tenzijom.", icon: "bi bi-heart-pulse", order: 2 },
    ],
    packages: [
      { name: "30 minuta — vrat i ramena", slug: "30-min-vrat-ramena", sessions: 1, duration: 30, totalPrice: 2200, order: 1 },
      { name: "30 minuta — leđa", slug: "30-min-ledja", sessions: 1, duration: 30, totalPrice: 2200, order: 2 },
      { name: "60 minuta — kompletan antistres tretman", slug: "60-min-kompletno", sessions: 1, duration: 60, totalPrice: 3800, order: 3, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },
  {
    slug: "anticelulit-masaza",
    name: "Anticelulit masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["anticelulit", "limfodrenaza"],
    shortDescription: "Intenzivna ručna masaža problematičnih zona radi izgleda kože i cirkulacije.",
    longDescription:
      "Energična tehnika gnječenja i valjanja kože i potkožnog tkiva na problematičnim zonama. Podstiče lokalnu cirkulaciju i limfnu drenažu, poboljšavajući izgled i elastičnost kože uz redovno ponavljanje. Dostupna kao kraći tretman gornjeg dela tela (ruke, stomak) ili donjeg dela tela (butine, gluteus), ili kao tretman celog tela. Za vidljiv efekat preporučuje se serija tretmana — pogledajte paket od 10 tretmana.",
    defaultDuration: 60,
    features: [
      { name: "Ciljane zone", description: "Butine, stomak i nadlaktice — zone najsklonije celulitu.", icon: "bi bi-droplet", order: 1 },
      { name: "Bolja cirkulacija", description: "Podstiče protok krvi i limfe u tretiranim zonama.", icon: "bi bi-arrow-repeat", order: 2 },
    ],
    packages: [
      { name: "30 minuta — gornji deo tela (ruke, stomak)", slug: "30-min-gornji", sessions: 1, duration: 30, totalPrice: 2200, order: 1 },
      { name: "30 minuta — donji deo tela (butine, gluteus)", slug: "30-min-donji", sessions: 1, duration: 30, totalPrice: 2200, order: 2 },
      { name: "60 minuta — celo telo", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4000, order: 3, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },
  {
    slug: "sportska-masaza",
    name: "Sportska masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["sportska-masaza", "tonus-misica"],
    shortDescription: "Dublja masaža za sportiste i rekreativce — pre i posle fizičke aktivnosti.",
    longDescription:
      "Kombinuje tehnike razgibavanja, kompresije i istezanja prilagođene sportskim potrebama — priprema mišiće pred aktivnost ili ubrzava oporavak posle nje, smanjujući ukočenost i rizik od povrede. Dostupna kao kraći tretman gornjeg ili donjeg dela tela, ili kao masaža celog tela.",
    defaultDuration: 60,
    features: [
      { name: "Brži oporavak", description: "Smanjuje zakiseljenost mišića i ubrzava regeneraciju posle treninga.", icon: "bi bi-lightning-charge", order: 1 },
      { name: "Prevencija povreda", description: "Radi na tačkama zategnutosti pre nego što postanu problem.", icon: "bi bi-shield-check", order: 2 },
    ],
    packages: [
      { name: "30 minuta — gornji deo tela", slug: "30-min-gornji", sessions: 1, duration: 30, totalPrice: 2400, order: 1 },
      { name: "30 minuta — donji deo tela", slug: "30-min-donji", sessions: 1, duration: 30, totalPrice: 2400, order: 2 },
      { name: "60 minuta — celo telo", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4200, order: 3, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },
  {
    slug: "terapeutska-masaza",
    name: "Terapeutska masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["terapeutska-masaza", "analgezija"],
    shortDescription: "Ciljana masaža za hronične bolove u leđima, vratu i zglobovima.",
    longDescription:
      "Tehnike dubinskog tkiva usmerene na konkretan problem — hronične bolove u donjem delu leđa, ukočen vrat ili napete ramenske mišiće. Rad je prilagođen svakoj osobi na osnovu problematičnih zona koje navede. Dostupna kao kraći tretman gornjeg ili donjeg dela tela, ili kao tretman celog tela.",
    defaultDuration: 60,
    features: [
      { name: "Prilagođeno problemu", description: "Tretman se prilagođava zoni bola koju klijent navede.", icon: "bi bi-clipboard2-pulse", order: 1 },
      { name: "Dugotrajno olakšanje", description: "Rad na dubljim slojevima mišića, ne samo površinsko opuštanje.", icon: "bi bi-heart-pulse", order: 2 },
    ],
    packages: [
      { name: "30 minuta — gornji deo tela (vrat, ramena, leđa)", slug: "30-min-gornji", sessions: 1, duration: 30, totalPrice: 2400, order: 1 },
      { name: "30 minuta — donji deo tela (donji deo leđa, kukovi, noge)", slug: "30-min-donji", sessions: 1, duration: 30, totalPrice: 2400, order: 2 },
      { name: "60 minuta — celo telo", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4200, order: 3, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },

  // ---- ESMA Favorit treatments ----
  {
    slug: "esma-miostimulacija",
    name: "ESMA Miostimulacija",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["miostimulacija", "neurostimulacija", "interferentne-struje", "tonus-misica"],
    shortDescription: "Elektrostimulacija mišića na ESMA Favorit aparatu — jačanje i oblikovanje bez napora.",
    longDescription:
      "ESMA Favorit šalje kontrolisane električne impulse kroz elektrode postavljene na ciljanu mišićnu grupu, izazivajući kontrakcije slične onima pri vežbanju — bez fizičkog napora klijenta. Koristi se za tonizaciju stomaka, butina i gluteusa, kao i za sportski oporavak i održavanje mišićnog tonusa kod osoba sa smanjenom pokretljivošću. Za vidljive rezultate obično je potrebno 10–15 tretmana — pogledajte pakete od 5 i 10 tretmana.",
    defaultDuration: 40,
    features: [
      { name: "Bez fizičkog napora", description: "Mišić se kontrahuje pod dejstvom struje — telo miruje.", icon: "bi bi-lightning-charge", order: 1 },
      { name: "Ciljane zone", description: "Precizno gađanje stomaka, butina, gluteusa ili ruku.", icon: "bi bi-bullseye", order: 2 },
      { name: "Sportski oporavak", description: "Koristi se i za regeneraciju i održavanje tonusa mišića sportista.", icon: "bi bi-activity", order: 3 },
    ],
    packages: [{ name: "Jedan tretman", slug: "jedan-tretman", sessions: 1, duration: 40, totalPrice: 2800, order: 1 }],
    faq: [
      {
        question: "Da li tretman boli?",
        answer: "Osećaj je pokazivanje mišićne kontrakcije i trncanja, ne bol — intenzitet struje se podešava individualno prema pragu tolerancije.",
        order: 1,
      },
      {
        question: "Ko ne bi trebalo da radi ovaj tretman?",
        answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, epilepsijom, akutnim upalama kože na tretiranoj zoni ili malignim oboljenjima — o zdravstvenoj istoriji obavezno razgovarajte sa terapeutom pre zakazivanja.",
        order: 2,
      },
    ],
  },
  {
    slug: "esma-limfna-drenaza",
    name: "ESMA Limfna drenaža i elektrolipoliza",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["limfodrenaza", "elektrolipoliza", "anticelulit", "detoksikacija"],
    shortDescription: "Kombinacija limfne drenaže i elektrolipolize protiv celulita i zadržavanja tečnosti.",
    longDescription:
      "Aparat naizmeničnim kontrakcijama pokreće limfu ka limfnim čvorovima, pomažući izbacivanju viška tečnosti i toksina, dok elektrolipoliza (iglolipoliza) deluje na masne naslage u problematičnim zonama. ESMA Favorit omogućava da se miostimulacija, elektrolipoliza i limfna drenaža sprovedu u jednoj proceduri, što ubrzava i pojačava efekat u odnosu na odvojene tretmane. Za vidljiv efekat preporučuje se serija tretmana — pogledajte paket od 10 tretmana.",
    defaultDuration: 45,
    features: [
      { name: "Tri koraka u jednom", description: "Miostimulacija, elektrolipoliza i limfna drenaža u istoj proceduri.", icon: "bi bi-droplet", order: 1 },
      { name: "Manje zadržavanja tečnosti", description: "Podstiče limfni protok i smanjuje otoke.", icon: "bi bi-arrow-repeat", order: 2 },
      { name: "Izgled kože", description: "Redovni tretmani poboljšavaju izgled kože sklone celulitu.", icon: "bi bi-stars", order: 3 },
    ],
    packages: [{ name: "Jedan tretman", slug: "jedan-tretman", sessions: 1, duration: 45, totalPrice: 3200, order: 1 }],
  },
  {
    slug: "esma-mikrostrujni-lifting-lica",
    name: "ESMA Mikrostrujni lifting lica",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["mikrostrujna-terapija", "lifting", "miolifting", "anti-aging"],
    shortDescription: "Mikrostrujni tretman lica za zatezanje i osvežen izgled kože bez igala.",
    longDescription:
      "Niskointenzivne mikrostruje rade direktno na kožu i mišiće lica, podstičući proizvodnju kolagena i elastina i poboljšavajući tonus facijalnih mišića (miolifting). Efekat je vidljiv odmah posle prve seanse, a serija tretmana daje dugotrajniji rezultat zatezanja i osveženog tena — pogledajte paket od 6 tretmana.",
    defaultDuration: 40,
    features: [
      { name: "Vidljivo od prve seanse", description: "Koža deluje zategnutije i sjajnije odmah posle tretmana.", icon: "bi bi-stars", order: 1 },
      { name: "Bez igala i bola", description: "Neinvazivan tretman bez perioda oporavka.", icon: "bi bi-shield-check", order: 2 },
      { name: "Miolifting mišića lica", description: "Radi na tonusu facijalnih mišića, ne samo na površini kože.", icon: "bi bi-emoji-smile", order: 3 },
    ],
    packages: [{ name: "Jedan tretman", slug: "jedan-tretman", sessions: 1, duration: 40, totalPrice: 3000, order: 1 }],
  },
  {
    slug: "esma-ultrazvucna-terapija",
    name: "ESMA Ultrazvučna terapija i piling",
    categorySlugs: ["esma", "ultrazvuk"],
    tagSlugs: ["ultrazvucni-piling", "vf-kavitacija", "ultrafonoforeza", "analgezija"],
    shortDescription: "Ultrazvučni piling, VF kavitacija i ultrafonoforeza za dubinsko čišćenje i negu kože.",
    longDescription:
      "Ultrazvučne vibracije nežno uklanjaju mrtve ćelije kože i nečistoće (ultrazvučni piling), dok visokofrekventna kavitacija podstiče lokalnu cirkulaciju u tretiranoj zoni. Ultrafonoforeza koristi ultrazvuk da pospeši prodor aktivnih sastojaka iz nege dublje u kožu. Ultrazvuk ima i blag analgetski efekat, pa se koristi i u terapiji manjih mišićnih tegoba.",
    defaultDuration: 40,
    features: [
      { name: "Dubinsko čišćenje", description: "Ultrazvučni piling uklanja nečistoće bez grubog mehaničkog trljanja.", icon: "bi bi-water", order: 1 },
      { name: "Bolji prodor nege", description: "Ultrafonoforeza pomaže aktivnim sastojcima da dopru dublje u kožu.", icon: "bi bi-droplet", order: 2 },
      { name: "Blag analgetski efekat", description: "Koristi se i za olakšanje manjih mišićnih tegoba.", icon: "bi bi-heart-pulse", order: 3 },
    ],
    packages: [
      { name: "40 minuta — lice", slug: "40-min-lice", sessions: 1, duration: 40, totalPrice: 2800, order: 1 },
      { name: "60 minuta — telo", slug: "60-min-telo", sessions: 1, duration: 60, totalPrice: 4200, order: 2, isBest: true, badge: "NAJPOPULARNIJE" },
    ],
  },
  {
    slug: "esma-laserska-biorevitalizacija",
    name: "ESMA Laserska biorevitalizacija",
    categorySlugs: ["esma", "laser"],
    tagSlugs: ["biorevitalizacija", "lazeroterapija", "anti-aging"],
    shortDescription: "Laserska biorevitalizacija niske snage za regeneraciju i podmlađivanje kože lica.",
    longDescription:
      "ESMA Favorit koristi lasersko zračenje niske snage (50–100 mW) koje podstiče prirodnu regeneraciju kože i sintezu kolagena, bez oštećenja tkiva ili perioda oporavka. Tretman se često kombinuje sa mikrostrujnim liftingom za pojačan efekat podmlađivanja. Tokom tretmana se koriste zaštitne naočare.",
    defaultDuration: 30,
    features: [
      { name: "Bez perioda oporavka", description: "Nizak intenzitet zračenja — odmah se vraćate svakodnevnim aktivnostima.", icon: "bi bi-sun", order: 1 },
      { name: "Podstiče kolagen", description: "Aktivira prirodne procese regeneracije kože.", icon: "bi bi-gem", order: 2 },
      { name: "Kombinuje se sa liftingom", description: "Najbolji rezultati uz mikrostrujni lifting lica.", icon: "bi bi-stars", order: 3 },
    ],
    packages: [{ name: "Jedan tretman", slug: "jedan-tretman", sessions: 1, duration: 30, totalPrice: 3500, order: 1 }],
    faq: [
      {
        question: "Da li je potrebna zaštita za oči?",
        answer: "Da, terapeut i klijent nose zaštitne naočare tokom čitavog tretmana, kao i kod svakog laserskog tretmana lica.",
        order: 1,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Packages (top-level) — the real "buy N sessions for a bulk price" offers.
// Each references a Service by slug + one of its variants by variant slug;
// resolved to actual _ids after services are upserted (see upsertServices).
// ---------------------------------------------------------------------------

const packageDefs = [
  {
    slug: "esma-miostimulacija-5-tretmana",
    name: "ESMA Miostimulacija — paket od 5 tretmana",
    serviceSlug: "esma-miostimulacija",
    variantSlug: "jedan-tretman",
    sessions: 5,
    shortDescription: "Pet tretmana elektrostimulacije mišića po povoljnijoj ceni po tretmanu.",
    description:
      "Paket od 5 tretmana ESMA Miostimulacije, za tonizaciju i oblikovanje mišića uz redovno ponavljanje. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 12500,
    basePrice: 14000,
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["miostimulacija", "tonus-misica"],
  },
  {
    slug: "esma-miostimulacija-10-tretmana",
    name: "ESMA Miostimulacija — paket od 10 tretmana",
    serviceSlug: "esma-miostimulacija",
    variantSlug: "jedan-tretman",
    sessions: 10,
    shortDescription: "Deset tretmana elektrostimulacije mišića — preporučeno za vidljive rezultate.",
    description:
      "Paket od 10 tretmana ESMA Miostimulacije. Za vidljive rezultate na tonusu i obliku mišića obično je potrebno 10–15 tretmana, pa je ovo preporučeni paket za prve korisnike. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 23000,
    basePrice: 28000,
    isBest: true,
    badge: "NAJBOLJA VREDNOST",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["miostimulacija", "tonus-misica"],
  },
  {
    slug: "esma-limfna-drenaza-10-tretmana",
    name: "ESMA Limfna drenaža i elektrolipoliza — paket od 10 tretmana",
    serviceSlug: "esma-limfna-drenaza",
    variantSlug: "jedan-tretman",
    sessions: 10,
    shortDescription: "Deset tretmana limfne drenaže i elektrolipolize protiv celulita i zadržavanja tečnosti.",
    description:
      "Paket od 10 tretmana koji kombinuje miostimulaciju, elektrolipolizu i limfnu drenažu u jednoj proceduri. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 27000,
    basePrice: 32000,
    isBest: true,
    badge: "NAJBOLJA VREDNOST",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["limfodrenaza", "elektrolipoliza"],
  },
  {
    slug: "esma-mikrostrujni-lifting-6-tretmana",
    name: "ESMA Mikrostrujni lifting lica — paket od 6 tretmana",
    serviceSlug: "esma-mikrostrujni-lifting-lica",
    variantSlug: "jedan-tretman",
    sessions: 6,
    shortDescription: "Šest tretmana mikrostrujnog liftinga lica za dugotrajniji efekat zatezanja.",
    description:
      "Paket od 6 tretmana mikrostrujnog liftinga lica. Efekat je vidljiv od prve seanse, a serija tretmana daje dugotrajniji rezultat. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 15500,
    basePrice: 18000,
    isBest: true,
    badge: "NAJPOPULARNIJE",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["mikrostrujna-terapija", "lifting"],
  },
  {
    slug: "esma-laserska-biorevitalizacija-6-tretmana",
    name: "ESMA Laserska biorevitalizacija — paket od 6 tretmana",
    serviceSlug: "esma-laserska-biorevitalizacija",
    variantSlug: "jedan-tretman",
    sessions: 6,
    shortDescription: "Šest laserskih tretmana biorevitalizacije za podmlađivanje kože lica.",
    description:
      "Paket od 6 tretmana laserske biorevitalizacije niske snage. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 18500,
    basePrice: 21000,
    isBest: true,
    badge: "NAJBOLJA VREDNOST",
    categorySlugs: ["esma", "laser"],
    tagSlugs: ["biorevitalizacija", "lazeroterapija"],
  },
  {
    slug: "anticelulit-masaza-10-tretmana",
    name: "Anticelulit masaža — paket od 10 tretmana",
    serviceSlug: "anticelulit-masaza",
    variantSlug: "60-min-celo-telo",
    sessions: 10,
    shortDescription: "Deset anticelulit masaža celog tela po povoljnijoj ceni po tretmanu.",
    description:
      "Paket od 10 anticelulit masaža celog tela (60 minuta po tretmanu). Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 34000,
    basePrice: 40000,
    isBest: true,
    badge: "NAJBOLJA VREDNOST",
    categorySlugs: ["masaze"],
    tagSlugs: ["anticelulit", "limfodrenaza"],
  },
];

// ---------------------------------------------------------------------------
// Upsert logic
// ---------------------------------------------------------------------------

async function upsertTopLevelCategories() {
  const bySlug = {};
  for (const def of topLevelCategories) {
    const doc = await Category.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, shortDescription: def.shortDescription, parent: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

async function upsertChildCategories(bySlug) {
  for (const def of childCategories) {
    const parent = bySlug[def.parentSlug];
    const doc = await Category.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, shortDescription: def.shortDescription, parent: parent._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

async function upsertTags() {
  const bySlug = {};
  for (const def of tagDefs) {
    const doc = await Tag.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

// Preserves each package-variant's _id across re-runs by matching on the variant's
// own slug against whatever's already saved — a plain findOneAndUpdate replacement
// would hand every variant a brand-new _id on every run, silently orphaning any
// Package that references the old one.
async function upsertServices(categoriesBySlug, tagsBySlug) {
  const serviceIdsBySlug = {};
  const variantIdsBySlug = {}; // variantIdsBySlug[serviceSlug][variantSlug] = ObjectId

  for (const def of serviceDefs) {
    const categories = def.categorySlugs.map((slug) => categoriesBySlug[slug]._id);
    const tags = def.tagSlugs.map((slug) => tagsBySlug[slug]._id);

    const existing = await Service.findOne({ slug: def.slug });

    const packages = def.packages.map((p) => {
      const existingVariant = existing?.packages?.find((ep) => ep.slug === p.slug);
      return existingVariant ? { ...p, _id: existingVariant._id } : p;
    });

    const payload = {
      name: def.name,
      slug: def.slug,
      shortDescription: def.shortDescription,
      longDescription: def.longDescription,
      categories,
      tags,
      defaultDuration: def.defaultDuration,
      ctaText: "Zakaži termin",
      features: def.features || [],
      packages,
      faq: def.faq || [],
      // draft — no real image yet, so this can't satisfy the publish invariant.
      // Add a photo + review copy/pricing in /admin/usluge, then set isActive: true.
      isActive: false,
    };

    let doc;
    if (existing) {
      existing.set(payload);
      await existing.validate();
      doc = await existing.save();
    } else {
      doc = await Service.create(payload);
    }

    serviceIdsBySlug[def.slug] = doc._id;
    variantIdsBySlug[def.slug] = {};
    for (const p of doc.packages) {
      variantIdsBySlug[def.slug][p.slug] = p._id;
    }
  }

  return { serviceIdsBySlug, variantIdsBySlug };
}

async function upsertPackages(categoriesBySlug, tagsBySlug, serviceIdsBySlug, variantIdsBySlug) {
  const created = [];
  for (const def of packageDefs) {
    const serviceId = serviceIdsBySlug[def.serviceSlug];
    const variantId = variantIdsBySlug[def.serviceSlug]?.[def.variantSlug];
    if (!serviceId || !variantId) {
      throw new Error(`Package "${def.slug}" references unknown service/variant slug (${def.serviceSlug}/${def.variantSlug})`);
    }

    const categories = (def.categorySlugs || []).map((slug) => categoriesBySlug[slug]._id);
    const tags = (def.tagSlugs || []).map((slug) => tagsBySlug[slug]._id);
    const variantDuration = serviceDefs.find((s) => s.slug === def.serviceSlug).packages.find((p) => p.slug === def.variantSlug).duration;

    const payload = {
      name: def.name,
      slug: def.slug,
      description: def.description,
      shortDescription: def.shortDescription,
      items: [{ service: serviceId, servicePackageId: variantId, sessions: def.sessions }],
      totalPrice: def.totalPrice,
      basePrice: def.basePrice,
      totalDuration: def.sessions * variantDuration,
      badge: def.badge,
      isBest: def.isBest || false,
      categories,
      tags,
      // draft — review pricing/copy in /admin/paketi, then set isActive: true.
      isActive: false,
    };

    const doc = await Package.findOneAndUpdate({ slug: def.slug }, payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });
    created.push(doc);
  }
  return created;
}

export async function seedEsmaCatalog() {
  let categoriesBySlug = await upsertTopLevelCategories();
  categoriesBySlug = await upsertChildCategories(categoriesBySlug);
  const tagsBySlug = await upsertTags();
  const { serviceIdsBySlug, variantIdsBySlug } = await upsertServices(categoriesBySlug, tagsBySlug);
  const packages = await upsertPackages(categoriesBySlug, tagsBySlug, serviceIdsBySlug, variantIdsBySlug);

  const summary = {
    categories: Object.keys(categoriesBySlug).length,
    tags: Object.keys(tagsBySlug).length,
    services: Object.keys(serviceIdsBySlug).length,
    packages: packages.length,
  };

  logInfo("ESMA catalog seeded", summary);
  return summary;
}

export default seedEsmaCatalog;