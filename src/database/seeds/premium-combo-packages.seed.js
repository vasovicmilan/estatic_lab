import Tag from "../../models/tag.model.js";
import Service from "../../models/service.model.js";
import Package from "../../models/package.model.js";
import { logInfo } from "../../utils/logger.util.js";

const DOMAIN = "service";

// ---------------------------------------------------------------------------
// NAPOMENA
// ---------------------------------------------------------------------------
// Ovaj seed NE kreira ponovo usluge/kategorije/postojeće tagove - pretpostavlja
// da je run-esma-seed.js već pokrenut (usluge teslatone-24, aquadrain-360,
// lipolise-russianmax, triactive-celluerase, lasersonic-face-sculpt,
// medicinski-bioreset, relaks-masaza, sportska-masaza, terapeutska-masaza,
// anticelulit-masaza već postoje u bazi). Ovaj seed samo:
//   1) doda dva nova taga ("premium-paket", "esma-i-masaza"),
//   2) kreira 6 novih Package dokumenata koji KOMBINUJU jednu ESMA/struja
//      uslugu (glavni akcenat, 5 seansi) sa jednom ručnom masažom (sporedni
//      akcenat, 3 seanse) - najpremiumniji nivo ponude, gde aparaturni
//      tretman radi na uzroku (masne naslage/tonus/bol/limfa/lifting), a
//      masaža dopunjuje efekat (cirkulacija, opuštanje mišića, tekstura kože).
//
// Cene/trajanja/popust su svesno NE izračunati dinamički ovde (isti princip
// kao u esma-catalog.seed.js) da bi seed ostao čitljiv i lako proverljiv red
// po red. Popust je fiksno 15% na zbir pojedinačnih cena (basePrice) - između
// postojećeg popusta za 5 sesija jedne usluge (10%) i 10 sesija (20%), pošto
// je ovo kombinacija DVE usluge, a ne ponavljanje jedne.
// ---------------------------------------------------------------------------

const tagDefs = [
  { slug: "premium-paket", name: "Premium paket" },
  { slug: "esma-i-masaza", name: "ESMA + masaža" },
];

