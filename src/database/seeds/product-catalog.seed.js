import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Product from "../../models/product.model.js";
import { logInfo } from "../../utils/logger.util.js";
import { markdownStringToBlocks } from "../../utils/content-blocks.util.js";

const DOMAIN = "product";

// ---------------------------------------------------------------------------
// NAPOMENA (pročitati pre pokretanja)
// ---------------------------------------------------------------------------
// Ovaj seed je generisan na osnovu dostavljenog kataloga proizvođača opreme
// (fotromed.com, avgust 2026) i objedinjuje SVE što je ranije bilo u dva
// odvojena fajla:
//   - product-catalog.seed.js (kategorije + 50 proizvoda)
//   - tags.seed.js            (47 "benefit" tagova za domain "product")
// u JEDAN fajl - isti princip konsolidacije kao service-catalog.seed.js.
//
// VAŽNA ISPRAVKA U ODNOSU NA STARI product-catalog.seed.js: onaj fajl je
// povezivao tagove sa proizvodima preko ČVRSTO UKUCANOG spiska ObjectId-jeva
// (TAG_ID_MAP), kopiranog iz jednog konkretnog DB exporta. To je bilo
// bezbedno SAMO dok se baza nikad ne briše - čim se baza obriše i ponovo
// seeduje, tags.seed.js pravi SASVIM NOVE ObjectId-jeve za iste tagove, pa bi
// stari čvrsto ukucani ID-jevi pokazivali na tagove koji više ne postoje
// (proizvodi bi ostali bez ijednog povezanog taga, bez ijedne greške pri
// pokretanju - tiha greška). Ovaj fajl umesto toga tagove povezuje
// DINAMIČKI, po slugu, kroz upsertTags() + lookup u upsertProducts() - isti
// princip kao service-catalog.seed.js - i radi ispravno bez obzira na to
// kada/koliko puta je baza brisana i ponovo seedovana.
//
// KATEGORIJE (ispravka - prati Excel 1:1): kategorije NISU generička grupa od
// 8 stavki kao ranije, već tačnih 16 kategorija iz Fotromed cenovnika (kolona
// "Kategorija / Tretman", npr. "HIFU – lifting lica i tela", "RF
// mikroigličenje", "Q-Switch Nd:YAG laser – tetovaže i pigmentacija" itd.) -
// isti nazivi, isti broj proizvoda po kategoriji kao u izvornoj tabeli.
//
// SVA POLJA IZ EXCEL TABELE: pošto Product model NEMA posebna polja za
// garancija/rok isporuke/dostupnost/šifra proizvođača, ta polja iz Excel-a
// (identična za svih 59 stavki: 12-24 meseca garancije, 30-60 dana isporuka,
// "Na upit" dostupnost, plus šifra tipa "FM-HIFU-22D" po proizvodu) su
// ugrađena kao čitljiv odeljak "Nabavni podaci" na kraju longDescription
// SVAKOG proizvoda - podaci nisu izgubljeni, samo su smešteni unutar
// postojeće strukture modela umesto da zahtevaju izmenu šeme.
//
// NOVI PROIZVODI (avgust 2026, iz Fotromed cenovnika): dodato je 12 novih
// stavki uporedivši postojećih 50 proizvoda sa punim Fotromed katalogom
// (59 stavki) - 10 potpuno novih proizvoda + HydroRevive Pro podeljen na 2
// odvojena proizvoda (9-u-1 i 15-u-1), pošto Fotromed katalog ima 2 odvojene
// šifre/fotografije za tu liniju, ne jednu. Ukupno: 61 proizvod.
//
// SVI proizvodi (postojećih 50 i novih 12) i dalje imaju placeholder cenu od
// 12345 RSD, količinu na stanju 0 i isActive: false (draft) - popuni pravu
// cenu, količinu, fotografiju i postavi isActive: true pre nego što se
// pojave u prodavnici.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tagovi ("benefit" tagovi - šta proizvod pruža korisniku)
// ---------------------------------------------------------------------------

const tagDefs = [
  // === LIFTING I ZATEZANJE ===
  { name: "Zatezanje kože", slug: "zatezanje-koze" },
  { name: "Lifting lica", slug: "lifting-lica" },
  { name: "Neinvazivni lifting", slug: "neinvazivni-lifting" },
  { name: "Podmlađivanje lica", slug: "podmladjivanje-lica" },
  { name: "Konturisanje lica", slug: "konturisanje-lica" },
  { name: "Uklanjanje bora", slug: "uklanjanje-bora" },
  { name: "Uklanjanje finih linija", slug: "uklanjanje-finih-linija" },

  // === DEPILACIJA ===
  { name: "Trajna depilacija", slug: "trajna-depilacija" },
  { name: "Uklanjanje dlačica", slug: "uklanjanje-dlaka" },
  { name: "SHR depilacija", slug: "srh-depilacija" },
  { name: "Laserska depilacija", slug: "laserska-depilacija" },

  // === TRETMAN KOŽE ===
  { name: "Podmlađivanje kože", slug: "podmladjivanje-koze" },
  { name: "Obnova kože", slug: "obnova-koze" },
  { name: "Stimulacija kolagena", slug: "stimulacija-kolagena" },
  { name: "Poboljšanje elastičnosti", slug: "poboljsanje-elastienosti" },
  { name: "Hidratacija kože", slug: "hidratacija-koze" },
  { name: "Čišćenje kože", slug: "ciscenje-koze" },
  { name: "Dubinsko čišćenje", slug: "dubinsko-ciscenje" },

  // === TRETMAN NEPRAVILNOSTI ===
  { name: "Uklanjanje ožiljaka", slug: "uklanjanje-oziljaka" },
  { name: "Tretman akni", slug: "tretman-akni" },
  { name: "Uklanjanje pigmentacija", slug: "uklanjanje-pigmentacija" },
  { name: "Uklanjanje tetovaža", slug: "uklanjanje-tetovaza" },
  { name: "Uklanjanje trajne šminke", slug: "uklanjanje-trajne-sminke" },
  { name: "Tretman strija", slug: "tretman-strija" },
  { name: "Uklanjanje bradavica", slug: "uklanjanje-bradavica" },
  { name: "Tretman krvnih sudova", slug: "tretman-krvnih-sudova" },
  { name: "Uklanjanje celulita", slug: "uklanjanje-celulita" },

  // === OBLIKOVANJE TELA ===
  { name: "Oblikovanje tela", slug: "oblikovanje-tela" },
  { name: "Redukcija masti", slug: "redukcija-masti" },
  { name: "Kriolipoliza", slug: "kriolipoliza" },
  { name: "Jačanje mišića", slug: "jacanje-misica" },
  { name: "Zatezanje tela", slug: "zatezanje-tela" },

  // === INTIMNA NEGA ===
  { name: "Intimna nega", slug: "intimna-nega" },
  { name: "Vaginalna rejuvenacija", slug: "vaginalna-rejuvenacija" },
  { name: "Jačanje karličnog dna", slug: "jacanje-karlicnog-dna" },
  { name: "Tretman inkontinencije", slug: "tretman-inkontinencije" },

  // === DIJAGNOSTIKA ===
  { name: "Analiza kože", slug: "analiza-koze" },
  { name: "Dijagnostika kože", slug: "dijagnostika-koze" },
  { name: "AI analiza", slug: "ai-analiza" },

  // === WELLNESS ===
  { name: "Kiseonični tretman", slug: "kiseonicki-tretman" },
  { name: "Relaksacija", slug: "relaksacija" },
  { name: "Wellness", slug: "wellness" },

  // === SIGURNOST I KVALITET ===
  { name: "FDA odobren", slug: "fda-odobren" },
  { name: "Bez oporavka", slug: "bez-oporavka" },
  { name: "Bezbolan tretman", slug: "bezbolan-tretman" },
  { name: "Neinvazivno", slug: "neinvazivno" },];

// ---------------------------------------------------------------------------
// MAPPING: product-slug -> [tag-slug, ...]
// ---------------------------------------------------------------------------

const productTagMapping = {
  "ultralift-sd-compact": ["zatezanje-koze", "lifting-lica", "neinvazivni-lifting", "stimulacija-kolagena"],
  "fotohifu-delux": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "uklanjanje-bora"],
  "fotohifu-dual": ["lifting-lica", "zatezanje-koze", "oblikovanje-tela", "neinvazivno"],
  "fotohifu-femi": ["intimna-nega", "vaginalna-rejuvenacija", "jacanje-karlicnog-dna"],
  "fotohifu-max": ["lifting-lica", "zatezanje-koze", "oblikovanje-tela", "intimna-nega", "neinvazivno"],
  "ultrafarma-7d-hifu": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "stimulacija-kolagena"],
  "360-max-hifu": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "oblikovanje-tela", "neinvazivno"],
  "magnilift-ems-pro": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "podmladjivanje-lica"],
  "magnilift-ems-compact": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "jacanje-misica"],
  "fotomed-pulse-pro": ["trajna-depilacija", "srh-depilacija", "podmladjivanje-koze", "uklanjanje-pigmentacija"],
  "fotomed-pulse-mini": ["trajna-depilacija", "srh-depilacija", "podmladjivanje-koze", "neinvazivno"],
  "derma-frac-mnrf": ["podmladjivanje-koze", "uklanjanje-oziljaka", "uklanjanje-bora", "bez-oporavka", "neinvazivno"],
  "derma-pulse": ["podmladjivanje-koze", "uklanjanje-oziljaka", "tretman-akni", "stimulacija-kolagena"],
  "derma-pulse-xl": ["podmladjivanje-koze", "uklanjanje-oziljaka", "tretman-akni", "stimulacija-kolagena"],
  "fda-approved-rf-microneedling": ["podmladjivanje-koze", "uklanjanje-oziljaka", "uklanjanje-bora", "fda-odobren", "bez-oporavka"],
  "oxygen-revive": ["kiseonicki-tretman", "dubinsko-ciscenje", "hidratacija-koze", "relaksacija", "wellness"],
  "hydrorevive-pro-9in1": ["dubinsko-ciscenje", "hidratacija-koze", "ciscenje-koze"],
  "hydrorevive-pro-15in1": ["dubinsko-ciscenje", "hidratacija-koze", "ciscenje-koze", "podmladjivanje-koze"],
  "hydraglow-6-in-1": ["dubinsko-ciscenje", "hidratacija-koze", "podmladjivanje-koze", "ciscenje-koze"],
  "dermaclear-analyzer": ["analiza-koze", "dijagnostika-koze", "ai-analiza"],
  "oxygeneno-bubble-cleanser": ["dubinsko-ciscenje", "ciscenje-koze", "hidratacija-koze"],
  "foto-centrifix": [],
  "lumithera-led-100": ["podmladjivanje-koze", "stimulacija-kolagena", "tretman-akni", "neinvazivno"],
  "lumithera-led-300": ["podmladjivanje-koze", "stimulacija-kolagena", "tretman-akni", "wellness"],
  "lumithera-led-pro": ["podmladjivanje-koze", "stimulacija-kolagena", "tretman-akni", "bezbolan-tretman"],
  "plasma-machine": ["ciscenje-koze", "neinvazivno", "tretman-akni"],
  "co2-celolaser-compact": ["uklanjanje-oziljaka", "uklanjanje-bora", "podmladjivanje-koze", "uklanjanje-bradavica"],
  "co2-celolaser-pro": ["uklanjanje-oziljaka", "uklanjanje-bora", "podmladjivanje-koze", "uklanjanje-bradavica"],
  "celolaser-co2": ["uklanjanje-oziljaka", "uklanjanje-bora", "podmladjivanje-koze"],
  "fotroqlaser": ["uklanjanje-tetovaza", "uklanjanje-pigmentacija", "uklanjanje-trajne-sminke", "podmladjivanje-koze"],
  "frotomini-nd-laser": ["uklanjanje-tetovaza", "uklanjanje-pigmentacija", "podmladjivanje-koze"],
  "frotovertical-nd-laser": ["podmladjivanje-koze", "uklanjanje-pigmentacija", "trajna-depilacija", "tretman-krvnih-sudova"],
  "venalite-980": ["tretman-krvnih-sudova", "neinvazivno"],
  "frotomini-755": ["uklanjanje-tetovaza", "uklanjanje-pigmentacija", "uklanjanje-oziljaka", "tretman-strija"],
  "lasemooth-pro": ["trajna-depilacija", "laserska-depilacija", "uklanjanje-dlaka"],
  "lasemooth-smart": ["trajna-depilacija", "laserska-depilacija", "uklanjanje-dlaka"],
  "luminmax-4-in-1": ["trajna-depilacija", "uklanjanje-tetovaza", "podmladjivanje-koze", "uklanjanje-pigmentacija", "neinvazivno"],
  "thulium-laser-1927nm": ["podmladjivanje-koze", "uklanjanje-bora", "uklanjanje-pigmentacija", "uklanjanje-oziljaka"],
  "dermavision-plus": ["analiza-koze", "dijagnostika-koze", "ai-analiza"],
  "dermavision-x": ["analiza-koze", "dijagnostika-koze", "ai-analiza"],
  "dermavision-master": ["analiza-koze", "dijagnostika-koze", "ai-analiza"],
  "cellusculpt-pro": ["jacanje-misica", "oblikovanje-tela", "redukcija-masti", "jacanje-karlicnog-dna"],
  "icesculpt-360": ["redukcija-masti", "kriolipoliza", "oblikovanje-tela"],
  "dynalines": ["jacanje-misica", "oblikovanje-tela", "redukcija-masti"],
  "ems-chair": ["jacanje-karlicnog-dna", "tretman-inkontinencije", "intimna-nega"],
  "cellushape": ["oblikovanje-tela", "uklanjanje-celulita", "zatezanje-tela", "redukcija-masti"],
  "post-treatment-spray": ["hidratacija-koze", "ciscenje-koze", "relaksacija"],
  "post-treatment-repair-cream": ["hidratacija-koze", "obnova-koze", "bez-oporavka"],
  "post-treatment-defense": ["neinvazivno", "wellness"],
  "post-treatment-collagen-serum": ["podmladjivanje-koze", "stimulacija-kolagena", "hidratacija-koze"],
  "post-treatment-repair-mask": ["hidratacija-koze", "obnova-koze", "bez-oporavka"],
  // --- Novi proizvodi iz Fotromed kataloga (avgust 2026) ---
  "hifu-22d-max": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting"],
  "hifu-12d": ["lifting-lica", "zatezanje-koze", "intimna-nega", "vaginalna-rejuvenacija"],
  "ultralift-7d-pro": ["lifting-lica", "zatezanje-koze", "neinvazivni-lifting", "stimulacija-kolagena"],
  "hydrafacial-ice-blue-7in1": ["dubinsko-ciscenje", "hidratacija-koze", "ciscenje-koze"],
  "scalp-analysis-machine": ["analiza-koze", "dijagnostika-koze"],
  "hydrojelly-mask": ["hidratacija-koze", "relaksacija"],
  "carbon-gel": [],
  "zastitne-naocare-ipl-led-pacijent": [],
  "zastitne-naocare-ipl": [],
  "zastitne-naocare-dijodni-laser": [],};

// ---------------------------------------------------------------------------
// Helper funkcije
// ---------------------------------------------------------------------------

function placeholderImage(label) {
  return {
    img: `https://placehold.co/800x600?text=${encodeURIComponent(label)}`,
    imgDesc: `${label} - privremena placeholder slika, zameniti pravom fotografijom proizvoda`,
  };
}

// ---------------------------------------------------------------------------
// Kategorije
// ---------------------------------------------------------------------------

const categoryDefs = [
  {
    slug: "hifu-lifting-lica-i-tela",
    name: "HIFU – lifting lica i tela",
    shortDescription: "HIFU uređaji za neinvazivni lifting i zatezanje lica i tela fokusiranim ultrazvukom.",
  },
  {
    slug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    name: "Hidrafacijal – nega i dubinsko čišćenje kože",
    shortDescription: "Hidra-dermabrazija i kombinovani sistemi za dubinsko čišćenje, hidrataciju i podmlađivanje kože lica.",
  },
  {
    slug: "frakcioni-co2-laser",
    name: "Frakcioni CO2 laser",
    shortDescription: "Ablativni frakcioni CO2 laseri za resurfacing kože, ožiljke od akni i teksturu kože.",
  },
  {
    slug: "ems-hiemt-oblikovanje-tela-i-lica",
    name: "EMS/HIEMT – oblikovanje tela i lica",
    shortDescription: "Uređaji sa fokusiranim elektromagnetnim poljem za jačanje mišića i oblikovanje tela i lica.",
  },
  {
    slug: "krioliposukcija-redukcija-masnih-naslaga",
    name: "Krioliposukcija – redukcija masnih naslaga",
    shortDescription: "Kontrolisano smrzavanje masnih naslaga za neinvazivnu redukciju lokalizovanih masti.",
  },
  {
    slug: "tulijum-laser-1927nm",
    name: "Tulijum laser 1927nm – neablativno pomlađivanje",
    shortDescription: "Neablativni frakcioni tulijum laser za remodelovanje kolagena, pigmentaciju i teksturu kože.",
  },
  {
    slug: "plazma-aparat",
    name: "Plazma aparat",
    shortDescription: "Hladna i topla plazma tehnologija za zatezanje i regeneraciju kože.",
  },
  {
    slug: "rf-mikroiglicenje",
    name: "RF mikroigličenje",
    shortDescription: "Frakciono RF mikroigličenje za podmlađivanje kože, ožiljke i bore, sa ili bez vakuumske asistencije.",
  },
  {
    slug: "pdt-led-terapija",
    name: "PDT LED terapija",
    shortDescription: "LED fototerapija za stimulaciju kolagena, cirkulacije i regeneracije kože.",
  },
  {
    slug: "ipl-fotoepilacija-i-fotopodmladjivanje",
    name: "IPL – fotoepilacija i fotopodmlađivanje",
    shortDescription: "IPL i SHR sistemi za trajno uklanjanje dlačica, fotopodmlađivanje i tretman pigmentacije.",
  },
  {
    slug: "q-switch-nd-yag-laser",
    name: "Q-Switch Nd:YAG laser – tetovaže i pigmentacija",
    shortDescription: "Q-Switch Nd:YAG laseri za uklanjanje tetovaža, pigmentacija i permanentnog make-upa.",
  },
  {
    slug: "analiza-koze",
    name: "Analiza kože",
    shortDescription: "Uređaji za profesionalnu dijagnostiku i analizu stanja kože i vlasišta.",
  },
  {
    slug: "dijodni-laser-trajna-depilacija",
    name: "Dijodni laser – trajna depilacija",
    shortDescription: "Dijodni laseri sa više talasnih dužina za trajno uklanjanje dlačica na svim tipovima kože.",
  },
  {
    slug: "kavitacija-i-rf-terapija",
    name: "Kavitacija i RF terapija – oblikovanje tela",
    shortDescription: "Ultrazvučna kavitacija i RF vakuum terapija za neinvazivno oblikovanje tela i redukciju celulita.",
  },
  {
    slug: "kozmeticki-proizvodi-post-tretman",
    name: "Kozmetički proizvodi za post-tretman negu",
    shortDescription: "Kozmetički preparati za negu, hidrataciju i smirivanje kože nakon estetskih tretmana.",
  },
  {
    slug: "potrosni-materijal",
    name: "Potrošni materijal i rezervni delovi",
    shortDescription: "Potrošni materijal, zaštitna oprema i rezervni delovi uz estetske uređaje.",
  },
];

// ---------------------------------------------------------------------------
// Proizvodi (definicije) - 61 ukupno (50 postojećih + 12 novih/podeljenih)
// ---------------------------------------------------------------------------