const comboDefs = [
  // --- 1. Anticelulit Premium (Lipolise Russian-Max + Anticelulit masaža) ---
  {
    slug: "anticelulit-premium",
    name: "Anticelulit Premium – Lipolise Russian‑Max + Anticelulit masaža",
    shortDescription:
      "Najsveobuhvatniji anticelulit paket – elektrolipoliza radi na masnim naslagama, ručna anticelulit masaža dodatno podstiče cirkulaciju i teksturu kože. Ušteda 15%.",
    description:
      "Anticelulit Premium kombinuje 5 tretmana Lipolise Russian‑Max (elektrolipoliza na ESMA Favorit aparatu, glavni akcenat paketa) sa 3 anticelulit masaže celog tela (sporedni akcenat, ručna tehnika). Elektrolipoliza deluje na masne ćelije u tretiranoj zoni, dok ručna anticelulit masaža dodatno podstiče lokalnu cirkulaciju i limfnu drenažu, doprinoseći boljoj teksturi kože. Ovaj paket je namenjen klijentima koji žele sveobuhvatniji pristup radu na celulitu i lokalizovanim masnim naslagama, uz redovnu fizičku aktivnost i zdravu ishranu za najbolje rezultate. Sesije obe usluge se zakazuju pojedinačno, u dogovoru sa terapeutom, i mogu se naizmenično kombinovati tokom trajanja paketa.",
    badge: "PREMIUM -15%",
    isBest: false,
    main: { serviceSlug: "lipolise-russianmax", variantSlug: "jedan-tretman-45-min", sessions: 5 },
    secondary: { serviceSlug: "anticelulit-masaza", variantSlug: "60-min-celo-telo", sessions: 3 },
    totalPrice: 29000,
    basePrice: 34100,
    seoKeywords: ["anticelulit premium paket", "elektrolipoliza i masaza", "kombinovani anticelulit tretman novi sad"],
    faq: [
      {
        question: "Zašto kombinovati elektrolipolizu sa ručnom masažom umesto samo jedne od njih?",
        answer:
          "Elektrolipoliza deluje direktno na masne ćelije, dok ručna masaža radi na cirkulaciji i limfnoj drenaži okolnog tkiva - kombinacija cilja problem sa dve različite strane, što terapeut prilagođava vašem stanju.",
        order: 1,
      },
      {
        question: "U kom redosledu se rade tretmani?",
        answer:
          "Terapeut na konsultaciji predlaže raspored - najčešće se anticelulit masaža radi u danima između ESMA tretmana radi kontinuirane podrške cirkulaciji.",
        order: 2,
      },
      {
        question: "Da li paket ima rok trajanja?",
        answer: "Preporučujemo da svih 8 tretmana iskoristite u razmaku od nekoliko nedelja radi kontinuiteta efekta. Za tačan rok važenja pitajte na konsultaciji.",
        order: 3,
      },
    ],
  },

  // --- 2. Tri-Active Anticelulit MAX Premium (Tri-Active Cellu-Erase + Anticelulit masaža) ---
  {
    slug: "tri-active-anticelulit-max-premium",
    name: "Tri‑Active Anticelulit MAX Premium – Tri‑Active Cellu‑Erase + Anticelulit masaža",
    shortDescription:
      "Najintenzivniji anticelulit paket u ponudi – kombinovani ESMA tretman (ultrazvuk + struja + svetlosna terapija) i ručna anticelulit masaža. Za tvrdokorni celulit. Ušteda 15%.",
    description:
      "Tri‑Active Anticelulit MAX Premium je naš najsveobuhvatniji anticelulit paket, namenjen klijentima sa dugotrajnim i tvrdokornim celulitom. Glavni akcenat je 5 tretmana Tri‑Active Cellu‑Erase - kombinovanog ESMA tretmana koji u jednoj proceduri objedinjuje ultrazvuk, interferentnu struju i svetlosnu terapiju. Sporedni akcenat su 3 anticelulit masaže celog tela, koje ručnom tehnikom dodatno podstiču cirkulaciju i doprinose boljoj teksturi kože između aparaturnih tretmana. Ova kombinacija spaja tehnološki najsveobuhvatniji ESMA tretman sa ručnim radom, za klijente koji žele da ulože maksimalno u rad na celulitu. Preporučuje se uz zdravu ishranu i fizičku aktivnost za najbolje i dugotrajnije rezultate. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    badge: "NAJPREMIUM PAKET",
    isBest: true,
    main: { serviceSlug: "triactive-celluerase", variantSlug: "jedan-tretman-75-min", sessions: 5 },
    secondary: { serviceSlug: "anticelulit-masaza", variantSlug: "60-min-celo-telo", sessions: 3 },
    totalPrice: 35350,
    basePrice: 41600,
    seoKeywords: ["tri active anticelulit max", "najjaci anticelulit paket novi sad", "tvrdokorni celulit tretman"],
    faq: [
      {
        question: "Kome se preporučuje ovaj paket u odnosu na 'Anticelulit Premium'?",
        answer:
          "Tri-Active Cellu-Erase je duži i tehnološki sveobuhvatniji tretman (ultrazvuk + struja + svetlosna terapija u jednoj proceduri) od Lipolise Russian-Max, pa terapeut ovaj paket najčešće predlaže za izraženiji, dugotrajniji celulit.",
        order: 1,
      },
      {
        question: "Koliko traje jedna poseta u okviru paketa?",
        answer: "Tri-Active Cellu-Erase tretman traje 75 minuta, a anticelulit masaža 60 minuta - ukupno trajanje paketa je oko 9 sati i 15 minuta raspoređeno kroz 8 poseta.",
        order: 2,
      },
    ],
  },

  // --- 3. Sculpt & Glow Premium (Laser-Sonic Face Sculpt + Relaks masaža) ---
  {
    slug: "sculpt-glow-premium",
    name: "Sculpt & Glow Premium – Laser‑Sonic Face Sculpt + Relaks masaža",
    shortDescription:
      "Lifting lica bez igala uz opuštanje vrata i ramena – mikrostrujni lifting kao glavni akcenat, relaks masaža gornjeg dela tela kao dopuna. Ušteda 15%.",
    description:
      "Sculpt & Glow Premium kombinuje 5 tretmana Laser‑Sonic Face Sculpt (mikrostruje + ultrazvuk + svetlosna terapija za lice, glavni akcenat) sa 3 relaks masaže gornjeg dela tela (vrat, ramena, leđa, ruke - sporedni akcenat). Napetost u vratu i ramenima se često odražava i na izgled lica, pa opuštanje ove regije dodatno doprinosi utisku svežine i opuštenosti koji donosi tretman lica. Laser‑Sonic Face Sculpt radi nežan miolifting i podstiče unos aktivnih sastojaka u kožu, dok relaks masaža smanjuje mišićnu napetost nastalu usled stresa ili dugog sedenja. Rezultat je zategnutiji, odmorniji i sjajniji izgled. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    badge: "PREMIUM -15%",
    isBest: false,
    main: { serviceSlug: "lasersonic-face-sculpt", variantSlug: "jedan-tretman-45-min", sessions: 5 },
    secondary: { serviceSlug: "relaks-masaza", variantSlug: "30-min-gornji-ili-donji-deo-tela", sessions: 3 },
    totalPrice: 25500,
    basePrice: 30000,
    seoKeywords: ["lifting lica i masaza paket", "sculpt glow premium", "anti-aging paket novi sad"],
    faq: [
      {
        question: "Zašto se uz tretman lica dodaje masaža vrata i ramena, a ne lica?",
        answer:
          "Napetost u vratu i ramenima često se prenosi na mišiće lica i držanje glave - opuštanje ove regije dopunjuje efekat mikrostrujnog liftinga, umesto da ga dupliramo dodatnim tretmanom same zone lica.",
        order: 1,
      },
      {
        question: "Da li mogu da izaberem donji deo tela umesto gornjeg za relaks masažu?",
        answer: "Varijanta uključena u ovaj paket je gornji deo tela (vrat, ramena, leđa, ruke), jer najviše dopunjuje efekat tretmana lica - za drugačiju kombinaciju javite se terapeutu na konsultaciji.",
        order: 2,
      },
    ],
  },

  // --- 4. Sport Recovery Premium (Medicinski Bio-Reset + Sportska masaža) ---
  {
    slug: "sport-recovery-premium",
    name: "Sport Recovery Premium – Medicinski Bio‑Reset + Sportska masaža",
    shortDescription:
      "Fizikalna terapija za bol i napetost, uz sportsku masažu za oporavak mišića – kombinacija za sportiste i rekreativce. Ušteda 15%.",
    description:
      "Sport Recovery Premium je namenjen sportistima i rekreativcima koji žele sveobuhvatniju podršku oporavku. Glavni akcenat je 5 tretmana Medicinski Bio‑Reset - fizikalnog ESMA tretmana koji kombinuje interferentne struje, ultrazvuk i svetlosnu terapiju radi ublažavanja bola i mišićne napetosti. Sporedni akcenat su 3 sportske masaže celog tela, koje dubljim, ciljanim tehnikama pomažu u smanjenju osećaja ukočenosti i zamora nakon napora. Ova kombinacija objedinjuje aparaturni pristup bolu i napetosti sa ručnim radom na oporavku mišića, kao dopuna - ne zamena - redovnoj fizikalnoj terapiji i lekarskom tretmanu. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom, prema vašem rasporedu treninga.",
    badge: "PREMIUM -15%",
    isBest: false,
    main: { serviceSlug: "medicinski-bioreset", variantSlug: "jedan-tretman-45-min", sessions: 5 },
    secondary: { serviceSlug: "sportska-masaza", variantSlug: "60-min-celo-telo", sessions: 3 },
    totalPrice: 31100,
    basePrice: 36600,
    seoKeywords: ["oporavak sportista paket", "sport recovery premium", "fizikalna terapija i sportska masaza"],
    faq: [
      {
        question: "Da li ovaj paket zamenjuje lekarski tretman ili fizikalnu terapiju?",
        answer:
          "Ne. Sport Recovery Premium je dopuna redovnoj fizikalnoj terapiji i lekarskom tretmanu, ne zamena - kod jakog ili dugotrajnog bola prvo se obratite lekaru ili fizijatru.",
        order: 1,
      },
      {
        question: "Kada je najbolje zakazati sportsku masažu u odnosu na trening?",
        answer: "Terapeut na konsultaciji predlaže raspored - masaža nakon napora najčešće pomaže oporavku, dok masaža pre treninga može doprineti fleksibilnosti.",
        order: 2,
      },
    ],
  },

  // --- 5. Detox & Relax Premium (Aqua-Drain 360 + Relaks masaža) ---
  {
    slug: "detox-relax-premium",
    name: "Detox & Relax Premium – Aqua‑Drain 360 + Relaks masaža",
    shortDescription:
      "Limfna drenaža za lagane noge, uz relaks masažu celog tela za opšte opuštanje – detoksikacija i predah u jednom paketu. Ušteda 15%.",
    description:
      "Detox & Relax Premium kombinuje 5 tretmana Aqua‑Drain 360 (limfna drenaža na ESMA Favorit aparatu, glavni akcenat) sa 3 relaks masaže celog tela (60 minuta, sporedni akcenat). Aqua‑Drain 360 kroz ritmični talasni pritisak podstiče izbacivanje nakupljene tečnosti i cirkulaciju, dok relaks masaža dodatno smanjuje mišićnu napetost i podstiče opšte opuštanje tela i uma. Paket je pogodan za osobe sa sindromom „teških nogu“, zadržavanjem vode ili jednostavno za one kojima je potreban predah uz osećaj lakoće. Sesije obe usluge se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    badge: "PREMIUM -15%",
    isBest: false,
    main: { serviceSlug: "aquadrain-360", variantSlug: "jedan-tretman-45-min", sessions: 5 },
    secondary: { serviceSlug: "relaks-masaza", variantSlug: "60-min-celo-telo", sessions: 3 },
    totalPrice: 25850,
    basePrice: 30400,
    seoKeywords: ["limfna drenaza i masaza paket", "detox relax premium", "paket za teske noge novi sad"],
    faq: [
      {
        question: "Da li je ovaj paket pogodan ako nemam otoke, samo želim da se opustim?",
        answer: "Da - kombinacija limfne drenaže i relaks masaže pogodna je i kao opšti wellness paket za osećaj lakoće i opuštenosti, ne samo za izraženo zadržavanje tečnosti.",
        order: 1,
      },
    ],
  },

  // --- 6. Tonus & Terapeutska Premium (Tesla-Tone 24 + Terapeutska masaža) ---
  {
    slug: "tonus-terapeutska-premium",
    name: "Tonus & Terapeutska Premium – Tesla‑Tone 24 + Terapeutska masaža",
    shortDescription:
      "Miostimulacija za tonus mišića uz terapeutsku masažu koja otpušta zategnute zone – za one koji ulažu u telo, ali i u oporavak. Ušteda 15%.",
    description:
      "Tonus & Terapeutska Premium kombinuje 5 tretmana Tesla‑Tone 24 (miostimulacija celog tela na ESMA Favorit aparatu, glavni akcenat) sa 3 terapeutske masaže celog tela (sporedni akcenat). Tesla‑Tone 24 simulira intenzivan trening i podstiče tonus mišića, dok terapeutska masaža ciljano radi na zategnutim zonama i mišićnim čvorićima koji mogu nastati usled intenzivnijeg fizičkog angažovanja ili dugog sedenja. Ova kombinacija je pogodna za klijente koji žele brži osećaj tonusa mišića uz podršku u vidu otpuštanja napetosti, uz redovnu fizičku aktivnost i zdravu ishranu za najbolje rezultate. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    badge: "PREMIUM -15%",
    isBest: false,
    main: { serviceSlug: "teslatone-24", variantSlug: "jedan-tretman-45-min", sessions: 5 },
    secondary: { serviceSlug: "terapeutska-masaza", variantSlug: "60-min-celo-telo", sessions: 3 },
    totalPrice: 27600,
    basePrice: 32500,
    seoKeywords: ["miostimulacija i masaza paket", "tonus terapeutska premium", "paket za tonus misica novi sad"],
    faq: [
      {
        question: "Da li terapeutska masaža smanjuje efekat miostimulacije?",
        answer:
          "Ne - terapeutska masaža radi na otpuštanju zategnutih zona i mišićnih čvorića, što je komplementarno sa jačanjem tonusa kroz miostimulaciju, a ne suprotno njemu. Terapeut prilagođava raspored sesija.",
        order: 1,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Upsert funkcije
// ---------------------------------------------------------------------------

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

async function loadService(slug) {
  const service = await Service.findOne({ slug }).lean();
  if (!service) {
    throw new Error(`Usluga "${slug}" ne postoji - pokreni prvo run-esma-seed.js pre ovog seed-a.`);
  }
  return service;
}

function findVariant(service, variantSlug) {
  const variant = (service.packages || []).find((p) => p.slug === variantSlug);
  if (!variant) {
    throw new Error(`Usluga "${service.slug}" nema varijantu "${variantSlug}" - proveri esma-catalog.seed.js.`);
  }
  return variant;
}

// De-dupes a list of ObjectId-like values by string form - main/secondary
// services often share a category (e.g. both "esma"/"struja") but never share
// the massage's "masaze" category, so a package combining both ends up
// filterable under either.
function dedupeIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const key = String(id);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(id);
    }
  }
  return out;
}

async function upsertCombos(premiumTagIds) {
  const created = [];
  for (const def of comboDefs) {
    const mainService = await loadService(def.main.serviceSlug);
    const mainVariant = findVariant(mainService, def.main.variantSlug);
    const secondaryService = await loadService(def.secondary.serviceSlug);
    const secondaryVariant = findVariant(secondaryService, def.secondary.variantSlug);

    const items = [
      { service: mainService._id, servicePackageId: mainVariant._id, sessions: def.main.sessions },
      { service: secondaryService._id, servicePackageId: secondaryVariant._id, sessions: def.secondary.sessions },
    ];

    const totalDuration = mainVariant.duration * def.main.sessions + secondaryVariant.duration * def.secondary.sessions;
    const categories = dedupeIds([...mainService.categories, ...secondaryService.categories]);
    const tags = dedupeIds([...mainService.tags, ...secondaryService.tags, ...premiumTagIds]);

    const payload = {
      name: def.name,
      slug: def.slug,
      description: def.description,
      shortDescription: def.shortDescription,
      items,
      totalPrice: def.totalPrice,
      basePrice: def.basePrice,
      totalDuration,
      badge: def.badge,
      isBest: def.isBest || false,
      categories,
      tags,
      faq: def.faq || [],
      seoKeywords: def.seoKeywords || [],
      isActive: true,
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

// ---------------------------------------------------------------------------
// Glavna seed funkcija
// ---------------------------------------------------------------------------

export async function seedPremiumComboPackages() {
  const tagsBySlug = await upsertTags();
  const premiumTagIds = tagDefs.map((t) => tagsBySlug[t.slug]._id);
  const created = await upsertCombos(premiumTagIds);

  console.log("\n📊 PREMIUM ESMA + MASAŽA KOMBO PAKETI:");
  console.table(
    created.map((p) => ({
      naziv: p.name,
      cena: `${p.totalPrice} RSD`,
      staraCena: `${p.basePrice} RSD`,
      trajanje: `${p.totalDuration} min`,
      oznaka: p.badge,
      najbolji: p.isBest ? "DA" : "-",
    }))
  );

  const summary = {
    tags: Object.keys(tagsBySlug).length,
    packages: created.length,
  };

  logInfo("Premium ESMA + masaža kombo paketi seedovani", summary);
  return summary;
}

export default seedPremiumComboPackages;