const productDefs = [
  {
    slug: "fotomed-pulse-pro",
    sku: "EST-FOTOMED-PULSE-PRO",
    name: "FotoMed Pulse Pro",
    shortDescription: "Profesionalni sistem za trajno uklanjanje dlačica i podmlađivanje kože kombinovanom SHR i IPL tehnologijom.",
    longDescription: `FotoMed Pulse Pro je vrhunski profesionalni uređaj koji kombinuje SHR (Super Hair Removal) i IPL (Intense Pulsed Light) tehnologiju za efikasno i gotovo bezbolno uklanjanje dlačica, uz mogućnost tretmana kože. Idealan je za salone i klinike koje žele da ponude sveobuhvatne tretmane depilacije i podmlađivanja.

**Princip rada:** SHR tehnologija kombinuje prednosti lasera i pulsirajuće svetlosti za postizanje trajnih rezultata uz minimalnu nelagodnost. Energija se postepeno akumulira u folikulu dlake, što dovodi do njegovog trajnog oštećenja.

**Namena:**
- Trajno uklanjanje dlačica na svim delovima tela
- Podmlađivanje kože
- Uklanjanje pigmentacija
- Tretman akni i vaskularnih lezija

**Ključne karakteristike:**
- Kombinovana SHR i IPL tehnologija
- Veliki tretman head (16x57mm i 8x34mm) za brže tretmane
- Ugrađen sistem hlađenja (poluprovodničko + vazdušno + vodeno) za veći komfor
- Taster na ručici za jednostavnu kontrolu
- Dug vek trajanja lampe (do 300.000 impulsa)

**Tehničke specifikacije:**
- Izvor svetlosti: Ksenonska lampa
- Talasne dužine: SR: 560-1200nm / HR: 690-1200nm
- Sistem prenosa: Kristalni svetlovod
- Sigurnosna klasa: Klasa 1 Tip B
- Trajanje impulsa: IPL: 2~9.9ms, SHR: 2~10ms
- Frekvencija ponavljanja: 1~10Hz (HR), 2~10Hz (FP)
- Dimenzije (Š x D x V): 525mm x 490mm x 1080mm
- Težina (neto): 45kg
- Snaga: 3000VA
- Napon: AC230V, 50Hz

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-IPL-PULSE-PRO
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ipl-fotoepilacija-i-fotopodmladjivanje",
    image: placeholderImage("FotoMed Pulse Pro"),
    seoKeywords: [
      "fotomed pulse pro",
      "SHR depilacija",
      "IPL depilacija",
      "trajno uklanjanje dlaka",
      "profesionalna depilacija",
      "podmlađivanje kože laserom",
      "beauty machine",
      "estetski uređaj",
    ],
    metaDescription:
      "FotoMed Pulse Pro - profesionalni SHR i IPL uređaj za trajno uklanjanje dlaka i podmlađivanje kože. Idealno za salone i klinike. Brz, efikasan i bezbolan tretman.",
    faq: [
      {
        question: "Koja je razlika između SHR i IPL tretmana?",
        answer:
          "SHR (Super Hair Removal) je naprednija tehnologija koja kombinuje prednosti lasera i IPL-a. Energija se isporučuje u seriji brzih impulsa, što omogućava postepeno zagrevanje folikula i gotovo bezbolan tretman, za razliku od klasičnog IPL-a koji koristi pojedinačne jake impulse.",
      },
      {
        question: "Za koje tipove kože je FotoMed Pulse Pro pogodan?",
        answer:
          "FotoMed Pulse Pro je pogodan za sve tipove kože, uključujući i tamnije fototipove, zahvaljujući SHR tehnologiji koja nežno tretira kožu.",
      },
      {
        question: "Koliko tretmana je potrebno za trajno uklanjanje dlaka?",
        answer:
          "Broj tretmana varira u zavisnosti od boje i debljine dlake, tipa kože i tretirane oblasti. U proseku je potrebno 6-8 tretmana za postizanje trajnih rezultata.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotomed-pulse-mini",
    sku: "EST-FOTOMED-PULSE-MINI",
    name: "FotoMed Pulse Mini",
    shortDescription: "Kompaktni profesionalni sistem za SHR depilaciju i tretman kože, idealan za manje prostore.",
    longDescription: `FotoMed Pulse Mini je kompaktna verzija popularnog FotoMed Pulse sistema, namenjena salonima i klinikama sa ograničenim prostorom. Uprkos manjim dimenzijama, nudi sve prednosti SHR tehnologije za efikasnu i bezbolnu depilaciju.

**Princip rada:** Kao i veći model, koristi SHR tehnologiju za postepeno zagrevanje folikula dlake, što rezultira trajnim uklanjanjem dlaka uz minimalnu nelagodnost.

**Namena:**
- Trajno uklanjanje dlačica
- Podmlađivanje kože
- Uklanjanje pigmentacija

**Ključne karakteristike:**
- Kompaktan dizajn, lak za prenošenje
- 2 ručke u jednom uređaju (isplativo)
- Ukupno 600.000 impulsa (dve ručke)
- Pogodan za sve tipove kože, uključujući tamniju kožu
- SHR ručka za brzu depilaciju, Elight ručka za tretman kože

**Tehničke specifikacije:**
- Naziv proizvoda: FotroMed Plus Mini Hair Removal Light skin rejuvenation System
- Ručke: 2 ručke: SHR i Elight
- Funkcije: Brza depilacija, podmlađivanje kože, uklanjanje pigmentacija, lifting grudi, uklanjanje akni i vaskularnih lezija
- Izlazna snaga: 2500w
- Ekran: 10-inch color touch screen
- Sistem hlađenja: Voda + poluprovodničko + vazduh + ekran
- Energija (SHR): 1-50J/cm²
- Energija (Elight): 1-50J/cm²
- Frekvencija: 1-10Hz
- Talasne dužine: SR:560-1200nm/HR:690-1200nm
- Veličina tačke: SR: 15*50mm, Elight: 10*50mm
- SHR lampa: Uvezena iz UK
- SHR impulsi: 300.000 impulsa
- Pakovanje: Aluminijumski kofer

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-IPL-PULSE-MINI
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ipl-fotoepilacija-i-fotopodmladjivanje",
    image: placeholderImage("FotoMed Pulse Mini"),
    seoKeywords: [
      "fotomed pulse mini",
      "SHR depilacija",
      "kompaktni SHR uređaj",
      "profesionalna depilacija",
      "trajno uklanjanje dlaka",
      "elight tretman",
    ],
    metaDescription:
      "FotoMed Pulse Mini - kompaktni SHR uređaj za profesionalnu depilaciju i podmlađivanje kože. Idealan za manje prostore. 2 ručke, 600.000 impulsa, pogodan za sve tipove kože.",
    faq: [
      {
        question: "Koja je razlika između FotoMed Pulse Mini i Pro modela?",
        answer:
          "Glavna razlika je u veličini i kapacitetu. Mini model je kompaktniji i lakši za prenošenje, sa nešto manjim brojem impulsa po ručici (300.000), dok Pro model ima veći kapacitet i dodatne funkcije.",
      },
      {
        question: "Da li je FotoMed Pulse Mini pogodan za tretman lica?",
        answer:
          "Da, uz odgovarajuće nastavke i podešavanje energije, FotoMed Pulse Mini se može koristiti za tretman dlačica na licu, uključujući gornju usnu i bradu.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "ultralift-sd-compact",
    sku: "EST-ULTRALIFT-SD-COMPACT",
    name: "UltraLift SD Compact",
    shortDescription: "Kombinuje MFU (mikrofokusirani ultrazvuk) i RF energiju u tehnici tačkastog nanošenja radi pojačane proizvodnje kolagena i zatezanja kože.",
    longDescription: `UltraLift SD Compact je revolucionarni uređaj koji kombinuje dve moćne tehnologije – mikrofokusirani ultrazvuk (MFU) i radiofrekvenciju (RF) – u jednom tretmanu. Ova sinergija omogućava izuzetne rezultate u zatezanju i podmlađivanju kože, bez hirurške intervencije.

**Princip rada – Synergy Dotting:** U svakom impulsu prvo se emituje RF energija koja nežno zagreva površinske slojeve kože, a zatim MFU koji precizno deluje na dublje slojeve. Ova kombinacija stvara izraženiji termalni efekat, što dovodi do pojačane proizvodnje kolagena i elastina.

**Namena:**
- MFU oblikovanje tela i zatezanje kože: stomak, bokovi, linija grudnjaka, vrat, dekolte, ruke, pazuha
- Nehirurški lifting lica
- Smanjenje bora i finih linija

**Ključne karakteristike:**
- Tačkasta sinergija MFU i RF energije
- Izraženiji termalni efekat u odnosu na standardni MFU
- Pojačana aktivacija kolagena
- Bolja proizvodnja elastina
- Pametni sistem sa Quattro ručkama
- TIS (Treatment Information System) za praćenje tretmana
- RMS (Remote Maintenance System) za daljinsku podršku
- Automatski i ručni režim rada

**Tehničke specifikacije:**
- Standardni MFU nastavci: 1.5mm [7MHz], 3.0mm [7MHz], 4.5mm [4MHz], 9.0mm [2MHz]
- Opcioni MFU nastavci: 2.0mm [7MHz], 6.0mm [2MHz]
- Standardni SD nastavci: 1.5mm [7MHz], 3.0mm [7MHz], 4.5mm [4MHz], 9.0mm [2MHz]
- RF energija: 2MHz / Level 1-10
- Dubina: 1.0-5.0mm
- Dužina: 5.0-25mm [1.0mm step]
- Ekran: Sub LCD na ručici
- Dimenzije: 400 × 290 × 530cm
- Težina: 15kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-SD
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("UltraLift SD Compact"),
    seoKeywords: [
      "ultralift sd compact",
      "MFU lifting",
      "RF lifting",
      "zatezanje kože",
      "neinvazivni lifting lica",
      "podmlađivanje kože",
      "lifting bez operacije",
    ],
    metaDescription:
      "UltraLift SD Compact - kombinuje MFU i RF za neinvazivno zatezanje kože i lifting lica. Sinergijski efekat za vidljive rezultate bez operacije. Idealan za stomak, vrat, dekolte i ruke.",
    faq: [
      {
        question: "Šta je Synergy Dotting tehnologija?",
        answer:
          "Synergy Dotting je jedinstvena tehnologija koja u svakom impulsu kombinuje RF (za zagrevanje površinskih slojeva) i MFU (za dubinsko delovanje). Ova kombinacija stvara izraženiji termalni efekat i podstiče sintezu kolagena i elastina.",
      },
      {
        question: "Koliko je tretmana potrebno za vidljive rezultate?",
        answer:
          "Već posle prvog tretmana primećuju se rezultati, ali puni efekat se postiže nakon 2-3 tretmana, u zavisnosti od stanja kože i tretirane oblasti. Rezultati se poboljšavaju tokom narednih meseci.",
      },
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman je minimalno invazivan i većina klijenata opisuje ga kao prijatan. RF prethodno zagrevanje kože dodatno smanjuje nelagodnost.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotohifu-delux",
    sku: "EST-FOTOHIFU-DELUX",
    name: "FotoHIFU delux",
    shortDescription: "Fokusirani ultrazvuk visoke energije dopire do SMAS sloja radi poboljšanja potpornih struktura lica i rešavanja opuštenosti kože.",
    longDescription: `FotoHIFU delux je profesionalni HIFU uređaj koji koristi fokusirani ultrazvuk visoke energije za neinvazivni lifting i zatezanje kože. Preciznim delovanjem na SMAS sloj, postiže efekte slične hirurškom liftingu, bez rezova i oporavka.

**Princip rada:** Fokusira ultrazvučnu energiju na SMAS sloj (4,5 mm) radi liftinga i na kolageni sloj (3 mm) radi restrukturiranja, posvetljivanja i uklanjanja bora. Energija prodire kroz epidermu bez oštećenja kože, što ga čini izuzetno bezbednim.

**Namena:**
- Nehirurški lifting lica, vrata i dekoltea
- Zatezanje opuštene kože
- Smanjenje bora i finih linija
- Poboljšanje kontura lica

**Ključne karakteristike:**
- Precizno fokusiranje na SMAS sloj
- Bezbedan za kožu – energija ne oštećuje epidermu
- Brzi rezultati – već posle prvog tretmana
- Bez perioda oporavka

**Tehničke specifikacije:**
- Vrsta: HIFU (High-Intensity Focused Ultrasound)
- Dubina fokusa: 4.5mm (SMAS), 3mm (dermis)
- Frekvencija: 4MHz, 7MHz
- Energija: Podesiva
- Ekran: Touch screen

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-DLX
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("FotoHIFU delux"),
    seoKeywords: [
      "fotohifu delux",
      "HIFU lifting",
      "lifting bez operacije",
      "zatezanje kože",
      "podmlađivanje lica",
      "neinvazivni lifting",
    ],
    metaDescription:
      "FotoHIFU delux - profesionalni HIFU uređaj za neinvazivni lifting lica i zatezanje kože. Deluje na SMAS sloj, bez operacije i oporavka. Brzi i vidljivi rezultati.",
    faq: [
      {
        question: "Šta je SMAS sloj i zašto je važan?",
        answer:
          "SMAS (Superficial Musculoaponeurotic System) je sloj vezivnog tkiva koji se zateže tokom hirurškog liftinga lica. HIFU tehnologija omogućava zagrevanje ovog sloja bez operacije, što dovodi do kontrakcije i zatezanja kože.",
      },
      {
        question: "Koliko dugo traju rezultati HIFU tretmana?",
        answer:
          "Rezultati HIFU tretmana su dugotrajni. Stimulacija kolagena traje nekoliko meseci nakon tretmana, a efekti mogu trajati i do 12-18 meseci, u zavisnosti od starosti i stanja kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotohifu-dual",
    sku: "EST-FOTOHIFU-DUAL",
    name: "FotoHIFU Dual",
    shortDescription: "Multifunkcionalni uređaj koji kombinuje 4D HIFU i Vmax tehnologiju za neinvazivni lifting i oblikovanje lica, vrata i tela.",
    longDescription: `FotoHIFU Dual je vrhunski multifunkcionalni estetski uređaj koji kombinuje dve napredne tehnologije – 4D HIFU i Vmax – za sveobuhvatno oblikovanje lica, vrata i tela. Nudi fleksibilnost i prilagođavanje različitim tipovima kože i anatomskim karakteristikama.

**Namena:**
- Nehirurški lifting lica
- Zatezanje vrata i dekoltea
- Oblikovanje tela
- Smanjenje bora
- Poboljšanje elastičnosti kože

**Ključne karakteristike:**
- Multifunkcionalnost – 4D HIFU + Vmax
- Neinvazivnost – bez operacije i oporavka
- Širok spektar zona tretmana
- Brzi rezultati
- Prilagođeni rezultati
- Veća fleksibilnost primene

**Tehničke specifikacije:**
- Ekran: 15 inch touch screen
- Standardni HIFU nastavci: 1.5mm / 3.0mm / 4.5mm
- Opcioni HIFU nastavci: 8.0mm / 6mm / 10mm / 13mm / 16mm
- Frekvencija nastavaka: 4MHZ, 7MHZ
- HIFU energija: 0.2-1.2J (0.13 step, 18 steps)
- Vek trajanja HIFU sonde: 20000 impulsa
- HIFU dužina: 5-25mm (1.0mm step, 20 steps)
- Standardni PEN nastavci: 1.5mm / 3.0mm / 4.5mm
- Opcioni PEN nastavci: Breast 4.5mm / 8.0mm / 13.0mm
- Vek trajanja PEN sonde: 60000 impulsa
- Dimenzije: 31*44*50cm
- Težina: 15KG
- Napon: AC110V-240V, 50/60Hz

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-DUAL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("FotoHIFU Dual"),
    seoKeywords: [
      "fotohifu dual",
      "4D HIFU",
      "Vmax",
      "lifting lica",
      "oblikovanje tela",
      "zatezanje kože",
      "neinvazivni tretman",
    ],
    metaDescription:
      "FotoHIFU Dual - multifunkcionalni uređaj koji kombinuje 4D HIFU i Vmax za lifting lica, zatezanje vrata i oblikovanje tela. Bez operacije, brzi rezultati.",
    faq: [
      {
        question: "Šta je Vmax tehnologija?",
        answer:
          "Vmax je napredna tehnologija koja koristi fokusirani ultrazvuk za oblikovanje tela, posebno efikasna za redukciju masnih naslaga i zatezanje kože na većim površinama.",
      },
      {
        question: "Da li se FotoHIFU Dual može koristiti za tretman tela?",
        answer:
          "Da, FotoHIFU Dual je namenjen i za tretman tela, uključujući stomak, butine, ruke i druge oblasti, zahvaljujući Vmax tehnologiji i opcionim nastavcima.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotohifu-femi",
    sku: "EST-FOTOHIFU-FEMI",
    name: "FotoHifu Femi",
    shortDescription: "Inovativno rešenje za intimno zdravlje žena zasnovano na 3D HIFU tehnologiji za zatezanje i podmlađivanje dubljih tkiva.",
    longDescription: `FotoHifu Femi je specijalizovani uređaj za intimnu negu žena, koji koristi naprednu 3D HIFU tehnologiju za neinvazivno zatezanje i podmlađivanje. Namenjen je poboljšanju kvaliteta života i samopouzdanja.

**Princip rada:** Deluje na dublja tkiva i podstiče proizvodnju kolagena, što rezultira zatezanjem i podmlađivanjem.

**Namena:** Intimno zdravlje i wellness žena.

**Tehničke specifikacije:**
- Naziv proizvoda: FotroHifu Femi (hifu + Vmax + privacy)
- Ekran: 15" color touch LCD screen
- Frekvencija nastavaka: 4MHZ, 7MHZ
- Standardni Vmax nastavci: 1.5mm/3.0mm/4.5 mm
- Opcioni Vmax nastavci: Breast4.5mm/8.0mm/13.0mm
- Standardni vaginalni nastavci: 3.0mm/4.5mm
- Standardni HIFU nastavci: 1.5mm/3.0mm/4.5 mm
- Opcioni HIFU nastavci: 8.0mm/6mm/10mm/13mm/16mm
- HIFU energija: 0.2-1.2(0.1Jstep,18 steps)
- Vek trajanja Vmax sonde: 62000 impulsa
- Vek trajanja vaginalne sonde: 10000 impulsa
- Vek trajanja HIFU sonde: 20000 impulsa
- HIFU dužina: 5-25mm(1.0mm step,20steps)
- Dimenzije: 20*40*54cm
- Težina: About 15Kg
- Napon: AC100V-240V,50/60Hz

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-FEMI
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("FotoHifu Femi"),
    seoKeywords: [
      "fotohifu femi",
      "intimna nega",
      "vaginalna rejuvenacija",
      "žensko zdravlje",
      "HIFU intimni tretman",
      "zatezanje",
    ],
    metaDescription:
      "FotoHifu Femi - inovativni HIFU uređaj za intimno zdravlje žena. Neinvazivno zatezanje i podmlađivanje. Poboljšava kvalitet života i samopouzdanje.",
    faq: [
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman je neinvazivan i većina korisnica opisuje ga kao prijatan. Specijalno dizajnirani nastavci obezbeđuju maksimalan komfor.",
      },
      {
        question: "Koliko traje tretman?",
        answer:
          "Tretman obično traje između 30 i 60 minuta, u zavisnosti od tretirane oblasti i protokola.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotohifu-max",
    sku: "EST-FOTOHIFU-MAX",
    name: "FotoHIFU Max",
    shortDescription: "Koristi 4D HIFU tehnologiju za izuzetan lifting i zatezanje kože, delujući na više slojeva istovremeno.",
    longDescription: `FotoHIFU Max je najnapredniji uređaj u asortimanu, koji kombinuje 4D HIFU, Liposonix, Vmax i MNRF tehnologije u jednom uređaju. Namenjen je klinikama koje žele da ponude sveobuhvatne tretmane lica, tela i intimne nege.

**Namena:**
- Lifting i zatezanje kože
- Oblikovanje tela
- 360° intimna nega
- Multifunkcionalni estetski tretmani

**Ključne karakteristike:**
- MNRF, Liposonix, HIFU i Vmax u jednom multifunkcionalnom uređaju
- 4 ručke u jednom uređaju
- Najnovija generacija FotoHIFU tehnologije
- Rotaciona emisija od 360° za intimnu negu
- Liposonix funkcija deluje na različitim dubinama masnog tkiva
- Jedinstven izolacioni mikrokristalni dizajn

**Tehničke specifikacije:**
- Naziv proizvoda: FotoHifu Max (Liposonix + hifu + Vmax+privacy)
- Nominalna struja: 1A
- Standardni nastavci: HIFU with 3 pcs(optional), Vaginal probe with 2 pcs, Vmax probe with 3 pcs(optional), Lipo with 2 cartridges
- Opcije nastavaka: FotoHIFU catridges:1.5mm/3.0mm/4.5mm/6.0mm/8.0mm/10.0mm/13.0mm/16.0mm (optional); Vmax probe:1.5mm/3.0mm/4.5mm/8.0mm/13.0mm(optional); Lipo cartridge: 8.0mm and 13.0mm Vaginal tightening probe: 3.0mm, 4.5mm
- Vek trajanja nastavaka: FotoHIFU:20000 impulsa, Vmax/62000 impulsa
- Izlazna energija: 0.1-2j Adjustable
- Snaga: 800W

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-MAX
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("FotoHIFU Max"),
    seoKeywords: [
      "fotohifu max",
      "4D HIFU",
      "Liposonix",
      "MNRF",
      "lifting lica",
      "oblikovanje tela",
      "intimna nega",
    ],
    metaDescription:
      "FotoHIFU Max - vrhunski multifunkcionalni uređaj sa 4D HIFU, Liposonix, Vmax i MNRF. Za lifting lica, oblikovanje tela i 360° intimnu negu. Sve u jednom.",
    faq: [
      {
        question: "Šta je Liposonix tehnologija?",
        answer:
          "Liposonix je neinvazivna tehnologija koja koristi fokusirani ultrazvuk za razbijanje masnih ćelija, što omogućava oblikovanje tela bez operacije.",
      },
      {
        question: "Koje sve tretmane nudi FotoHIFU Max?",
        answer:
          "FotoHIFU Max nudi lifting lica, zatezanje kože, oblikovanje tela, 360° intimnu negu, tretman masnih naslaga i podmlađivanje kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "ultrafarma-7d-hifu",
    sku: "EST-ULTRAFARMA-7D-HIFU",
    name: "Ultrafarma 7D HIFU Machine",
    shortDescription: "Vrhunac nehirurške nege kože zahvaljujući 7D HIFU tehnologiji za prirodan lifting i zatezanje.",
    longDescription: `Ultrafarma 7D HIFU Machine predstavlja vrhunac tehnologije u nehirurškoj nezi kože. Koristi naprednu 7D HIFU tehnologiju za precizno i efikasno zatezanje i lifting, sa dugotrajnim rezultatima.

**Princip rada:** Deluje na dublje slojeve kože i podstiče proizvodnju kolagena i elastina, što dovodi do prirodnog liftinga i zatezanja.

**Tehničke specifikacije:**
- Energija: HIFU
- Fluenca: 0.1~3.0J (0.1step)
- Nastavci: 7Mhz,4Mhz, 1.5mm 2.0mm 3.0mm 4.5mm 6.0mm 9.0mm 13.0mm
- Razmak: 1.0~2.0mm(0.5mm/step)
- Dužina: 5~25mm(5mm/step)
- Napajanje: AC100~240V, 50/60Hz
- Težina: 35kg
- Dimenzije: 500x515x1310(WxDxH)

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-UF7D
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("Ultrafarma 7D HIFU Machine"),
    seoKeywords: [
      "ultrafarma 7d hifu",
      "7D HIFU",
      "lifting lica",
      "zatezanje kože",
      "neinvazivni lifting",
      "podmlađivanje",
    ],
    metaDescription:
      "Ultrafarma 7D HIFU Machine - vrhunski uređaj za nehirurški lifting i zatezanje kože. 7D HIFU tehnologija za prirodne i dugotrajne rezultate.",
    faq: [
      {
        question: "Šta znači 7D u nazivu?",
        answer:
          "7D označava sedam različitih dubina tretmana, što omogućava sveobuhvatno delovanje na sve slojeve kože – od površinskog do dubokog SMAS sloja.",
      },
      {
        question: "Koliko traje oporavak nakon tretmana?",
        answer:
          "Tretman je neinvazivan i ne zahteva oporavak. Klijenti se mogu odmah vratiti svakodnevnim aktivnostima.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "360-max-hifu",
    sku: "EST-360-MAX-HIFU",
    name: "360 Max HIFU",
    shortDescription: "Platforma sa tri tehnologije – HIFU, RF na 6,78 MHz i EMS – za lifting lica i oblikovanje tela.",
    longDescription: `360 Max HIFU je napredna tri-modulna platforma koja sinhronizovano kombinuje HIFU, RF i EMS tehnologije za maksimalne rezultate u liftingu lica i oblikovanju tela.

**Princip rada:** Isporučuje dublju termalnu energiju do SMAS sloja i podstiče ćelijsku obnovu. RF zagreva površinske slojeve, dok EMS stimuliše mišiće za dodatno zatezanje.

**Nastavci:**
- 7 tipova nastavaka različitih dubina (1,5–13 mm) za različite zone lica i tela

**Tehničke specifikacije:**
- Radna ručka: 15RS, 18RS i 36RS
- Snaga: 1180W
- Napajanje: 100-240 V, 50/60 Hz
- Ultrazvučni izlaz: 0.1-3.0 (korak 0.1)
- Ponavljanje: 0.1-1.05EC (korak 0.15EC)
- Dužina: 5-25mm (korak 5mm)
- Tačka: 0.1-2.0mm (korak 0.1mm)

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-25D
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("360 Max HIFU"),
    seoKeywords: [
      "360 max hifu",
      "HIFU RF EMS",
      "lifting lica",
      "oblikovanje tela",
      "neinvazivni tretman",
      "zatezanje kože",
    ],
    metaDescription:
      "360 Max HIFU - tri-modulna platforma (HIFU + RF + EMS) za lifting lica i oblikovanje tela. Sinergijski efekat za maksimalne rezultate.",
    faq: [
      {
        question: "Koja je prednost kombinovanja HIFU, RF i EMS tehnologije?",
        answer:
          "Kombinacija omogućava sveobuhvatan tretman: HIFU deluje na duboke slojeve, RF zateže površinske, a EMS stimuliše mišiće, što daje bolje i brže rezultate.",
      },
      {
        question: "Za koje oblasti je uređaj namenjen?",
        answer:
          "Uređaj je namenjen za lice (obrve, jagodice, vilica), vrat, dekolte i telo (stomak, butine, ruke).",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "magnilift-ems-pro",
    sku: "EST-MAGNILIFT-EMS-PRO",
    name: "MagniLift EMS Pro",
    shortDescription: "Nehirurški tretman lica koji kombinuje EMT, HILFES i PCRF tehnologije.",
    longDescription: `MagniLift EMS Pro je revolucionarni uređaj za nehirurški tretman lica koji kombinuje tri napredne tehnologije: EMT, HILFES i PCRF. Namenjen je podmlađivanju i zatezanju kože bez operacije.

**Princip rada:** Sinhronizovana radiofrekvencija zagreva dermu i podstiče kolagen, dok snažna pulsirajuća magnetna tehnologija diže tkiva lica kontrakcijom mišića.

**Namena:**
- Oblikovanje lica i zatezanje kože
- Smanjenje opuštenosti i poboljšanje teksture kože
- Ublažavanje bora i finih linija
- Podsticanje kolagena i cirkulacije

**Ključne karakteristike:**
- Napredna EMS tehnologija
- Neinvazivan tretman
- Podesiva podešavanja
- Vidljivi rezultati
- Ergonomski dizajn

**Tehničke specifikacije:**
- Tip: Stojeći
- Ciljana oblast: Lice, oči, čelo
- Naziv proizvoda: MFFACE
- Tehnologija: HILFES
- Funkcije: Uklanjanje bora, lifting lica, zatezanje kože
- Ručke: 6 kom
- Snaga: 550VA
- Napajanje: AC100-240V, 50-60HZ
- Utikači: US, EU, CN, AU, UK, JP, ZA, IT

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-EMS-MLP
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ems-hiemt-oblikovanje-tela-i-lica",
    image: placeholderImage("MagniLift EMS Pro"),
    seoKeywords: [
      "magnilift ems pro",
      "EMS lifting lica",
      "neinvazivni lifting",
      "zatezanje kože",
      "EMT HILFES PCRF",
      "podmlađivanje lica",
    ],
    metaDescription:
      "MagniLift EMS Pro - nehirurški tretman lica sa EMT, HILFES i PCRF tehnologijama. Za lifting, zatezanje i podmlađivanje kože. Bez operacije.",
    faq: [
      {
        question: "Šta je HILFES tehnologija?",
        answer:
          "HILFES je napredna tehnologija koja kombinuje sinhronizovanu radiofrekvenciju i snažnu pulsirajuću magnetnu stimulaciju za lifting i zatezanje kože.",
      },
      {
        question: "Koliko traje jedan tretman?",
        answer:
          "Tretman traje oko 20-30 minuta i ne zahteva oporavak, što ga čini idealnim za užurbani raspored.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "magnilift-ems-compact",
    sku: "EST-MAGNILIFT-EMS-COMPACT",
    name: "MagniLift EMS Compact",
    shortDescription: "V-line tretman liftinga lica uz pomoć EMT, HILFES i PCRF tehnologije.",
    longDescription: `MagniLift EMS Compact je kompaktna verzija popularnog MagniLift EMS sistema, namenjena brzim i efikasnim V-line tretmanima lica.

**Princip rada:** Sinhronizovana termalna energija i snažna pulsirajuća magnetna tehnologija stimulišu mišiće lica i zatežu kožu.

**Namena:**
- Lifting lica
- Smanjenje bora
- Tonifikacija mišića
- Neinvazivna primena

**Ključne karakteristike:**
- Sinhronizovana termalna i magnetna tehnologija
- Neinvazivna stimulacija mišića
- Brz tretman od 20 minuta
- Deluje na ključne mišiće lica
- Do 75.000 mišićnih kontrakcija po tretmanu

**Tehničke specifikacije:**
- Tip: Stojeći
- Ciljana oblast: Lice, oči, čelo
- Naziv proizvoda: MFFACE
- Tehnologija: HILFES
- Funkcije: Uklanjanje bora, lifting lica, zatezanje kože
- Ručke: 6 kom
- Snaga: 550VA
- Napajanje: AC100-240V, 50-60HZ
- Utikači: US, EU, CN, AU, UK, JP, ZA, IT

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-EMS-MLC
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ems-hiemt-oblikovanje-tela-i-lica",
    image: placeholderImage("MagniLift EMS Compact"),
    seoKeywords: [
      "magnilift ems compact",
      "V-line lifting",
      "EMS lifting",
      "zatezanje lica",
      "neinvazivni tretman",
    ],
    metaDescription:
      "MagniLift EMS Compact - kompaktni EMS uređaj za V-line lifting lica. Brz tretman od 20 minuta, bez operacije. Do 75.000 mišićnih kontrakcija.",
    faq: [
      {
        question: "Šta je V-line tretman?",
        answer:
          "V-line tretman je specifičan protokol koji cilja na mišiće donjeg dela lica i vilice, stvarajući izraženiji i definisaniji oblik lica.",
      },
      {
        question: "Da li je tretman bezbedan?",
        answer:
          "Da, tretman je potpuno bezbedan i neinvazivan. Koristi se u profesionalnim salonima i klinikama širom sveta.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "derma-frac-mnrf",
    sku: "EST-DERMA-FRAC-MNRF",
    name: "Derma Frac MNRF",
    shortDescription: "Mikroigličasti frakcioni RF sistem za tretmane lica i tela.",
    longDescription: `Derma Frac MNRF je napredni sistem koji kombinuje mikronedle sa radiofrekvencijom za frakciono podmlađivanje kože. Namenjen je tretmanu lica i tela, sa minimalnim vremenom oporavka.

**Tretman lica:**
- Nehirurški lifting
- Smanjenje bora
- Zatezanje kože
- Podmlađivanje
- Sužavanje pora
- Ožiljci od akni

**Tretman tela:**
- Ožiljci
- Strije

**Ključne karakteristike:**
- Bez perioda oporavka, bezbolno
- Precizno kontrolisana RF energija sa podesivom dubinom igala (0,5–3,5 mm)
- Ravnomerna termoliza zahvaljujući optimalnom razmaku igala
- Precizan i bezbedan tretman uz funkciju podešavanja svetla
- Brz i jednostavan rad putem 10,4-inčnog kolor touch ekrana

**Tehničke specifikacije:**
- Tip sistema: Bipolarni RF sa vakuumom
- Režim rada: Mikroiglice sa radiofrekvencijom
- Veličina ekrana: 10.4 inch TFT Color Touch Screen
- Frekvencija: 2-4MHZ
- Usis: 1-2
- Brzina: 0.1s to 0.5s
- Dubina: 0.2mm to 3.5mm
- RF energija: 10W-150W
- Veličine igala: 10, 25, 64 igle i nastavak bez igle
- Diodni laser indikator: 650nm 50mw
- Napon: 110V/220V/60Hz/50Hz

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-RFM-VAC
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "rf-mikroiglicenje",
    image: placeholderImage("Derma Frac MNRF"),
    seoKeywords: [
      "derma frac mnrf",
      "RF mikronedling",
      "frakcioni RF",
      "podmlađivanje kože",
      "tretman ožiljaka",
      "lifting lica",
      "smanjenje bora",
    ],
    metaDescription:
      "Derma Frac MNRF - mikroigličasti frakcioni RF sistem za podmlađivanje kože, tretman ožiljaka i lifting lica. Bez oporavka, precizan i bezbedan.",
    faq: [
      {
        question: "Kako funkcioniše RF mikronedling?",
        answer:
          "RF mikronedling kombinuje mikroiglice koje stvaraju mikrokanale u koži i radiofrekventnu energiju koja se isporučuje kroz njih. To stimuliše prirodni proces zarastanja i proizvodnju kolagena.",
      },
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman je minimalno invazivan. Pre tretmana se nanosi anestetička krema kako bi se obezbedio maksimalan komfor.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "derma-pulse",
    sku: "EST-DERMA-PULSE",
    name: "Derma Pulse",
    shortDescription: "DermaPulse uređaj sa zlatnim RF vrhovima za različite tretmane kože.",
    longDescription: `Derma Pulse je profesionalni RF uređaj sa zlatnim vrhovima, namenjen širokom spektru tretmana kože. Idealna je kombinacija za salone i klinike koje žele da ponude sveobuhvatne usluge.

**Namena:**
- Uklanjanje bora
- Podmlađivanje lica
- Remodelovanje masti i kolagena
- Postporođajni oporavak
- Podmlađivanje kože
- Uklanjanje ožiljaka
- Tretman akni
- Dezodoracija
- Redovna nega kože

**Tehničke specifikacije:**
- Naziv proizvoda: DermaPulse (Gold RF DermaPulse)
- Ekran: 15 inča
- Terapijske sonde: 12P, 24P, 40P, Nanocrystalline Head
- Dubina: 0.5-7mm
- Izlazna frekvencija: 4MHz
- Radni napon: AC110V～230V±10%, 50Hz-60Hz
- Snaga: 10-300W
- Dimenzije kućišta: 40×43×42cm
- Bruto težina: 12.8kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-RFM-PORT
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "rf-mikroiglicenje",
    image: placeholderImage("Derma Pulse"),
    seoKeywords: [
      "derma pulse",
      "RF tretman kože",
      "zlatni RF vrhovi",
      "podmlađivanje",
      "tretman akni",
      "uklanjanje bora",
      "remodelovanje kolagena",
    ],
    metaDescription:
      "Derma Pulse - profesionalni RF uređaj sa zlatnim vrhovima za podmlađivanje kože, tretman akni, uklanjanje bora i ožiljaka. Višenamenski i efikasan.",
    faq: [
      {
        question: "Koje su prednosti zlatnih RF vrhova?",
        answer:
          "Zlatni vrhovi su hipoalergeni i omogućavaju bolju provodljivost RF energije, što rezultira efikasnijim tretmanom i manjom iritacijom kože.",
      },
      {
        question: "Za koje tipove kože je Derma Pulse pogodan?",
        answer:
          "Derma Pulse je pogodan za sve tipove kože, zahvaljujući podesivim parametrima i različitim vrstama vrhova.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "derma-pulse-xl",
    sku: "EST-DERMA-PULSE-XL",
    name: "Derma Pulse xl",
    shortDescription: "Gold RF uređaj sa kristalnim vrhovima, dubina do 8 nivoa.",
    longDescription: `Derma Pulse XL je napredna verzija Derma Pulse uređaja, sa kristalnim vrhovima i većom dubinom tretmana. Namenjen je profesionalnim klinikama koje zahtevaju vrhunske rezultate.

**Namena:**
- Podmlađivanje kože
- Tretman ožiljaka
- Smanjenje hiperpigmentacije
- Bolja apsorpcija kozmetičkih preparata
- Podsticanje rasta kose

**Tehničke specifikacije:**
- Naziv proizvoda: Crystallite Depth 8 (Gold RF Crystallite Depth 8)
- Ekran: 10.4 inča
- Terapijske sonde: 12P, 24P, 40P, Nanocrystalline Head
- Dubina: 0.5-7mm
- Izlazna frekvencija: 4MHz
- Radni napon: AC110V~230V±10%, 50Hz-60Hz
- Snaga: 10-300W
- Dimenzije kućišta: 49×46×102cm
- Bruto težina: 28.4kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-RFM-XL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "rf-mikroiglicenje",
    image: placeholderImage("Derma Pulse xl"),
    seoKeywords: [
      "derma pulse xl",
      "RF tretman",
      "kristalni vrhovi",
      "podmlađivanje kože",
      "tretman ožiljaka",
      "hiperpigmentacija",
      "rast kose",
    ],
    metaDescription:
      "Derma Pulse XL - napredni RF uređaj sa kristalnim vrhovima za podmlađivanje kože, tretman ožiljaka i hiperpigmentacije. Dubinski tretman do 8 nivoa.",
    faq: [
      {
        question: "Po čemu se Derma Pulse XL razlikuje od Derma Pulse modela?",
        answer:
          "Derma Pulse XL ima kristalne vrhove koji omogućavaju dublji prodor RF energije i bolje rezultate, posebno kod tretmana ožiljaka i strija.",
      },
      {
        question: "Da li se uređaj može koristiti za tretman kose?",
        answer:
          "Da, Derma Pulse XL se može koristiti za stimulaciju rasta kose na vlasištu, zahvaljujući sposobnosti podsticanja cirkulacije i regeneracije tkiva.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fda-approved-rf-microneedling",
    sku: "EST-FDA-APPROVED-RF-MICRONEEDLING",
    name: "FDA Approved RF Microneedling Machine",
    shortDescription: "Spaja inženjersku preciznost i klinički potvrđenu efikasnost za savremene estetske procedure.",
    longDescription: `FotoMed AWNS je FDA odobren uređaj za RF mikronedling, koji kombinuje vrhunsko inženjerstvo i kliničku efikasnost. Namenjen je savremenim estetskim procedurama sa vrhunskim rezultatima.

**Princip rada:** Sitnim iglicama stvara kontrolisane mikropovrede koje podstiču prirodno zarastanje i proizvodnju kolagena.

**Namena:**
- Nehirurško zatezanje lica i kože
- Napredna nega akni i ožiljaka
- Smanjenje bora i strija

**Tehničke specifikacije:**
- Model: FR-301
- RF sistem: Bipolarni RF
- RF frekvencija: 1MHZ
- Širina impulsa: 10-1000 ms
- Kontrola: Pedala/Ručka
- Nivo snage: 1-10 (maks. 50W)
- Ekran: 15-inčni smart color touch screen
- Ukupna težina: 25KG (sa postoljem)
- Dubina penetracije igle: 0.5mm - 3.5mm
- Dimenzije uređaja: 350mm × 345mm × 425mm
- Napon: AC 100V-240V; 50/60Hz
- Kontrola: Dualna (pedala / dugme na ručici)

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-RFM-FDA
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "rf-mikroiglicenje",
    image: placeholderImage("FDA Approved RF Microneedling Machine"),
    seoKeywords: [
      "fda approved rf microneedling",
      "RF mikronedling",
      "FDA odobren",
      "podmlađivanje kože",
      "tretman ožiljaka",
      "zatezanje lica",
    ],
    metaDescription:
      "FDA Approved RF Microneedling Machine - FDA odobren uređaj za RF mikronedling. Za zatezanje lica, tretman ožiljaka, akni i bora. Visoka efikasnost i bezbednost.",
    faq: [
      {
        question: "Šta znači FDA odobrenje?",
        answer:
          "FDA odobrenje znači da je uređaj prošao stroge testove bezbednosti i efikasnosti od strane američke Uprave za hranu i lekove (FDA).",
      },
      {
        question: "Koliko traje tretman?",
        answer:
          "Tretman obično traje 30-60 minuta, u zavisnosti od tretirane oblasti i protokola.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "oxygen-revive",
    sku: "EST-OXYGEN-REVIVE",
    name: "Oxygen Revive",
    shortDescription: "Tretman čistim kiseonikom uz dubinsko čišćenje kože.",
    longDescription: `Oxygen Revive je sveobuhvatni sistem za tretman kiseonikom, koji nudi dubinsko čišćenje i podmlađivanje kože. Obavezni je deo opreme svakog modernog spa centra, wellness centra, hotela i klinike.

**Princip rada:** Kombinuje snagu vode i kiseonika za uklanjanje nečistoća iz pora. Tretman takođe poboljšava cirkulaciju krvi u koži i podstiče proizvodnju kolagena.

**Namena:**
- Koža, lice, telo, kosa
- Mentalna i fizička relaksacija

**Ključne karakteristike:**
- Patentirana tehnologija razvijena od strane američkog inženjerskog tima
- Poboljšava fizičko i mentalno zdravlje, smanjuje napetost i umor
- Pogodno za sve starosne grupe i delove tela
- Širok spektar primene: beauty centri, centri za mršavljenje, hoteli, teretane, health klubovi

**Tehničke specifikacije:**
- Naziv proizvoda: Oxygen-Revive
- Max izlaz: 500VA
- Vakuum pritisak: 1 bar Max
- Protok kiseonika: 3L/min
- Koncentracija kiseonika: ≥95%
- Operativni sistem: 10.4" touch screen
- Napon: 110-240VAC, 50/60Hz
- Spoljne dimenzije: 60*56*113cm³
- Težina: 52kg
- Tehnologije (ručke): 1) Hidra dermabrazija, 2) Dijamantska dermabrazija, 3) Kiseonični pištolj za maglu, 4) PDT LED ručka, 5) Skin scrubber, 6) Bio microcurrent wand, 7) Kiseonična maska za inhalaciju, 8) Visokofrekventna ručka, 9) Ultrazvučna facialna ručka

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-OXR
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("Oxygen Revive"),
    seoKeywords: [
      "oxygen revive",
      "kiseonični tretman",
      "dubinsko čišćenje kože",
      "hidra dermabrazija",
      "spa tretman",
      "wellness",
      "podmlađivanje kože",
    ],
    metaDescription:
      "Oxygen Revive - sveobuhvatni sistem za kiseonični tretman i dubinsko čišćenje kože. Patentirana tehnologija, 9 različitih ručki, idealan za spa i wellness centre.",
    faq: [
      {
        question: "Šta je hidra dermabrazija?",
        answer:
          "Hidra dermabrazija je napredna tehnika mikro dermabrazije koja koristi vodu i kiseonik za dubinsko čišćenje kože i uklanjanje mrtvih ćelija.",
      },
      {
        question: "Da li je tretman pogodan za sve tipove kože?",
        answer:
          "Da, Oxygen Revive je pogodan za sve tipove kože, uključujući i osetljivu kožu, jer je tretman nežan i neinvazivan.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hydraglow-6-in-1",
    sku: "EST-HYDRAGLOW-6-IN-1",
    name: "HydraGlow 6-in-1 Facial Rejuvenation System H2O2",
    shortDescription: "Multifunkcionalni uređaj koji kombinuje hidro-dermabraziju sa šest funkcija za zatezanje, čišćenje i podmlađivanje kože.",
    longDescription: `HydraGlow 6-in-1 je vrhunski multifunkcionalni uređaj za podmlađivanje lica, koji kombinuje hidro-dermabraziju sa šest naprednih funkcija. Namenjen je profesionalcima koji žele da ponude kompletan tretman kože.

**Princip rada:** Koristi vodu i kiseonik za piling bez kristala, što ga čini nežnim i bezbednim za sve tipove kože.

**Namena:**
- Vodeni piling
- Kiseonični sprej
- Bipolarni mikrostrujni lifting kože
- Hladni čekić za zatezanje
- Ultrazvučno uvođenje preparata
- Ultrazvučno čišćenje kože

**Tehničke specifikacije:**
- Tehnologija: Hydro oxygen machine
- Napon: 110V-240V, 50/60Hz
- Snaga: 250W
- Kontrolni sistem: Touch screen
- Pribor: 1) Hydra Water, 2) Ultrasound, 3) Skin Scrubber, 4) RF, 5) Cold hammer, 6) Hydrogen Oxygen(H2O2) Spray Gun, 7) Držač za pribor

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-H2O2
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("HydraGlow 6-in-1 Facial Rejuvenation System H2O2"),
    seoKeywords: [
      "hydraglow 6-in-1",
      "hidra dermabrazija",
      "podmlađivanje lica",
      "multifunkcionalni uređaj",
      "kiseonični tretman",
      "RF lifting",
      "ultrazvučno čišćenje",
    ],
    metaDescription:
      "HydraGlow 6-in-1 - multifunkcionalni uređaj za podmlađivanje lica sa hidra dermabrazijom, RF, ultrazvukom i kiseoničnim tretmanom. 6 funkcija u jednom uređaju.",
    faq: [
      {
        question: "Koje su prednosti H2O2 tretmana?",
        answer:
          "H2O2 tretman koristi vodonik-peroksid za dodatno čišćenje i dezinfekciju kože, što ga čini idealnim za tretman akni i problematične kože.",
      },
      {
        question: "Da li je tretman bezbedan za osetljivu kožu?",
        answer:
          "Da, tretman je nežan i bezbedan za sve tipove kože, uključujući i osetljivu, jer ne koristi abrazivne kristale.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "dermaclear-analyzer",
    sku: "EST-DERMACLEAR-ANALYZER",
    name: "DermaClear Analyzer",
    shortDescription: "Profesionalni analizator kože za preciznu dijagnostiku i analizu stanja kože.",
    longDescription: `DermaClear Analyzer je napredni uređaj za analizu kože, koji omogućava preciznu dijagnostiku i personalizovane tretmane. Namenjen je profesionalnim salonima i klinikama.

**Namena:** Analiza stanja kože i kreiranje individualnih tretmana.

**Ključne karakteristike:**
- Visokokvalitetna kamera
- Spektralno snimanje
- AI podrška za analizu
- Jednostavan interfejs

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKN-MIRROR
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "analiza-koze",
    image: placeholderImage("DermaClear Analyzer"),
    seoKeywords: [
      "dermaclear analyzer",
      "analiza kože",
      "dijagnostika kože",
      "profesionalni analizator",
      "AI analiza kože",
    ],
    metaDescription:
      "DermaClear Analyzer - profesionalni analizator kože za preciznu dijagnostiku. Spektralno snimanje i AI podrška za personalizovane tretmane.",
    faq: [
      {
        question: "Kako funkcioniše analiza kože?",
        answer:
          "Uređaj snima kožu u različitim spektrima svetlosti, a AI algoritam analizira slike i daje detaljan izveštaj o stanju kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "oxygeneno-bubble-cleanser",
    sku: "EST-OXYGENENO-BUBBLE-CLEANSER",
    name: "Oxygeneno Bubble Cleanser",
    shortDescription: "Uređaj za čišćenje kože kiseoničnim mehurićima, idealan za dubinsko čišćenje.",
    longDescription: `Oxygeneno Bubble Cleanser je inovativni uređaj koji koristi kiseonične mehuriće za dubinsko čišćenje kože. Namenjen je profesionalnoj upotrebi u salonima i klinikama.

**Princip rada:** Kiseonični mehurići prodiru u pore i uklanjaju nečistoće, istovremeno hidrirajući i osvežavajući kožu.

**Namena:** Dubinsko čišćenje kože lica i tela.

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-CO2B
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("Oxygeneno Bubble Cleanser"),
    seoKeywords: [
      "oxygeneno bubble cleanser",
      "čišćenje kože",
      "kiseonični mehurići",
      "dubinsko čišćenje",
      "nega lica",
    ],
    metaDescription:
      "Oxygeneno Bubble Cleanser - uređaj za dubinsko čišćenje kože kiseoničnim mehurićima. Nežno i efikasno uklanjanje nečistoća i hidratacija.",
    faq: [
      {
        question: "Da li je tretman pogodan za sve tipove kože?",
        answer: "Da, tretman je veoma nežan i pogodan za sve tipove kože, uključujući i osetljivu.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "foto-centrifix",
    sku: "EST-FOTO-CENTRIFIX",
    name: "Foto Centrifix",
    shortDescription: "Profesionalni uređaj za centrifugiranje i pripremu uzoraka za estetske tretmane.",
    longDescription: `Foto Centrifix je profesionalni uređaj za centrifugiranje, namenjen pripremi uzoraka za estetske tretmane, poput PRP (Platelet Rich Plasma) terapije.

**Namena:** Priprema PRP-a i drugih uzoraka za tretmane podmlađivanja i regeneracije kože.

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): nije u zvaničnom katalogu (avgust 2026) - proveriti kod dobavljača
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "potrosni-materijal",
    image: placeholderImage("Foto Centrifix"),
    seoKeywords: [
      "foto centrifix",
      "centrifuga",
      "PRP",
      "platelet rich plasma",
      "priprema uzoraka",
      "regeneracija kože",
    ],
    metaDescription:
      "Foto Centrifix - profesionalna centrifuga za pripremu PRP i drugih uzoraka za estetske tretmane. Efikasna i pouzdana.",
    faq: [
      {
        question: "Šta je PRP terapija?",
        answer:
          "PRP (Platelet Rich Plasma) terapija koristi koncentrovane trombocite iz pacijentove krvi za podsticanje regeneracije i podmlađivanja kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "lumithera-led-100",
    sku: "EST-LUMITHERA-LED-100",
    name: "LumiThera LED-100",
    shortDescription: "PDT uređaj koji koristi LED foto-biološku tehnologiju za podmlađivanje kože.",
    longDescription: `LumiThera LED-100 je profesionalni PDT (Photodynamic Therapy) uređaj koji koristi LED foto-biološku tehnologiju za podmlađivanje i poboljšanje zdravlja kože.

**Princip rada:** Koristi različite talasne dužine svetlosti (crvenu, plavu, infracrvenu, zelenu i dr.) radi podsticanja ćelijske aktivnosti, metabolizma, uništavanja bakterija i poboljšanja cirkulacije.

**Ključne karakteristike:**
- Napredna LED tehnologija
- Stimulacija kolagena
- Poboljšanje cirkulacije krvi
- Neinvazivno i svestrano
- Više talasnih dužina na izbor

**Tehničke specifikacije:**
- Snaga: 200W
- Boje: 7 boja
- Materijal kućišta: Metal
- Vreme: 1-60 minuta
- Pakovanje: Flight case
- Dimenzije: 102*50*47 cm
- Bruto težina: 28kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-LED-100
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "pdt-led-terapija",
    image: placeholderImage("LumiThera LED-100"),
    seoKeywords: [
      "lumithera led-100",
      "LED terapija",
      "PDT",
      "podmlađivanje kože",
      "fototerapija",
      "tretman akni",
    ],
    metaDescription:
      "LumiThera LED-100 - profesionalni PDT uređaj sa LED tehnologijom. 7 boja svetlosti za podmlađivanje, tretman akni i poboljšanje cirkulacije.",
    faq: [
      {
        question: "Kako LED terapija deluje na kožu?",
        answer:
          "Različite talasne dužine LED svetlosti prodiru u različite slojeve kože i podstiču ćelijsku aktivnost, proizvodnju kolagena i poboljšavaju cirkulaciju.",
      },
      {
        question: "Da li je tretman bezbedan?",
        answer:
          "Da, LED terapija je potpuno bezbedna, neinvazivna i bez termalnih efekata, što je čini pogodnom za sve tipove kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "lumithera-led-300",
    sku: "EST-LUMITHERA-LED-300",
    name: "LumiThera LED-300",
    shortDescription: "Napredni PDT sistem za podmlađivanje kože sa LED diodama velike snage.",
    longDescription: `LumiThera LED-300 je vrhunski PDT sistem za podmlađivanje kože, sa 1820 LED dioda velike snage. Namenjen je profesionalnim klinikama koje zahtevaju vrhunske rezultate.

**Namena:**
- Tretman akni
- Usporavanje starenja
- Poboljšanje limfne cirkulacije
- Smanjenje finih linija, bora i strija
- Kožna stanja
- Zarastanje rana
- Nega vlasišta
- Podsticanje rasta kose
- Brža apsorpcija kozmetičkih preparata

**Ključne karakteristike:**
- 1820 LED dioda velike snage
- Podesiva pozicija radne glave
- Slobodan kraki dizajn
- 8-inčni rotirajući touch ekran
- Podesiv intenzitet svetlosti
- Dvostruka zaštita prekidačem i lozinkom
- Neinvazivna primena

**Tehničke specifikacije:**
- Radni napon: AC 100V~240V, 50Hz/60Hz±2%
- Nazivna snaga: 300VA
- Osigurači: AC220/230V, T3.0AL/250V; AC110/120V, T5.0AL/250V
- Radno okruženje: 5~40°C, vlažnost ≤85%, pritisak 700hPa~1060hPa
- Vrhunci spektra: Crvena 633nm, Plava 417nm, Žuta 590nm, Infracrvena 850nm
- Efikasna ozračenost: Crvena 20~96mW/cm2, Plava 10~120mW/cm2, Žuta 5~42mW/cm2, Infracrvena 10~96mW/cm2

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-LED-300
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "pdt-led-terapija",
    image: placeholderImage("LumiThera LED-300"),
    seoKeywords: [
      "lumithera led-300",
      "LED terapija",
      "PDT",
      "podmlađivanje kože",
      "tretman akni",
      "rast kose",
      "fototerapija",
    ],
    metaDescription:
      "LumiThera LED-300 - napredni PDT sistem sa 1820 LED dioda. Za podmlađivanje kože, tretman akni, rast kose i poboljšanje cirkulacije. Visoka snaga.",
    faq: [
      {
        question: "Koja je razlika između LED-100 i LED-300 modela?",
        answer:
          "LED-300 ima znatno veći broj LED dioda (1820 naspram 273), veću snagu i napredniji sistem hlađenja, što omogućava brže i efikasnije tretmane.",
      },
      {
        question: "Da li se LED-300 može koristiti za tretman cele glave?",
        answer:
          "Da, zahvaljujući slobodnom krakom dizajnu, LED-300 se može podesiti za tretman bilo kog dela tela, uključujući i vlasište.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "lumithera-led-pro",
    sku: "EST-LUMITHERA-LED-PRO",
    name: "LumiThera LED-Pro",
    shortDescription: "Napredni PDT uređaj sa biološki aktivnom hladnom svetlošću, pogodan za sve tipove kože.",
    longDescription: `LumiThera LED-Pro je vrhunski PDT uređaj koji koristi biološki aktivnu hladnu svetlost za podsticanje zdravlja kože. Poznat je po svom nežnom, ne-termalnom dejstvu, što ga čini pogodnim za sve tipove kože, posebno za osetljivu kožu sklonu aknama.

**Namena:**
- Tretman akni
- Usporavanje starenja
- Podmlađivanje kože
- Zarastanje ožiljaka i rana
- Nega vlasišta
- Limfna cirkulacija

**Ključne karakteristike:**
- LED tehnologija sa više talasnih dužina
- Neinvazivno i bezbolno
- Širok spektar primene
- Podesiva podešavanja
- Kvalitetna izrada
- Pojačana proizvodnja kolagena

**Tehničke specifikacije:**
- Snaga: 200W
- LED boje: 7 boja (Crvena 650nm, Plava 470nm, Žuta 590nm, Zelena 535nm, Cyan 450nm, Ljubičasta 420nm, Bela 760nm)
- Broj LED dioda: 273
- Napon: AC110~240V
- Materijal: Metal
- Vreme tretmana: Podesivo, 1-60 minuta
- Dimenzije: 102 x 54 x 47 cm
- Težina: 36 kg
- Pakovanje: Flight case

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-LED-PRO
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "pdt-led-terapija",
    image: placeholderImage("LumiThera LED-Pro"),
    seoKeywords: [
      "lumithera led-pro",
      "LED terapija",
      "PDT",
      "hladna svetlost",
      "podmlađivanje kože",
      "tretman akni",
      "osetljiva koža",
    ],
    metaDescription:
      "LumiThera LED-Pro - napredni PDT uređaj sa hladnom svetlošću. Pogodan za sve tipove kože, posebno osetljivu. 7 boja, neinvazivan, bezbolan.",
    faq: [
      {
        question: "Zašto je LED-Pro pogodan za osetljivu kožu?",
        answer:
          "LED-Pro koristi biološki aktivnu hladnu svetlost koja ne stvara toplotu, što ga čini idealnim za osetljivu kožu sklonu iritacijama.",
      },
      {
        question: "Koliko traje jedan tretman?",
        answer: "Tretman obično traje 20-30 minuta, u zavisnosti od protokola i tretirane oblasti.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "plasma-machine",
    sku: "EST-PLASMA-MACHINE",
    name: "Plasma Machine",
    shortDescription: "Koristi hladnu plazmu za čišćenje kože, uništavanje bakterija i podsticanje ćelijske regeneracije.",
    longDescription: `Plasma Machine je inovativni uređaj koji koristi hladnu plazmu za tretman kože. Plazma, kao četvrto agregatno stanje, stvara visokoenergetske jone i elektrone koji deluju antibakterijski i stimulišu regeneraciju.

**Princip rada:** Hladna plazma nastaje jonizacijom gasa (argona) na niskim temperaturama. Kada se primeni na kožu, plazma čisti površinu, eliminiše bakterije i podstiče regeneraciju ćelija.

**Tehničke specifikacije:**
- Ekran: 12.1 inča
- Snaga: 100W
- Struja: 110-220V
- Težina: 13kg
- Težina sa pakovanjem: 23.5kg
- Dimenzije: 40*30*18cm
- Dimenzije pakovanja: 40*35*57cm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-PLASMA-01
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "plazma-aparat",
    image: placeholderImage("Plasma Machine"),
    seoKeywords: [
      "plasma machine",
      "hladna plazma",
      "čišćenje kože",
      "bakterije",
      "regeneracija kože",
      "neinvazivni tretman",
    ],
    metaDescription:
      "Plasma Machine - uređaj za hladnu plazmu za čišćenje kože, uništavanje bakterija i podsticanje regeneracije. Bezbedan, neinvazivan, efikasan.",
    faq: [
      {
        question: "Šta je hladna plazma?",
        answer:
          "Hladna plazma je jonizovani gas na sobnoj temperaturi, koji sadrži visokoenergetske jone i elektrone. Bezbedna je za kožu i ima snažno antibakterijsko dejstvo.",
      },
      {
        question: "Da li je tretman bezbedan?",
        answer: "Da, tretman je potpuno bezbedan, neinvazivan i ne oštećuje kožu.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "co2-celolaser-compact",
    sku: "EST-CO2-CELOLASER-COMPACT",
    name: "Co2 CeloLaser Compact",
    shortDescription: "Kompaktni CO2 laserski sistem za frakciono resurfacing kože, uklanjanje ožiljaka i tvorevina.",
    longDescription: `Co2 CeloLaser Compact je profesionalni frakcioni CO2 laser, namenjen tretmanu ožiljaka, bora, kožnih tvorevina i podmlađivanju kože.

**Princip rada:** Korišćenjem selektivne fototermičke razgradnje, laser stvara mikroskopske zone termalne koagulacije u koži, što stimuliše prirodni proces zarastanja i proizvodnju kolagena.

**Namena:**
- Frakciono resurfacing kože
- Uklanjanje ožiljaka (uključujući akne)
- Smanjenje bora i finih linija
- Uklanjanje kožnih tvorevina (bradavice, madeži, skin tags)
- Podmlađivanje kože

**Tehničke specifikacije:**
- Tip lasera: CO2 (10600nm)
- Način rada: Skener
- Izlazna energija: 1-60W
- Maksimalni prečnik skeniranja: 20mm
- Minimalni prečnik: 0.1mm
- Ciljni svetlosni indikator: Crvena dioda (650nm)
- Kontrolni sistem: Mikroračunar, touch screen
- Optički prenos: 7-zglobna ručica
- Sistem hlađenja: Zatvorena cirkulacija vode
- Dimenzije: 59cm x 106cm x 87cm
- Težina: 62kg
- Napajanje: AC220V, 50/60Hz, 10A

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CO2-CPT
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "frakcioni-co2-laser",
    image: placeholderImage("Co2 CeloLaser Compact"),
    seoKeywords: [
      "co2 celolaser compact",
      "CO2 laser",
      "frakcioni laser",
      "resurfacing kože",
      "uklanjanje ožiljaka",
      "podmlađivanje kože",
      "uklanjanje bradavica",
    ],
    metaDescription:
      "Co2 CeloLaser Compact - kompaktni frakcioni CO2 laser za resurfacing kože, uklanjanje ožiljaka, bora i kožnih tvorevina. Efikasan i bezbedan.",
    faq: [
      {
        question: "Šta je frakcioni CO2 laser?",
        answer:
          "Frakcioni CO2 laser stvara mikroskopske rupe u koži, stimulišući prirodni proces zarastanja i proizvodnju novog kolagena, što rezultira podmlađenom i zategnutijom kožom.",
      },
      {
        question: "Koliko traje oporavak nakon tretmana?",
        answer:
          "Oporavak traje 5-10 dana, u zavisnosti od intenziteta tretmana. Koža može biti crvena i ljuštiti se, ali rezultati su dugotrajni.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "co2-celolaser-pro",
    sku: "EST-CO2-CELOLASER-PRO",
    name: "Co2 CeloLaser Pro",
    shortDescription: "Profesionalni CO2 laserski sistem za frakciono resurfacing kože, uklanjanje ožiljaka i tvorevina.",
    longDescription: `Co2 CeloLaser Pro je vrhunski profesionalni frakcioni CO2 laser, namenjen zahtevnim estetskim tretmanima. Nudi veću snagu i preciznost u odnosu na kompaktni model.

**Princip rada:** Kao i kompaktni model, koristi selektivnu fototermičku razgradnju za stimulaciju kolagena i regeneraciju kože.

**Namena:**
- Frakciono resurfacing kože
- Uklanjanje ožiljaka (uključujući akne)
- Smanjenje bora i finih linija
- Uklanjanje kožnih tvorevina
- Podmlađivanje kože

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CO2-PRO
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "frakcioni-co2-laser",
    image: placeholderImage("Co2 CeloLaser Pro"),
    seoKeywords: [
      "co2 celolaser pro",
      "CO2 laser",
      "frakcioni laser",
      "resurfacing kože",
      "uklanjanje ožiljaka",
      "podmlađivanje",
    ],
    metaDescription:
      "Co2 CeloLaser Pro - profesionalni frakcioni CO2 laser za resurfacing kože, uklanjanje ožiljaka i bora. Veća snaga i preciznost za vrhunske rezultate.",
    faq: [
      {
        question: "Po čemu se Pro model razlikuje od Compact modela?",
        answer:
          "Pro model ima veću izlaznu snagu, veći opseg podešavanja i napredniji sistem hlađenja, što omogućava brže tretmane i bolje rezultate.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "celolaser-co2",
    sku: "EST-CELOLASER-CO2",
    name: "CeloLaser Co2",
    shortDescription: "Standardni CO2 laserski sistem za frakciono resurfacing kože, uklanjanje ožiljaka i tvorevina.",
    longDescription: `CeloLaser Co2 je provereni CO2 laser sistem, namenjen širokom spektru estetskih tretmana. Nudi balans između cene i performansi.

**Princip rada:** Korišćenjem CO2 lasera talasne dužine 10600nm, stvara precizne termalne zone u koži, stimulišući prirodni proces zarastanja i proizvodnju kolagena.

**Namena:**
- Frakciono resurfacing kože
- Uklanjanje ožiljaka (uključujući akne)
- Smanjenje bora i finih linija
- Uklanjanje kožnih tvorevina
- Podmlađivanje kože

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CO2-CEL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "frakcioni-co2-laser",
    image: placeholderImage("CeloLaser Co2"),
    seoKeywords: [
      "celolaser co2",
      "CO2 laser",
      "frakcioni laser",
      "resurfacing",
      "ožiljci",
      "podmlađivanje",
    ],
    metaDescription:
      "CeloLaser Co2 - standardni CO2 laser za frakciono resurfacing kože, uklanjanje ožiljaka i bora. Odličan odnos cene i performansi.",
    faq: [
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman se izvodi uz lokalnu anesteziju kako bi se obezbedio maksimalan komfor. Nakon tretmana, koža može biti osetljiva nekoliko dana.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "fotroqlaser",
    sku: "EST-FOTROQLASER",
    name: "FotroQlaser",
    shortDescription: "Q-Switched Nd:YAG laserski sistem za uklanjanje tetovaža, pigmentacija i podmlađivanje kože.",
    longDescription: `FotroQlaser je najnoviji Q-Switched Nd:YAG laserski sistem, dizajniran za optimalne kliničke rezultate. Nudi dvostruku talasnu dužinu (1064nm i 532nm) i kratke impulse za efikasan tretman.

**Princip rada:** Laser emituje ultra kratke impulse visoke energije koji se apsorbuju u pigmentnim česticama (tetovaža, madeža), razbijajući ih na sitne delove koje telo zatim prirodno eliminiše.

**Namena:**
- Uklanjanje tetovaža
- Uklanjanje pigmentacija (pege, sunčane pege)
- Uklanjanje trajne šminke
- Podmlađivanje kože (karbonski piling)
- Tretman gljivica na noktima

**Tehničke specifikacije:**
- Tip lasera: Q-Switched Nd:YAG
- Talasne dužine: 1064nm i 532nm
- Širina impulsa: 5ns
- Izlazna energija: do 1000mJ

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-QSW-FQL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "q-switch-nd-yag-laser",
    image: placeholderImage("FotroQlaser"),
    seoKeywords: [
      "fotroqlaser",
      "Q-Switched Nd:YAG",
      "uklanjanje tetovaža",
      "uklanjanje pigmentacija",
      "trajna šminka",
      "karbonski piling",
      "podmlađivanje kože",
    ],
    metaDescription:
      "FotroQlaser - Q-Switched Nd:YAG laser za uklanjanje tetovaža, pigmentacija i trajne šminke. Dvostruka talasna dužina, kratki impulsi, visoka efikasnost.",
    faq: [
      {
        question: "Koliko tretmana je potrebno za uklanjanje tetovaže?",
        answer:
          "Broj tretmana zavisi od veličine, boja i starosti tetovaže. U proseku je potrebno 3-10 tretmana za potpuno uklanjanje.",
      },
      {
        question: "Da li je tretman bezbedan za kožu?",
        answer:
          "Da, Q-Switched laseri su dizajnirani da ciljaju isključivo pigment, bez oštećenja okolne kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "frotomini-nd-laser",
    sku: "EST-FROTOMINI-ND-LASER",
    name: "FotroMini Nd laser",
    shortDescription: "Prenosivi Nd:YAG laser za uklanjanje tetovaža i pigmentacije.",
    longDescription: `FotroMini Nd laser je prenosivi Q-Switched Nd:YAG laser, namenjen uklanjanju tetovaža i pigmentacija. Idealan je za manje prostore i mobilne usluge.

**Princip rada:** Koristi eksplozivni efekat Nd:YAG lasera koji prodire kroz epidermu i cilja pigmentne mase. Nanosekundni impuls razbija pigment na sitne čestice radi lakšeg uklanjanja.

**Ključne karakteristike:**
- Bezbedan i efikasan tretman
- Prenosiv i jednostavan za rukovanje
- Podmlađivanje kože
- Visoka efikasnost tretmana
- Ugrađen alarmni sistem

**Tehničke specifikacije:**
- Tip lasera: Q-Switched Nd:YAG
- Talasne dužine: 1064nm/532nm
- Tretman glave: 1064nm, 532nm, SR
- Izlazna snaga: 0-1000mJ, podesivo
- Trajanje impulsa: 10ns
- Sistem hlađenja: Voda + vazduh
- Neto težina: 8 kg
- Napajanje: 230VAC, 50~60Hz

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-QSW-MINI
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "q-switch-nd-yag-laser",
    image: placeholderImage("FotroMini Nd laser"),
    seoKeywords: [
      "fotromini nd laser",
      "Nd:YAG laser",
      "prenosivi laser",
      "uklanjanje tetovaža",
      "uklanjanje pigmentacija",
      "Q-Switched",
    ],
    metaDescription:
      "FotroMini Nd laser - prenosivi Q-Switched Nd:YAG laser za uklanjanje tetovaža i pigmentacija. Kompaktan, efikasan, jednostavan za korišćenje.",
    faq: [
      {
        question: "Da li je FotroMini Nd laser pogodan za uklanjanje svih boja tetovaža?",
        answer:
          "Da, zahvaljujući dvostrukoj talasnoj dužini (1064nm za tamne boje i 532nm za svetle boje), pogodan je za uklanjanje većine boja.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "frotovertical-nd-laser",
    sku: "EST-FROTOVERTICAL-ND-LASER",
    name: "FotroVertical Nd laser",
    shortDescription: "Vrhunski Nd:YAG laserski sistem za precizne tretmane.",
    longDescription: `FotroVertical Nd Laser je vrhunski Nd:YAG laserski sistem, dizajniran za precizne i efikasne tretmane na različitim tipovima kože. Namenjen je profesionalnim estetskim klinikama.

**Namena:**
- Podmlađivanje kože
- Depilacija
- Tretman pigmentacije
- Vaskularne lezije

**Ključne karakteristike:**
- Precizno ciljanje
- Svestranost
- Napredno hlađenje
- Podesiva podešavanja
- Izdržljivost i pouzdanost

**Tehničke specifikacije:**
- Tip lasera: Nd:YAG
- Interfejs: Touch screen
- Sistem hlađenja: Integrisan

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-QSW-VERT
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "q-switch-nd-yag-laser",
    image: placeholderImage("FotroVertical Nd laser"),
    seoKeywords: [
      "fotrovertical nd laser",
      "Nd:YAG laser",
      "podmlađivanje kože",
      "depilacija",
      "pigmentacije",
      "vaskularne lezije",
    ],
    metaDescription:
      "FotroVertical Nd laser - vrhunski Nd:YAG laserski sistem za podmlađivanje kože, depilaciju i tretman pigmentacija. Precizan, svestran i pouzdan.",
    faq: [
      {
        question: "Koje su prednosti Nd:YAG lasera?",
        answer:
          "Nd:YAG laseri su izuzetno svestrani, pogodni za širok spektar tretmana, uključujući depilaciju, tretman pigmentacija i vaskularnih lezija, sa minimalnim rizikom za kožu.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "venalite-980",
    sku: "EST-VENALITE-980",
    name: "VenaLite 980",
    shortDescription: "Laser na 980 nm za tretman krvnih sudova.",
    longDescription: `VenaLite 980 je specijalizovani laserski sistem za tretman krvnih sudova, koji koristi talasnu dužinu od 980 nm za optimalnu apsorpciju u vaskularnim ćelijama.

**Princip rada:** Talasnu dužinu od 980 nm optimalno apsorbuje porfirin u ćelijama krvnih sudova, izazivajući koagulaciju i njihovo nestajanje. Laser podstiče stvaranje kolagena i povećava debljinu epiderme.

**Tehničke specifikacije:**
- Izlazna talasna dužina: 980nm
- Frekvencija: 1-5Hz
- Izlazna snaga: 1-30W
- Režim: Pulsni
- Napajanje: AC 100-240V, 50/60Hz
- Dužina vlakna: 2m
- Način rada: Touch screen
- Ciljni snop: Diodni laser 650nm±10nm, 5mW
- Interfejs: 7.0" Color LCD touch screen
- Hlađenje: Vazduh
- Neto/Bruto težina: 5kg/11kg
- Dimenzije (flight case): 350mm x 290mm x (185mm-345mm) / 460mm x 440mm x 270mm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): nije u zvaničnom katalogu (avgust 2026) - proveriti kod dobavljača
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "q-switch-nd-yag-laser",
    image: placeholderImage("VenaLite 980"),
    seoKeywords: [
      "venalite 980",
      "980nm laser",
      "tretman krvnih sudova",
      "vaskularne lezije",
      "paukaste vene",
      "koagulacija",
    ],
    metaDescription:
      "VenaLite 980 - laserski sistem za tretman krvnih sudova na 980 nm. Efikasna koagulacija, stimulacija kolagena, bezbedan i precizan.",
    faq: [
      {
        question: "Za koje vrste krvnih sudova je VenaLite 980 pogodan?",
        answer:
          "Pogodan je za tretman paukastih vena, proširenih kapilara i drugih vaskularnih lezija na licu i telu.",
      },
      {
        question: "Da li je tretman bolan?",
        answer:
          "Većina klijenata opisuje tretman kao blagu nelagodnost. Ugrađeni sistem hlađenja dodatno smanjuje osećaj toplote.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "frotomini-755",
    sku: "EST-FROTOMINI-755",
    name: "FotroMini 755",
    shortDescription: "Napredni uređaj sa pikosekundnom tehnologijom za uklanjanje tetovaža, pigmentacije i ožiljaka.",
    longDescription: `FotroMini 755 je vrhunski uređaj koji koristi pikosekundnu tehnologiju za brzo i efikasno uklanjanje tetovaža, pigmentacija i ožiljaka.

**Princip rada:** Zasnovan na fotomehaničkom principu, koristi različite talasne dužine (532, 755, 1064 i 1320 nm) za tretman pigmentnih promena. Pikosekundni impulsi razbijaju pigment na izuzetno sitne čestice.

**Ključne karakteristike:**
- Širok spektar talasnih dužina
- Kraće trajanje procedure
- Brzo i bezbolno uklanjanje tetovaža i trajne šminke

**Tehničke specifikacije:**
- Talasne dužine: 1064nm, 755nm, 1320nm, 532nm
- Snaga: 1600W
- Napon: AC 220V/50Hz
- Veličina YAG šipke: φ7
- Ekran: 10.4" TFT
- Energija impulsa: 1-2000mJ
- Frekvencija: 1-10Hz
- Snaga laserske šipke za uklanjanje tetovaža: 500W
- Snaga uređaja: 1600W
- Bruto težina: 38kg
- Dimenzije (ŠxVxD): 540x540x750mm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-QSW-755
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "q-switch-nd-yag-laser",
    image: placeholderImage("FotroMini 755"),
    seoKeywords: [
      "fotromini 755",
      "pikosekundni laser",
      "uklanjanje tetovaža",
      "uklanjanje pigmentacija",
      "ožiljci",
      "strije",
      "pikosekundna tehnologija",
    ],
    metaDescription:
      "FotroMini 755 - pikosekundni laser za uklanjanje tetovaža, pigmentacija i ožiljaka. Više talasnih dužina, brzi i bezbolni tretmani.",
    faq: [
      {
        question: "Koja je prednost pikosekundne tehnologije?",
        answer:
          "Pikosekundni impulsi su znatno kraći od nanosekundnih, što omogućava efikasnije razbijanje pigmenta uz manje toplotnog oštećenja okolne kože.",
      },
      {
        question: "Da li je FotroMini 755 pogodan za uklanjanje svih boja tetovaža?",
        answer:
          "Da, zahvaljujući četiri različite talasne dužine, pogodan je za uklanjanje širokog spektra boja, uključujući i teške boje poput plave i zelene.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "lasemooth-pro",
    sku: "EST-LASEMOOTH-PRO",
    name: "Lasemooth Pro",
    shortDescription: "Diodni laserski sistem za depilaciju.",
    longDescription: `Lasemooth Pro je profesionalni diodni laserski sistem za trajno uklanjanje dlačica. Koristi kombinaciju talasnih dužina za efikasan tretman na različitim tipovima kože.

**Princip rada:** Diodni laser emituje svetlost određene talasne dužine koja se apsorbuje u melaninu folikula dlake, što dovodi do njegovog trajnog oštećenja.

**Tehničke specifikacije:**
- Tip lasera: Diodni + Nd:YAG + Aleksandrit
- Talasne dužine: 755nm, 808nm, 940nm, 1064nm
- Glava za tretman: Safirni kristal
- Energija: 1-120 J/cm²
- Frekvencija: 1-10Hz
- Širina impulsa: 1-370 ms
- Laserske šipke: 12
- Laserska snaga: 1600W
- Izlazna snaga: 3000W
- Veličina tačke: 16x35mm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-DL-PRO
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "dijodni-laser-trajna-depilacija",
    image: placeholderImage("Lasemooth Pro"),
    seoKeywords: [
      "lasemooth pro",
      "diodni laser",
      "depilacija",
      "trajno uklanjanje dlaka",
      "laserska depilacija",
      "profesionalna depilacija",
    ],
    metaDescription:
      "Lasemooth Pro - profesionalni diodni laser za trajno uklanjanje dlaka. Više talasnih dužina, velika snaga, pogodan za sve tipove kože.",
    faq: [
      {
        question: "Koja je prednost diodnog lasera?",
        answer:
          "Diodni laseri su veoma efikasni za sve tipove kože, uključujući i tamniju kožu, sa manje neželjenih efekata u odnosu na druge vrste lasera.",
      },
      {
        question: "Koliko traje tretman?",
        answer:
          "Trajanje tretmana zavisi od tretirane oblasti. Na primer, tretman nogu traje oko 30-45 minuta, dok tretman gornje usne traje svega nekoliko minuta.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "lasemooth-smart",
    sku: "EST-LASEMOOTH-SMART",
    name: "Lasemooth Smart",
    shortDescription: "Diodni laser za trajno smanjenje dlačica.",
    longDescription: `Lasemooth Smart je kompaktni diodni laserski sistem za trajno smanjenje dlačica, namenjen profesionalnim salonima i klinikama.

**Namena:** Depilacija za različite tipove kože i dlaka, efikasna na gotovo svim delovima tela.

**Tehničke specifikacije:**
- Tip lasera: Diodni + Nd:YAG + Aleksandrit
- Talasne dužine: 755nm, 808nm, 1064nm
- Glava za tretman: Safirni kristal
- Laserske šipke: 6
- Laserska snaga: 600W
- Izlazna snaga: 2500W
- Energija: 1-120 J/cm²
- Frekvencija: 1-10 Hz
- Napon: 220V/50Hz (110V opciono)
- Veličina tačke: 14x14 mm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-DL-SMART
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "dijodni-laser-trajna-depilacija",
    image: placeholderImage("Lasemooth Smart"),
    seoKeywords: [
      "lasemooth smart",
      "diodni laser",
      "depilacija",
      "trajno uklanjanje dlaka",
      "kompaktni laser",
    ],
    metaDescription:
      "Lasemooth Smart - kompaktni diodni laser za trajno uklanjanje dlaka. Efikasan na svim tipovima kože, jednostavan za korišćenje.",
    faq: [
      {
        question: "Po čemu se Lasemooth Smart razlikuje od Pro modela?",
        answer:
          "Smart model ima manji broj laserskih šipki (6 naspram 12) i manju snagu, što ga čini kompaktnijim i pristupačnijim, ali i dalje veoma efikasnim.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "luminmax-4-in-1",
    sku: "EST-LUMINMAX-4-IN-1",
    name: "LuminMax 4 in 1",
    shortDescription: "4-u-1 multifunkcionalni uređaj koji kombinuje diodni laser, DPL, piko laser i RF tehnologiju.",
    longDescription: `LuminMax 4 in 1 je vrhunski multifunkcionalni estetski uređaj koji kombinuje četiri tehnologije u jednom: diodni laser, DPL, piko laser i RF. Namenjen je klinikama koje žele da ponude sveobuhvatne tretmane.

**Namena:**
- Trajna depilacija
- Podmlađivanje kože
- Uklanjanje tetovaža
- Tretman akni
- Karbonski piling
- Lifting i zatezanje kože

**Tehničke specifikacije:**
- Proizvod: 4IN1 Diode laser+DPL+Pico Laser+RF Multifunctional Machine
- Talasne dužine: 808/810nm + 755nm + 1064nm
- Snaga diodnog lasera: 800W (USA Coherent)
- Laserske šipke: 10 ili više
- Veličina tačke: 16x25mm
- Ekran: 15.6 inch touch screen
- Hlađenje kože: 2xTEC (Japan) + Safir, -22°C do +5°C
- DPL: UK ksenonska lampa, snaga 1500W
- RF snaga: 200W
- Pico laser: 5 vrhova, snaga 600W
- TEC hlađenje: 300W
- Hlađenje uređaja: TEC + poluprovodničko hlađenje (Japan) + voda + ventilator
- Pumpa za vodu: Booster pumpa iz Tajvana
- Zaštita temperature vode: 5-35°C
- Rezervoar za vodu: 5L
- Kućište: ABS (metalna unutrašnja struktura)
- Dimenzije pakovanja: 62x49x137cm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-IPL-LUMI4
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ipl-fotoepilacija-i-fotopodmladjivanje",
    image: placeholderImage("LuminMax 4 in 1"),
    seoKeywords: [
      "luminmax 4 in 1",
      "diodni laser",
      "DPL",
      "piko laser",
      "RF",
      "depilacija",
      "podmlađivanje",
      "uklanjanje tetovaža",
      "multifunkcionalni uređaj",
    ],
    metaDescription:
      "LuminMax 4 in 1 - multifunkcionalni estetski uređaj sa diodnim laserom, DPL, piko laserom i RF. Za depilaciju, podmlađivanje, uklanjanje tetovaža i lifting.",
    faq: [
      {
        question: "Šta je DPL tehnologija?",
        answer:
          "DPL (Dynamic Pulse Light) je napredna IPL tehnologija koja koristi dinamički podešene impulse svetlosti za tretman pigmentacija, akni i podmlađivanje kože.",
      },
      {
        question: "Koje su prednosti 4-u-1 uređaja?",
        answer:
          "Glavna prednost je ušteda prostora i novca – umesto četiri odvojena uređaja, imate jedan koji nudi sve ključne tretmane.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "thulium-laser-1927nm",
    sku: "EST-THULIUM-LASER-1927NM",
    name: "1927nm Thulium Laser",
    shortDescription: "Tulijum laser za usporavanje starenja, podmlađivanje kože, opadanje kose, pigmentaciju i uklanjanje bora.",
    longDescription: `1927nm Thulium Laser je najnovija tehnologija u estetskoj medicini, namenjena širokom spektru tretmana podmlađivanja kože.

**Namena:**
- Usporavanje starenja
- Podmlađivanje kože
- Opadanje kose
- Pigmentacije
- Uklanjanje bora
- Ožiljci od akni
- Posvetljivanje kože
- Poboljšanje teksture kože

**Princip rada:** Frakcioni režim rada na 1927 nm fokusira laser na sitne tačke, ostvarujući neablativni ili mikroablativni efekat i aktivirajući kolagen.

**Tehničke specifikacije:**
- Tehnologija: 1927nm thulium laser
- Talasne dužine: 1927nm / 1927+1550nm
- Prečnik: 50~100um
- Veličina skeniranja: 1x1mm~15x15mm
- Razmak skeniranja: 0.1-2.0mm (korak 0.1mm)
- Dimenzije: 310x275x86(DxWxH)mm
- Napajanje: 220VAC, 50/60Hz, 200VA
- Sistem hlađenja: Vazduh

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-THUL-1927
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "tulijum-laser-1927nm",
    image: placeholderImage("1927nm Thulium Laser"),
    seoKeywords: [
      "1927nm thulium laser",
      "tulijum laser",
      "podmlađivanje kože",
      "anti-aging",
      "pigmentacije",
      "opadanje kose",
      "bor",
      "ožiljci od akni",
    ],
    metaDescription:
      "1927nm Thulium Laser - napredni tulijum laser za podmlađivanje kože, anti-aging, tretman pigmentacija i opadanja kose. Frakcioni režim rada.",
    faq: [
      {
        question: "Koja je prednost tulijum lasera u odnosu na CO2 laser?",
        answer:
          "Tulijum laser (1927nm) nudi neablativni tretman sa kraćim oporavkom, dok je CO2 laser (10600nm) ablativni i zahteva duži oporavak. Tulijum je idealan za klijente koji žele minimalni down-time.",
      },
      {
        question: "Da li se tretman može kombinovati sa drugim procedurama?",
        answer:
          "Da, tulijum laser se često kombinuje sa drugim tretmanima poput PRP-a ili mezoterapije za poboljšanje rezultata.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "dermavision-plus",
    sku: "EST-DERMAVISION-PLUS",
    name: "DermaVision Plus",
    shortDescription: "Napredni sistem za analizu kože koji koristi RGB, PL i UV snimanje uz podršku veštačke inteligencije.",
    longDescription: `DermaVision Plus je najnapredniji sistem za analizu kože, koji koristi RGB vidljivo svetlo, PL polarizovano svetlo i UV spektralno snimanje, kombinovano sa veštačkom inteligencijom.

**Princip rada:** Klinički meri debljinu dermisa i epiderme, snima multispektralne fotografije radi analize bora, pega, pora, teksture, porfirina, UV oštećenja, pigmentacije, akni, vlažnosti i starosti kože.

**Namena:**
- Dijagnostika stanja kože
- Personalizovani tretmani
- Praćenje rezultata
- Predviđanje budućeg stanja kože (3-5 godina)

**Ključne karakteristike:**
- Spektralno snimanje (RGB+UV+PL)
- AI analiza
- Automatsko preporučivanje proizvoda
- Profesionalni tablet uključen
- 20 MP kamera
- Analiza 12 parametara za 20 sekundi
- Wi-Fi, SD card, Bluetooth deljenje

**Tehničke specifikacije:**
- Snaga: 45W
- Dimenzije uređaja: 42 x 36 x 56cm
- Napon: 110-230VAC±10%
- Dimenzije pakovanja: 50 x 46 x 66cm
- Struja: 0.2A 50Hz
- Kamera: 20 Megapiksela
- Neto težina: 8 kg
- Veličina ekrana: 10.1 inch
- Bruto težina: 12kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKN-AI
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "analiza-koze",
    image: placeholderImage("DermaVision Plus"),
    seoKeywords: [
      "dermavision plus",
      "analiza kože",
      "AI analiza kože",
      "spektralno snimanje",
      "dijagnostika kože",
      "profesionalni skin analyzer",
    ],
    metaDescription:
      "DermaVision Plus - napredni AI sistem za analizu kože sa spektralnim snimanjem. Analizira 12 parametara za 20 sekundi, preporučuje proizvode i predviđa buduće stanje kože.",
    faq: [
      {
        question: "Koje spektre koristi DermaVision Plus?",
        answer:
          "Koristi RGB (vidljivo svetlo), PL (polarizovano svetlo) i UV (ultraljubičasto) spektre za sveobuhvatnu analizu površinskih i dubljih slojeva kože.",
      },
      {
        question: "Da li sistem preporučuje proizvode?",
        answer:
          "Da, na osnovu analize, sistem automatski preporučuje odgovarajuće proizvode i tretmane za specifične potrebe kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "dermavision-x",
    sku: "EST-DERMAVISION-X",
    name: "DermaVision X",
    shortDescription: "2-u-1 uređaj za analizu kože i vlasišta sa veštačkom inteligencijom i multispektralnim snimanjem.",
    longDescription: `DermaVision X je napredni 2-u-1 uređaj za analizu kože i vlasišta, koji koristi multispektralno snimanje i AI za preciznu dijagnostiku.

**Namena:** Analiza kože lica i vlasišta.

**Ključne karakteristike:**
- Veliki pametni ekran prikazuje mikroskopsko stanje kože
- Precizna klinička kamera hvata sitne detalje lica
- Premium 2-u-1 uređaj za analizu kože i vlasišta
- Pametna cloud platforma za evidenciju klijenata
- Konstrukcija sa blokiranjem svetlosti za tačniju AI dijagnostiku

**Tehničke specifikacije:**
- Naziv proizvoda: 2-in-1 Skin and Scalp Analysis Machine
- Memorija: 64GB
- Model: Derma Vision X
- Snaga: 25W
- Eksterna memorija: SD kartica
- Napajanje: 110-230 VAC / 50Hz-60Hz
- Rezolucija: 20 Megapiksela
- Dimenzije uređaja: 60.6 cm (L) × 45.5 cm (H) × 22.1 cm (T)
- Spektar: 10
- Dimenzije pakovanja: 70 cm (L) × 55 cm (W) × 29.5 cm (T)
- Operativni sistem: Android 12
- Režim snimanja: Automatski
- Bruto težina: 9 kg
- Ekran: 15.6 inča
- RAM: 2GB
- Neto težina: 5 kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKN-2IN1
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "analiza-koze",
    image: placeholderImage("DermaVision X"),
    seoKeywords: [
      "dermavision x",
      "analiza kože",
      "analiza vlasišta",
      "AI dijagnostika",
      "multispektralno snimanje",
      "2-u-1 skin analyzer",
    ],
    metaDescription:
      "DermaVision X - 2-u-1 uređaj za analizu kože i vlasišta sa AI i multispektralnim snimanjem. Android OS, 20 MP kamera, cloud platforma.",
    faq: [
      {
        question: "Zašto je važna analiza vlasišta?",
        answer:
          "Analiza vlasišta omogućava rano otkrivanje problema poput peruti, opadanja kose i infekcija, što omogućava pravovremeni tretman.",
      },
      {
        question: "Da li sistem zahteva internet konekciju?",
        answer:
          "Internet konekcija je potrebna za korišćenje cloud platforme za čuvanje i deljenje rezultata, ali osnovna analiza radi i offline.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "dermavision-master",
    sku: "EST-DERMAVISION-MASTER",
    name: "DermaVision Master",
    shortDescription: "Uređaj za 3D analizu kože koji omogućava konsultacije zasnovane na konkretnim podacima.",
    longDescription: `DermaVision Master je vrhunski 3D sistem za analizu kože, dizajniran za profesionalne estetske konsultacije. Omogućava naučno zasnovane, podacima vođene konsultacije.

**Ključne karakteristike:**
- Metalna izrada sa dizajnom koji blokira spoljnu svetlost
- Dostupne dve veličine ekrana
- Prostran prostor za snimanje iz tri ugla
- Nezavisno mikroskopsko sočivo za pregled kože
- Trospektralno mikroskopsko snimanje folikula dlake
- 36 miliona piksela kamera

**Tehničke specifikacije:**
- Način rada: Multi point resistive/capacitive touch
- Pikseli: 36 miliona XI/X3
- Wi-Fi: Dual band (2.4G, 5G)
- Spektar: Bela, ukrštena, paralelna, UV, Wu's, kompozitna UV svetlost
- Osvetljenje: 280
- Zaštita od svetlosti: Nevidljivi štit
- HDMI: 1
- Materijal: Industrijski ABS PC
- USB: 2
- Procesor: Cortex-A55 Quad Core
- Odnos ekrana: 16:9
- Matična ploča: Ruixin Micro RK3568
- Veličina ekrana: 21.5 inča
- Memorija: 4GB
- Rezolucija ekrana: 1920x1080
- Hard disk: 32GB
- Neto težina: 16.9kg
- Hlađenje: Ventilator
- Bruto težina: 19.8kg
- Dimenzije: 66.2 × 56.2 × 40.5cm
- Ambalaža: Talasasti karton + pamuk
- Izlazna snaga: 30W
- Napajanje: 100~240VAC

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKN-X5
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "analiza-koze",
    image: placeholderImage("DermaVision Master"),
    seoKeywords: [
      "dermavision master",
      "3D analiza kože",
      "AI kožni analizator",
      "profesionalna dijagnostika",
      "spektralno snimanje",
      "konsultacije",
    ],
    metaDescription:
      "DermaVision Master - vrhunski 3D sistem za analizu kože. 36 MP kamera, spektralno snimanje, AI podrška. Za profesionalne konsultacije zasnovane na podacima.",
    faq: [
      {
        question: "Šta znači 3D analiza kože?",
        answer:
          "3D analiza koristi napredne algoritme za kreiranje trodimenzionalnog prikaza kože, što omogućava precizniju procenu bora, teksture i kontura lica.",
      },
      {
        question: "Da li sistem može da predvidi buduće stanje kože?",
        answer:
          "Da, na osnovu trenutnog stanja i starosnih faktora, sistem može da simulira kako će koža izgledati za 3-5 godina, što pomaže u planiranju tretmana.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "cellusculpt-pro",
    sku: "EST-CELLUSCULPT-PRO",
    name: "CelluSculpt pro",
    shortDescription: "HI-EMT uređaj za jačanje mišića, mršavljenje i tretman mišića karličnog dna.",
    longDescription: `CelluSculpt Pro je napredni HI-EMT uređaj koji koristi elektromagnetnu stimulaciju za jačanje mišića, smanjenje masnog tkiva i tretman karličnog dna.

**Princip rada:** Koristi HIFEM (High-Intensity Focused Electromagnetic) tehnologiju za stimulaciju mišića i redukciju masnog tkiva.

**Tehničke specifikacije:**
- Naziv proizvoda: CelluSculpt Pro HI-EMT
- Intenzitet magnetne vibracije: 7 Tesla
- Izlazni napon: AC110V-230V
- Izlazna snaga: 300W-3000W
- Izlazna frekvencija: 3-150Hz
- Osigurač: 20A

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-EMS-CELLU
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ems-hiemt-oblikovanje-tela-i-lica",
    image: placeholderImage("CelluSculpt pro"),
    seoKeywords: [
      "cellusculpt pro",
      "HI-EMT",
      "jačanje mišića",
      "mršavljenje",
      "karlično dno",
      "elektromagnetna stimulacija",
      "oblikovanje tela",
    ],
    metaDescription:
      "CelluSculpt Pro - HI-EMT uređaj za jačanje mišića, mršavljenje i tretman karličnog dna. 7 Tesla, neinvazivan, efikasan.",
    faq: [
      {
        question: "Šta je HI-EMT tehnologija?",
        answer:
          "HI-EMT (High-Intensity Focused Electromagnetic) tehnologija koristi fokusirane elektromagnetne talase za izazivanje super-maksimalnih mišićnih kontrakcija, što dovodi do jačanja i zatezanja mišića.",
      },
      {
        question: "Da li je tretman bezbedan?",
        answer:
          "Da, HI-EMT tretman je potpuno bezbedan, neinvazivan i odobren od strane relevantnih regulatornih tela.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "icesculpt-360",
    sku: "EST-ICESCULPT-360",
    name: "IceSculpt 360",
    shortDescription: "Uređaj za kriolipolizu pod uglom od 360° namenjen redukciji masnog tkiva.",
    longDescription: `IceSculpt 360 je napredni uređaj za kriolipolizu (zamrzavanje masti) koji nudi 360° tretman za efikasnu redukciju masnog tkiva.

**Princip rada:** Hladi potkožno tkivo ispod 10°C kako bi delovao na ćelije bogate mastima. Ćelije masti se kristališu, razgrađuju i prirodno eliminišu iz organizma.

**Namena:**
- Redukcija masnog tkiva na stomaku, bokovima, butinama
- Oblikovanje tela

**Ključne karakteristike:**
- Nastavci za hlađenje se lako menjaju i prilagođavaju različitim konturama tela
- 360° hlađenje za bolje rezultate

**Tehničke specifikacije:**
- Način kontrole ručke: Touch
- Veličine krio ručki: 4#230*105mm, 1#195*85mm, 2#210*90mm
- Veličina ekrana ručke: 4.5
- Male krio ručke: 3#165*90mm, 1#140*70mm, 2#155*80mm
- Materijal ručke: Silikon
- Temperatura ručke: -10°C/+45°C
- Ručka za duplu bradu: 80*40mm
- Pritisak: 0.08MPa
- Frekvencija kavitacione glave: 40KHz
- Snaga lasera: 100mw
- RF lice: 3MHz
- Laserska talasna dužina: 650nm
- RF frekvencija: 5MHz
- Broj laserskih dioda: 72

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-BODY-ICE360
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "krioliposukcija-redukcija-masnih-naslaga",
    image: placeholderImage("IceSculpt 360"),
    seoKeywords: [
      "icesculpt 360",
      "kriolipoliza",
      "zamrzavanje masti",
      "redukcija masnog tkiva",
      "oblikovanje tela",
      "CoolSculpting",
    ],
    metaDescription:
      "IceSculpt 360 - uređaj za 360° kriolipolizu (zamrzavanje masti). Efikasna redukcija masnog tkiva na stomaku, bokovima i butinama. Bez operacije.",
    faq: [
      {
        question: "Kako funkcioniše kriolipoliza?",
        answer:
          "Kriolipoliza koristi kontrolisano hlađenje za ciljanje i uništavanje masnih ćelija, koje telo zatim prirodno eliminiše. Ne oštećuje okolna tkiva.",
      },
      {
        question: "Koliko je tretmana potrebno?",
        answer:
          "Obično je potrebno 1-3 tretmana po oblasti za vidljive rezultate, sa razmakom od nekoliko nedelja između tretmana.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "dynalines",
    sku: "EST-DYNALINES",
    name: "DynaLines",
    shortDescription: "Pomaže u jačanju mišića, redukciji masnog tkiva i postizanju vitkije linije tela.",
    longDescription: `DynaLines je napredni uređaj za elektromiostimulaciju (EMS), namenjen jačanju mišića, redukciji masnog tkiva i oblikovanju tela.

**Namena:**
- Tonifikacija mišića
- Redukcija masnog tkiva i oblikovanje tela
- Ublažavanje bolova izazvanih hladnoćom

**Ključne karakteristike:**
- Efikasno i bez napora
- Inteligentno i neinvazivno
- Tretman sa više modula
- Snažna isporuka impulsa
- Prilagođena rešenja

**Tehničke specifikacije:**
- Radna ručka: 448kHz, 4.8kHz-5kHz
- Tehnologija: Multi-directional Electricity
- Interfejs: 12.1 inch touch screen
- Režim rada: Kontinuirani
- Napajanje: 220-230VAC, 4A, 50Hz/60Hz
- Dimenzije uređaja: 500x490x1190mm
- Bruto težina: 52kg
- Težina uređaja: 45kg
- Dimenzije pakovanja: 600x590x1310mm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-EMS-DYNA
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ems-hiemt-oblikovanje-tela-i-lica",
    image: placeholderImage("DynaLines"),
    seoKeywords: [
      "dynalines",
      "EMS",
      "elektromiostimulacija",
      "jačanje mišića",
      "redukcija masti",
      "oblikovanje tela",
      "tonifikacija",
    ],
    metaDescription:
      "DynaLines - EMS uređaj za jačanje mišića, redukciju masnog tkiva i oblikovanje tela. Neinvazivan, efikasan, sa više modula tretmana.",
    faq: [
      {
        question: "Kako EMS pomaže u oblikovanju tela?",
        answer:
          "EMS izaziva duboke mišićne kontrakcije koje jačaju mišiće i povećavaju potrošnju energije, što dovodi do redukcije masnog tkiva i bolje definicije mišića.",
      },
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman je bezbolan. Većina klijenata oseća prijatne mišićne kontrakcije, slično kao kod intenzivnog treninga.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "ems-chair",
    sku: "EST-EMS-CHAIR",
    name: "EMS Chair",
    shortDescription: "Stolica namenjena intimnoj nezi i jačanju mišića karličnog dna.",
    longDescription: `EMS Chair je specijalizovana stolica za intimnu negu, dizajnirana za jačanje mišića karličnog dna i poboljšanje pelvicnog zdravlja.

**Princip rada:** Koristi HIFEM tehnologiju za generisanje magnetnih vibracionih talasa (7 Tesla) radi stimulacije mišića karličnog dna.

**Ključne karakteristike:**
- Ublažava učestalo mokrenje, nagli nagon i inkontinenciju
- Jača kontrolu bešike i sfinktera
- Poboljšava cirkulaciju krvi i podržava erektilnu funkciju
- Jača centralnu snagu tela i izdržljivost
- Pogodno za starije muškarce i oporavak nakon operacije prostate
- Postporođajni oporavak i prevencija inkontinencije
- Poboljšava vaginalnu labavost i suvoću
- Poboljšava seksualnu funkciju i osetljivost
- Održava zdravlje karlice tokom menopauze

**Tehničke specifikacije:**
- Naziv proizvoda: Pelvic floor muscle repair instrument
- Intenzitet magnetne vibracije: 7 Tesla
- Izlazni napon: AC110V-230V
- Izlazna snaga: 300W-5000W
- Izlazna frekvencija: 3-200Hz
- Osigurač: 20A
- Dimenzije pakovanja stolice: 85×74×71cm
- Ukupna težina: 50kg

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-EMS-CHAIR
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "ems-hiemt-oblikovanje-tela-i-lica",
    image: placeholderImage("EMS Chair"),
    seoKeywords: [
      "ems chair",
      "karlično dno",
      "inkontinencija",
      "intimna nega",
      "HIFEM",
      "jačanje mišića",
      "postporođajni oporavak",
    ],
    metaDescription:
      "EMS Chair - stolica za jačanje mišića karličnog dna. Pomaže kod inkontinencije, postporođajnog oporavka i poboljšanja seksualne funkcije. Bezbedno i efikasno.",
    faq: [
      {
        question: "Da li je tretman bezbedan za sve?",
        answer:
          "Da, tretman je bezbedan za većinu ljudi. Preporučuje se konsultacija sa lekarom za osobe sa električnim implantatima ili trudnice.",
      },
      {
        question: "Koliko traje tretman?",
        answer:
          "Tretman obično traje 20-30 minuta, a preporučuje se serija od 6-8 tretmana za optimalne rezultate.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "cellushape",
    sku: "EST-CELLUSHAPE",
    name: "Cellushape",
    shortDescription: "Neinvazivni uređaj za oblikovanje tela, redukciju masti i celulita, kao i lifting lica i vrata.",
    longDescription: `Cellushape je najnovija neinvazivna tehnologija za oblikovanje tela, redukciju masti i celulita, te lifting lica i vrata. Kombinuje više tehnologija za sveobuhvatne rezultate.

**Namena:**
- Ciljanje masnih ćelija
- Stimulacija kolagena i zatezanje kože
- Poboljšanje cirkulacije i limfna drenaža
- Redukcija masti i oblikovanje tela

**Ključne karakteristike:**
- Višeslojna penetracija za efikasno ciljanje masti i celulita
- Kavitacija na 40kHz za bržu redukciju masnih ćelija
- Vakuum i masažni mehanizmi za stimulaciju cirkulacije i elastičnosti kože

**Tehničke specifikacije:**
- Širina impulsa: 0.5s-7.5s
- Negativan pritisak: 10-80 kPa
- Obrtaji valjka: 0-36 rpm
- Režim rada valjka: 4 tipa
- Frekvencija: 1-10 MHz
- Snaga lasera: max 20W
- Kavitacija: 40 kHz
- Zona tretmana: 4mm×7mm, 8mm×25mm, 30mm×50mm, 40mm×60mm
- Nominalna ulazna snaga: 750VA
- Napajanje: AC230V+10%, 50Hz / AC110V+10%, 60Hz
- Bruto težina: 62.8kg, 16.5kg
- Dimenzije pakovanja: 70x170x62cm, 67x57x31cm

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-RFT-CELLU
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kavitacija-i-rf-terapija",
    image: placeholderImage("Cellushape"),
    seoKeywords: [
      "cellushape",
      "oblikovanje tela",
      "redukcija celulita",
      "redukcija masti",
      "lifting lica",
      "kavitacija",
      "vakuum masaža",
    ],
    metaDescription:
      "Cellushape - neinvazivni uređaj za oblikovanje tela, redukciju celulita i lifting lica. Kombinuje kavitaciju, RF, laser i vakuum masažu za vrhunske rezultate.",
    faq: [
      {
        question: "Kako Cellushape deluje na celulit?",
        answer:
          "Cellushape koristi kombinaciju kavitacije, radiofrekvencije i vakuum masaže za razbijanje masnih naslaga, stimulaciju kolagena i poboljšanje limfne drenaže, što rezultira smanjenjem celulita.",
      },
      {
        question: "Da li je tretman bolan?",
        answer:
          "Tretman je bezbolan i prijatan. Većina klijenata opisuje ga kao opuštajuću masažu.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "post-treatment-spray",
    sku: "EST-POST-TREATMENT-SPRAY",
    name: "Tiferono sprej za negu nakon tretmana",
    shortDescription: "Osvežavajući i balansirajući sprej sa umirujućim biljnim sastojcima.",
    longDescription: `Tiferono sprej za negu nakon tretmana je osvežavajući tonik koji balansira i umiruje kožu nakon estetskih tretmana. Obogaćen je biljnim ekstraktima koji hidriraju i smiruju iritacije.

**Namena:** Osvežavanje i balansiranje kože nakon tretmana.

**Upotreba:** Nanesite na pamučni jastučić i pređite preko lica nakon čišćenja. Koristiti ujutru i uveče.

**Napomena:** Samo za spoljašnju upotrebu. Izbegavati kontakt sa očima. U slučaju iritacije prekinuti upotrebu i konsultovati lekara.

**Tehničke specifikacije:**
- Neto zapremina: 120ml

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-SPRAY
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Tiferono sprej za negu nakon tretmana"),
    seoKeywords: [
      "tiferono sprej",
      "nega nakon tretmana",
      "umirujući sprej",
      "tonik za lice",
      "kozmetika",
      "post-treatment",
    ],
    metaDescription:
      "Tiferono sprej za negu nakon tretmana - osvežavajući tonik sa biljnim ekstraktima. Umiruje, hidrira i balansira kožu. 120ml.",
    faq: [
      {
        question: "Kada koristiti sprej?",
        answer:
          "Preporučuje se upotreba ujutru i uveče, nakon čišćenja lica, pre nanošenja kreme.",
      },
      {
        question: "Da li je pogodan za sve tipove kože?",
        answer:
          "Da, sprej je blag i pogodan za sve tipove kože, uključujući osetljivu kožu.",
      },
    ],
    variations: [
      {
        label: "120ml",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "post-treatment-repair-cream",
    sku: "EST-POST-TREATMENT-REPAIR-CREAM",
    name: "Tiferono krema za regeneraciju nakon tretmana",
    shortDescription: "Hranljiva krema za regeneraciju kože sa eteričnim uljima i biljnim ekstraktima.",
    longDescription: `Tiferono krema za regeneraciju nakon tretmana je bogata, hranljiva krema dizajnirana da obnovi i zaštiti kožu nakon estetskih procedura. Sadrži eterična ulja i biljne ekstrakte koji dubinski hidriraju i smiruju kožu.

**Ključne karakteristike:**
- Duboko hidrira i regeneriše
- Jača kožnu barijeru
- Umiruje i smiruje kožu
- Obnavlja i regeneriše kožu
- Poboljšava zadržavanje vlage
- Smanjuje crvenilo i iritaciju

**Tehničke specifikacije:**
- Neto zapremina: 50ml

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-CREAM
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Tiferono krema za regeneraciju nakon tretmana"),
    seoKeywords: [
      "tiferono krema",
      "regeneracija kože",
      "nega nakon tretmana",
      "hidratantna krema",
      "umirujuća krema",
      "kozmetika",
    ],
    metaDescription:
      "Tiferono krema za regeneraciju nakon tretmana - hranljiva krema za obnovu i zaštitu kože. Hidrira, umiruje i jača kožnu barijeru. 50ml.",
    faq: [
      {
        question: "Kako koristiti kremu?",
        answer:
          "Nanositi na očišćenu kožu lica i vrata, nežno utrljati do potpune apsorpcije. Koristiti ujutru i uveče.",
      },
      {
        question: "Da li je pogodna za sve tipove kože?",
        answer:
          "Da, krema je pogodna za sve tipove kože, posebno za osetljivu i kožu sklonu iritacijama.",
      },
    ],
    variations: [
      {
        label: "50ml",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "post-treatment-defense",
    sku: "EST-POST-TREATMENT-DEFENSE",
    name: "Tiferono fizička krema za sunčanje SPF 41",
    shortDescription: "Fizička zaštita od sunca SPF 41 za širokospektralnu zaštitu kože.",
    longDescription: `Tiferono fizička krema za sunčanje SPF 41 pruža visoku, širokospektralnu zaštitu od UVA i UVB zračenja. Namenjena je zaštiti kože nakon estetskih tretmana, ali i svakodnevnoj upotrebi.

**Ključne karakteristike:**
- Visok nivo UV zaštite (SPF 41)
- Hidrira i hrani kožu
- Umiruje kožu prirodnim ekstraktima
- Štiti kožu od sunčevih oštećenja
- Održava kožu hidriranom i prijatnom
- Sadrži umirujuće biljne sastojke za dodatnu negu

**Tehničke specifikacije:**
- Neto zapremina: 30ml

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-SPF
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Tiferono fizička krema za sunčanje SPF 41"),
    seoKeywords: [
      "tiferono krema za sunčanje",
      "SPF 41",
      "fizička zaštita",
      "UVA UVB zaštita",
      "nega nakon tretmana",
      "kozmetika",
    ],
    metaDescription:
      "Tiferono fizička krema za sunčanje SPF 41 - širokospektralna zaštita od UVA i UVB zračenja. Hidrira, umiruje i štiti kožu. 30ml.",
    faq: [
      {
        question: "Zašto je važna zaštita od sunca nakon tretmana?",
        answer:
          "Nakon estetskih tretmana koža je osetljivija na UV zračenje. Zaštita sprečava hiperpigmentaciju i oštećenje kože.",
      },
      {
        question: "Da li je krema pogodna za sve tipove kože?",
        answer:
          "Da, fizička zaštita je pogodna za sve tipove kože, uključujući osetljivu kožu, jer ne sadrži hemijske filtere.",
      },
    ],
    variations: [
      {
        label: "30ml",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "post-treatment-collagen-serum",
    sku: "EST-POST-TREATMENT-COLLAGEN-SERUM",
    name: "Tiferono serum sa kolagenom za negu nakon tretmana",
    shortDescription: "Hidratantni serum sa kolagenom i biljnim ekstraktima.",
    longDescription: `Tiferono serum sa kolagenom je koncentrovani preparat za dubinsku hidrataciju i podmlađivanje kože. Formulisan je sa kolagenom i biljnim ekstraktima za poboljšanje elastičnosti i čvrstoće kože.

**Ključne karakteristike:**
- Duboko hidrira i ispunjava kožu
- Poboljšava elastičnost kože
- Umiruje i smiruje kožu
- Pojačava hidrataciju kože
- Poboljšava čvrstoću i elastičnost
- Smanjuje fine linije i bore

**Tehničke specifikacije:**
- Neto zapremina: 30ml

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-SERUM
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Tiferono serum sa kolagenom za negu nakon tretmana"),
    seoKeywords: [
      "tiferono serum",
      "kolagen",
      "serum sa kolagenom",
      "hidratacija",
      "podmlađivanje",
      "nega nakon tretmana",
      "kozmetika",
    ],
    metaDescription:
      "Tiferono serum sa kolagenom - hidratantni serum za podmlađivanje i poboljšanje elastičnosti kože. Smanjuje fine linije i bore. 30ml.",
    faq: [
      {
        question: "Kako koristiti serum?",
        answer:
          "Nanositi nekoliko kapi na očišćenu kožu lica i vrata, pre nanošenja kreme. Koristiti ujutru i uveče.",
      },
      {
        question: "Da li je pogodan za sve tipove kože?",
        answer:
          "Da, serum je lagan i pogodan za sve tipove kože, uključujući masnu i mešovitu kožu.",
      },
    ],
    variations: [
      {
        label: "30ml",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "post-treatment-repair-mask",
    sku: "EST-POST-TREATMENT-REPAIR-MASK",
    name: "Tiferono maska za regeneraciju nakon tretmana",
    shortDescription: "Umirujuća i hidratantna maska sa efektom hlađenja.",
    longDescription: `Tiferono maska za regeneraciju nakon tretmana pruža trenutno olakšanje i hidrataciju koži nakon estetskih procedura. Sa efektom hlađenja, umiruje iritacije i crvenilo.

**Ključne karakteristike:**
- Hladi i umiruje
- Duboko hidrira
- Smanjuje crvenilo i iritaciju
- Trenutno umiruje i osvežava kožu
- Pojačava hidrataciju i osećaj udobnosti
- Poboljšava otpornost i smirenost kože

**Tehničke specifikacije:**
- Neto zapremina: 5 komada

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-MASK
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Tiferono maska za regeneraciju nakon tretmana"),
    seoKeywords: [
      "tiferono maska",
      "regeneracija kože",
      "umirujuća maska",
      "hidratantna maska",
      "nega nakon tretmana",
      "kozmetika",
    ],
    metaDescription:
      "Tiferono maska za regeneraciju nakon tretmana - umirujuća i hidratantna maska sa efektom hlađenja. Smanjuje crvenilo i iritaciju. 5 komada.",
    faq: [
      {
        question: "Kako koristiti masku?",
        answer:
          "Nanositi na očišćenu kožu lica, ostaviti 15-20 minuta, zatim ukloniti višak ili utrljati preostali serum. Koristiti po potrebi.",
      },
      {
        question: "Koliko često koristiti masku?",
        answer:
          "Preporučuje se korišćenje 1-2 puta nedeljno, ili češće nakon intenzivnijih tretmana.",
      },
    ],
    variations: [
      {
        label: "5 kom.",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },

  // ---------------------------------------------------------------------------
  // NOVI proizvodi - dodati na osnovu Fotromed cenovnika (avgust 2026), posle
  // poređenja sa postojećim katalogom. HydroRevive Pro je podeljen na 2
  // odvojena proizvoda (9-u-1 i 15-u-1) jer Fotromed katalog ima 2 odvojene
  // šifre/fotografije za tu liniju umesto jedne generičke.
  // ---------------------------------------------------------------------------
  {
    slug: "hifu-22d-max",
    sku: "EST-HIFU-22D-MAX",
    name: "22D Max HIFU Machine",
    shortDescription: "HIFU uređaj sa superpulse tehnologijom koji kombinuje 13D HIFU i 18D RF za lifting lica i tela na više dubina tretmana.",
    longDescription: `22D Max HIFU Machine je profesionalni HIFU uređaj namenjen neinvazivnom liftingu lica i tela, sa naprednom superpulse tehnologijom za stabilan i fokusiran ultrazvuk.

**Princip rada:** Superpulse tehnologija isporučuje fokusirani ultrazvuk kroz kožu do dubljih slojeva (uključujući SMAS sloj), gde termalna energija podstiče kontrakciju postojećeg i stvaranje novog kolagena, bez oštećenja površine kože.

**Namena:**
- Nehirurški lifting lica i vrata
- Zatezanje tela
- Redefinisanje kontura lica

**Ključne karakteristike:**
- Superpulse tehnologija za stabilan fokusirani ultrazvuk
- Dubine tretmana od 1,5 do 18mm
- Kombinuje 13D HIFU i 18D RF u jednom uređaju
- MP režim za linijsko skeniranje, za ravnomerniju pokrivenost tretirane zone

*Napomena: tehnički podaci su prevod zvaničnih specifikacija sa fotromed.com (avgust 2026) - potvrdite tačne vrednosti u zvaničnoj B2B ponudi pre kupovine.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-22D
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("22D Max HIFU Machine"),
    seoKeywords: ["22D HIFU", "HIFU lifting lica", "superpulse HIFU", "13D HIFU", "18D RF", "neinvazivni lifting"],
    metaDescription:
      "22D Max HIFU Machine - profesionalni HIFU uređaj sa superpulse tehnologijom, 13D HIFU i 18D RF za lifting lica i tela.",
    faq: [
      {
        question: "Po čemu se 22D Max HIFU razlikuje od standardnih HIFU uređaja?",
        answer:
          "Kombinuje 13D HIFU i 18D RF u jednom sistemu sa superpulse tehnologijom, što omogućava stabilniji fokusirani ultrazvuk i pokrivenost šireg opsega dubina tretmana (1,5-18mm) u odnosu na osnovne HIFU modele.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hifu-12d",
    sku: "EST-HIFU-12D",
    name: "12D HIFU Machine – lice, telo i intimna regija",
    shortDescription: "HIFU uređaj sa 7 multi-frekventnih sondi za lice, telo i intimnu regiju, uključujući namenske sonde sa merenjem laksiteta.",
    longDescription: `12D HIFU Machine je svestran HIFU sistem koji, pored standardnog liftinga lica i tela, uključuje i namenske sonde za intimnu regiju.

**Princip rada:** 7 multi-frekventnih sondi (1,5-16mm), uključujući dubinu SMAS sloja, isporučuju fokusiranu ultrazvučnu energiju koja stimuliše proizvodnju kolagena i zatezanje tkiva.

**Namena:**
- Lifting lica i tela
- Intimna regija - namenske 3,0/4,5mm sonde sa merenjem laksiteta (opuštenosti tkiva)

**Ključne karakteristike:**
- 7 multi-frekventnih sondi, dubine 1,5-16mm
- Dupli nastavci za veću fleksibilnost tretmana
- Namenske sonde za intimnu regiju sa merenjem laksiteta

*Napomena: tehnički podaci su prevod zvaničnih specifikacija sa fotromed.com (avgust 2026) - potvrdite tačne vrednosti u zvaničnoj B2B ponudi pre kupovine. Tretmani intimne regije zahtevaju odgovarajuću obuku i, u zavisnosti od regulative, licencu zdravstvenog radnika.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-12D
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("12D HIFU Machine"),
    seoKeywords: ["12D HIFU", "HIFU intimna regija", "vaginalno pomladjivanje HIFU", "HIFU lice i telo"],
    metaDescription:
      "12D HIFU Machine - HIFU uređaj sa 7 sondi za lice, telo i intimnu regiju, sa merenjem laksiteta tkiva.",
    faq: [
      {
        question: "Da li je za tretmane intimne regije potrebna posebna obuka?",
        answer:
          "Da. Tretmani intimne regije zahtevaju dodatnu obuku i, u zavisnosti od lokalne regulative, odgovarajuću licencu ili kvalifikaciju zdravstvenog radnika - proverite uslove pre uvođenja ove usluge.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "ultralift-7d-pro",
    sku: "EST-ULTRALIFT-7D-PRO",
    name: "ULTRALIFT 7D Pro – MMFU tehnologija",
    shortDescription: "HIFU uređaj sa MMFU (mikro i makro fokusirani ultrazvuk) tehnologijom i ekskluzivnim kertridžom za predeo oka.",
    longDescription: `ULTRALIFT 7D Pro koristi MMFU (dvostruki mehanizam mikro i makro fokusiranog ultrazvuka) tehnologiju za tretman više slojeva kože u jednom prolazu.

**Princip rada:** Dvostruki mehanizam cilja 7 slojeva kože istovremeno, sa termičkom koagulacijom u opsegu 65-75°C koja podstiče remodeliranje kolagena.

**Namena:**
- Lifting i zatezanje lica, uključujući osetljivo područje oko očiju
- Oblikovanje i zatezanje tela

**Ključne karakteristike:**
- MMFU tehnologija - dvostruki mehanizam za 7 slojeva kože
- Ekskluzivni 2,0mm kertridž namenjen predelu oka
- Makro kertridži 6/9/13mm za telo
- Termička koagulacija 65-75°C

*Napomena: tehnički podaci su prevod zvaničnih specifikacija sa fotromed.com (avgust 2026) - potvrdite tačne vrednosti u zvaničnoj B2B ponudi pre kupovine.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HIFU-7D
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hifu-lifting-lica-i-tela",
    image: placeholderImage("ULTRALIFT 7D Pro"),
    seoKeywords: ["ULTRALIFT 7D Pro", "MMFU HIFU", "HIFU za predeo oka", "HIFU lifting tela"],
    metaDescription:
      "ULTRALIFT 7D Pro - MMFU HIFU uređaj sa ekskluzivnim kertridžom za predeo oka i makro kertridžima za telo.",
    faq: [
      {
        question: "Po čemu se razlikuje od modela UltraLift SD Compact koji već imamo?",
        answer:
          "UltraLift SD Compact koristi Synergy Dotting (MFU + RF u svakom impulsu), dok 7D Pro koristi MMFU - dvostruki mikro/makro fokusirani ultrazvuk sa posebnim kertridžom za osetljivo područje oko očiju, što ga čini pogodnijim za precizniji rad na toj zoni.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hydrafacial-ice-blue-7in1",
    sku: "EST-HYDRAFACIAL-ICEBLUE-7IN1",
    name: "7-u-1 Smart Ice Blue Hydra Facial aparat",
    shortDescription: "Napredni 7-u-1 hidrafacijal sistem sa hlađenjem i pametnim touch-screen interfejsom za profesionalne klinike.",
    longDescription: `7-u-1 Smart Ice Blue Hydra Facial aparat je napredni sistem za dubinsko čišćenje i negu kože, namenjen profesionalnim klinikama sa većim obimom klijenata.

**Princip rada:** Kombinuje hidra-dermabraziju sa dodatnim modalitetima (7 funkcija ukupno) i integrisanim sistemom hlađenja za dodatni komfor tokom tretmana.

**Namena:**
- Dubinsko čišćenje i hidratacija kože
- Podmlađivanje lica

**Ključne karakteristike:**
- 7 funkcija u jednom uređaju
- Ugrađeni sistem hlađenja
- Pametan touch-screen interfejs za lako upravljanje

*Napomena: tehnički podaci su prevod zvaničnih specifikacija sa fotromed.com (avgust 2026) - potvrdite tačne vrednosti u zvaničnoj B2B ponudi pre kupovine.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-ICEBLU
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("7-u-1 Smart Ice Blue Hydra Facial"),
    seoKeywords: ["Smart Ice Blue Hydra Facial", "7 u 1 hidrafacijal", "hidra dermabrazija sa hladjenjem"],
    metaDescription:
      "7-u-1 Smart Ice Blue Hydra Facial - napredni hidrafacijal sistem sa hlađenjem i touch-screen interfejsom.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hydrorevive-pro-9in1",
    sku: "EST-HYDROREVIVE-PRO-9IN1",
    name: "HydroRevive Pro 9-u-1",
    shortDescription: "Sveobuhvatna 9-u-1 hidrafacijal platforma za hidra dermabraziju i dubinsko čišćenje, namenjena salonima sa većim obimom klijenata.",
    longDescription: `HydroRevive Pro 9-u-1 je profesionalni uređaj za hidra dermabraziju iz HydroRevive Pro linije, namenjen salonima i distributerima koji žele sveobuhvatniju platformu za negu lica.

**Princip rada:** Kombinuje abrazivni hidra vrh sa vakuumom za nežno uklanjanje mrtvih ćelija i nečistoća, uz istovremenu hidrataciju kože, uz dodatnih 9 funkcija ukupno na jednom uređaju.

**Namena:**
- Dubinsko čišćenje kože
- Hidratacija i podmlađivanje
- Poboljšanje teksture kože

**Ključne karakteristike:**
- Sveobuhvatna platforma sa 9 funkcija
- Pogodna za salone, spa centre i veći obim klijenata
- Više različitih vrhova za različite tretmane

*Napomena: broj funkcija (9) preuzet je sa fotografije proizvoda na zvaničnom sajtu ("HydroRevive Pro 9-in-1") - excel cenovnik dobavljača u koloni naziva greškom navodi "14 u 1" za ovaj model, verovatno štamparska/prevodilačka greška u izvornom katalogu. Potvrdite tačan broj funkcija u zvaničnoj ponudi pre objavljivanja na sajtu.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-14IN1
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("HydroRevive Pro 9-u-1"),
    seoKeywords: ["hydrorevive pro 9 u 1", "hidra dermabrazija", "dubinsko čišćenje kože", "hidrafacijal salon"],
    metaDescription:
      "HydroRevive Pro 9-u-1 - sveobuhvatna hidrafacijal platforma za salone i distributere, dubinsko čišćenje i hidratacija kože.",
    faq: [
      {
        question: "Koliko često se preporučuje tretman hidra dermabrazijom?",
        answer:
          "Preporučuje se jednom mesečno za održavanje zdravlja kože, mada učestalost može varirati u zavisnosti od potreba kože.",
      },
    ],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hydrorevive-pro-15in1",
    sku: "EST-HYDROREVIVE-PRO-15IN1",
    name: "HydroRevive Pro 15-u-1",
    shortDescription: "Napredna 15-u-1 hidro dermabrazija platforma sa patentiranom hidro-kiseoničnom tehnologijom, za klinike.",
    longDescription: `HydroRevive Pro 15-u-1 je najopremljeniji model iz HydroRevive Pro linije, namenjen klinikama koje žele najširi mogući raspon funkcija na jednom uređaju.

**Princip rada:** Patentirana hidro-kiseonična dermabrazija kombinovana sa dodatnim modalitetima, uz smart touch upravljanje za precizno podešavanje parametara po klijentu.

**Namena:**
- Dubinsko čišćenje i hidratacija kože, za sve uzraste i delove tela
- Podmlađivanje i poboljšanje teksture kože

**Ključne karakteristike:**
- Patentirana hidro-kiseonična dermabrazija
- 15 funkcija u jednom uređaju
- Smart touch upravljanje
- Pogodno za sve uzraste i delove tela

*Napomena: ovo je "veći" model iz iste HydroRevive Pro linije kao HydroRevive Pro 9-u-1 (isti proizvođač, viša konfiguracija) - potvrdite tačnu specifikaciju i cenovnu razliku u zvaničnoj ponudi.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-HYD-15IN1
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "hidrafacijal-nega-i-dubinsko-ciscenje-koze",
    image: placeholderImage("HydroRevive Pro 15-u-1"),
    seoKeywords: ["hydrorevive pro 15 u 1", "hidro kiseonicna dermabrazija", "hidrafacijal klinika"],
    metaDescription:
      "HydroRevive Pro 15-u-1 - napredna hidro-kiseonična dermabrazija platforma sa 15 funkcija, za klinike.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "scalp-analysis-machine",
    sku: "EST-SCALP-ANALYSIS",
    name: "Scalp Analysis Machine",
    shortDescription: "Specijalizovan uređaj za analizu vlasišta i kose, namenjen trihološkim i dermatološkim konsultacijama.",
    longDescription: `Scalp Analysis Machine je specijalizovan dijagnostički uređaj posvećen isključivo analizi vlasišta i kose, za razliku od kombinovanih koža+vlasište analizatora iz ponude.

**Princip rada:** Uveličano i osvetljeno snimanje vlasišta i korena kose omogućava detaljan uvid u stanje folikula, gustinu kose i eventualne probleme vlasišta.

**Namena:**
- Trihološke konsultacije (analiza opadanja kose, stanja folikula)
- Dermatološke konsultacije vezane za vlasište

**Ključne karakteristike:**
- Specijalizovana, isključivo za analizu vlasišta i kose (ne kombinovan uređaj)
- Namenjen preciznim trihološkim i dermatološkim konsultacijama

*Napomena: tehnički podaci su prevod zvaničnih specifikacija sa fotromed.com (avgust 2026) - potvrdite tačne vrednosti u zvaničnoj B2B ponudi pre kupovine.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKN-SCALP
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "analiza-koze",
    image: placeholderImage("Scalp Analysis Machine"),
    seoKeywords: ["analiza vlasišta", "trihoskopija aparat", "scalp analyzer", "analiza kose"],
    metaDescription:
      "Scalp Analysis Machine - specijalizovan uređaj za analizu vlasišta i kose za trihološke konsultacije.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "hydrojelly-mask",
    sku: "EST-HYDROJELLY-MASK",
    name: "Hydrojelly Mask",
    shortDescription: "Hidratantna želatinasta maska za smirivanje kože nakon estetskih tretmana.",
    longDescription: `Hydrojelly Mask je hidratantna želatinasta maska namenjena nezi kože neposredno nakon estetskih tretmana, kada je koža osetljivija i treba joj dodatno smirivanje.

**Namena:**
- Smirivanje i hidratacija kože nakon tretmana (HIFU, laser, mikroigličenje i sl.)
- Umirujuća nega osetljive kože

**Ključne karakteristike:**
- Želatinasta (jelly) tekstura koja se lako nanosi i skida u jednom komadu
- Hidratantno i umirujuće dejstvo

*Napomena: ovo je proizvod iz Fotromed kataloga potrošne robe (za razliku od Tiferono linije koju već imate u ponudi) - proverite brend/sastav u zvaničnoj ponudi pre nabavke.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-SKC-JELLY
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "kozmeticki-proizvodi-post-tretman",
    image: placeholderImage("Hydrojelly Mask"),
    seoKeywords: ["hydrojelly mask", "želatinasta maska za lice", "nega kože nakon tretmana"],
    metaDescription:
      "Hydrojelly Mask - hidratantna želatinasta maska za smirivanje kože nakon estetskih tretmana.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "carbon-gel",
    sku: "EST-CARBON-GEL",
    name: "Carbon Gel",
    shortDescription: "Nano biljni ugljenični gel za carbon peeling tretmane, dovoljan za 20+ tretmana po pakovanju.",
    longDescription: `Carbon Gel je potrošni materijal namenjen carbon peeling tretmanima (laserski carbon peeling), gde se gel nanosi na kožu pre laserskog dela tretmana.

**Namena:**
- Carbon peeling tretmani (u kombinaciji sa odgovarajućim laserom, npr. Q-Switch Nd:YAG)

**Ključne karakteristike:**
- Nano biljni ugljenični sastav
- Jedno pakovanje dovoljno za 20+ tretmana

*Napomena: ovo je potrošni materijal, ne samostalan uređaj - koristi se uz postojeći laserski aparat za carbon peeling tretmane.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CON-CARBON
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "potrosni-materijal",
    image: placeholderImage("Carbon Gel"),
    seoKeywords: ["carbon gel", "carbon peeling", "potrošni materijal laser tretman"],
    metaDescription: "Carbon Gel - nano biljni ugljenični gel za carbon peeling tretmane, za 20+ tretmana po pakovanju.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "zastitne-naocare-ipl-led-pacijent",
    sku: "EST-ZASTITNE-NAOCARE-IPL-LED-PACIJENT",
    name: "Zaštitne naočare/maske za IPL i LED (pacijent)",
    shortDescription: "Zaštitne naočare/maske za oči klijenta tokom IPL i LED tretmana, udoban dizajn za višekratnu upotrebu.",
    longDescription: `Zaštitne naočare/maske za IPL i LED tretmane namenjene su zaštiti očiju klijenta (pacijenta) tokom trajanja tretmana svetlosnim uređajima.

**Namena:**
- Zaštita očiju klijenta tokom IPL i LED tretmana

**Ključne karakteristike:**
- Optimalna zaštita očiju
- Udoban dizajn za višekratnu upotrebu

*Napomena: ovo je lična zaštitna oprema za klijenta, obavezna oprema uz svaki IPL/LED uređaj u ponudi (npr. FotoMed Pulse Pro/Mini, LumiThera LED serija).*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CON-GOGGLE
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "potrosni-materijal",
    image: placeholderImage("Zaštitne naočare IPL i LED (pacijent)"),
    seoKeywords: ["zaštitne naočare IPL", "zaštita očiju LED tretman", "naočare za pacijenta IPL"],
    metaDescription: "Zaštitne naočare/maske za IPL i LED tretmane - zaštita očiju klijenta, za višekratnu upotrebu.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "zastitne-naocare-ipl",
    sku: "EST-ZASTITNE-NAOCARE-IPL",
    name: "Zaštitne naočare za IPL",
    shortDescription: "Zaštitne naočare za IPL tretmane sa velikim sočivima za širok vidni ugao i zaštitom obrva.",
    longDescription: `Zaštitne naočare za IPL namenjene su terapeutu/operateru tokom rada sa IPL uređajima.

**Namena:**
- Zaštita očiju terapeuta tokom IPL tretmana

**Ključne karakteristike:**
- Velika sočiva za širok vidni ugao
- Izdržljiv polikarbonatni materijal
- Zaštita obrva

*Napomena: obavezna lična zaštitna oprema za terapeuta uz svaki IPL uređaj u ponudi.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CON-IPLGL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "potrosni-materijal",
    image: placeholderImage("Zaštitne naočare za IPL"),
    seoKeywords: ["zaštitne naočare IPL terapeut", "IPL zaštitna oprema"],
    metaDescription: "Zaštitne naočare za IPL - lična zaštitna oprema za terapeuta, izdržljiv polikarbonatni materijal.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },
  {
    slug: "zastitne-naocare-dijodni-laser",
    sku: "EST-ZASTITNE-NAOCARE-DIJODNI-LASER",
    name: "Zaštitne naočare za dijodni laser",
    shortDescription: "Zaštitne naočare za rad sa dijodnim laserom, za talasne dužine 755/808/1064nm.",
    longDescription: `Zaštitne naočare za dijodni laser namenjene su terapeutu/operateru tokom rada sa dijodnim laserskim uređajima za trajnu depilaciju.

**Namena:**
- Zaštita očiju terapeuta tokom rada sa dijodnim laserom (npr. Lasemooth Pro/Smart)

**Ključne karakteristike:**
- Zaštita za talasne dužine 755/808/1064nm
- Udoban otvoreni dizajn za dužu upotrebu

*Napomena: obavezna lična zaštitna oprema za terapeuta uz dijodne lasere u ponudi.*

**Nabavni podaci (Fotromed cenovnik, avgust 2026):**
- Šifra proizvođača (Fotromed): FM-CON-DLGL
- Garancija: 12-24 meseca (zavisi od modela)
- Rok isporuke: 30-60 dana (standardno)
- Dostupnost: Na upit (MOQ 1 komad)
- Nabavna i preporučena maloprodajna cena nisu javno objavljene od strane Fotromed - potrebna zvanična B2B ponuda.`,
    categorySlug: "potrosni-materijal",
    image: placeholderImage("Zaštitne naočare za dijodni laser"),
    seoKeywords: ["zaštitne naočare dijodni laser", "laser zaštitna oprema 755 808 1064"],
    metaDescription: "Zaštitne naočare za dijodni laser - zaštita za 755/808/1064nm, udoban dizajn za dužu upotrebu.",
    faq: [],
    variations: [
      {
        label: "Standardna varijanta",
        price: 12345,
        stock: 0,
        isActive: true,
      },
    ],
    badge: "none",
    isActive: false,
  },];

// ---------------------------------------------------------------------------
// Upsert funkcije
// ---------------------------------------------------------------------------

async function upsertTags() {
  const bySlug = {};
  for (const def of tagDefs) {
    const doc = await Tag.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, isActive: true },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

async function upsertCategories() {
  const bySlug = {};
  for (const def of categoryDefs) {
    const doc = await Category.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      {
        name: def.name,
        slug: def.slug,
        domain: DOMAIN,
        shortDescription: def.shortDescription,
        parent: null,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

async function upsertProducts(categoriesBySlug, tagsBySlug) {
  const productIdsBySlug = {};

  for (const def of productDefs) {
    const category = categoriesBySlug[def.categorySlug];
    if (!category) {
      throw new Error(`Proizvod "${def.slug}" referenciše nepostojeću kategoriju "${def.categorySlug}".`);
    }

    const tagSlugs = productTagMapping[def.slug] || [];
    const tags = tagSlugs.map((slug) => {
      const tag = tagsBySlug[slug];
      if (!tag) {
        throw new Error(`Proizvod "${def.slug}" referenciše nepostojeći tagSlug "${slug}" - proveri tagDefs.`);
      }
      return tag._id;
    });

    const existing = await Product.findOne({ slug: def.slug });

    const variations = def.variations.map((v) => {
      const existingVariation = existing?.variations?.find((ev) => ev.label === v.label);
      return existingVariation ? { ...v, _id: existingVariation._id } : v;
    });

    const payload = {
      name: def.name,
      slug: def.slug,
      sku: def.sku,
      shortDescription: def.shortDescription,
      // def.longDescription is still written as a plain markdown-ish string
      // throughout this file's product definitions below - converted to the
      // structured block format here, once, rather than hand-rewriting every
      // one of them (see content-blocks.util.js's markdownStringToBlocks).
      longDescription: markdownStringToBlocks(def.longDescription),
      categories: [category._id],
      tags,
      image: def.image,
      seoKeywords: def.seoKeywords,
      metaDescription: def.metaDescription,
      faq: def.faq || [],
      variations,
      badge: def.badge,
      isActive: def.isActive,
    };

    let doc;
    if (existing) {
      existing.set(payload);
      await existing.validate();
      doc = await existing.save();
    } else {
      doc = await Product.create(payload);
    }

    productIdsBySlug[def.slug] = doc._id;
  }

  return productIdsBySlug;
}

// ---------------------------------------------------------------------------
// Glavna seed funkcija
// ---------------------------------------------------------------------------

export async function seedProductCatalog() {
  const tagsBySlug = await upsertTags();
  const categoriesBySlug = await upsertCategories();
  const productIdsBySlug = await upsertProducts(categoriesBySlug, tagsBySlug);

  const summary = {
    tags: Object.keys(tagsBySlug).length,
    categories: Object.keys(categoriesBySlug).length,
    products: Object.keys(productIdsBySlug).length,
  };

  logInfo("Katalog proizvoda (tagovi + kategorije + 61 proizvod) seedovan - SVI kao draft (isActive: false)", summary);
  return summary;
}

export default seedProductCatalog;