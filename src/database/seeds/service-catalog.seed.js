import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Service from "../../models/service.model.js";
import { RESOURCE_MASSAGE_TABLE_ID, RESOURCE_ESMA_TABLE_ID } from "./resource.seed.js";
import { logInfo } from "../../utils/logger.util.js";

const DOMAIN = "service";

// ---------------------------------------------------------------------------
// NAPOMENA (konsolidacija, avgust 2026.)
// ---------------------------------------------------------------------------
// Ovaj fajl zamenjuje i objedinjuje SVE što se ranije nalazilo u:
//   - esma-catalog.seed.js  (kategorije, tagovi, 6 ESMA + 4 masaže)
//   - esma-masaza-protokoli.seed.js (4 kombinovana ESMA+masaža protokola,
//     jedna seansa u jednoj poseti - Full Body Contouring 3u1,
//     Anticelulit & Tightening Kombo, Fizio-Express Back Relief,
//     Post-Op & Regeneracija)
// u JEDAN fajl, jer sve ovo čini isti logički celina: KATALOG USLUGA
// (kategorije + tagovi + 14 usluga) za domain "service". Sadržaj (opisi,
// FAQ, SEO keywords, cene, comparisonTable) je 1:1 preuzet iz ta dva fajla
// bez izmena - ovo je čisto strukturna konsolidacija, provereno protiv
// stvarnog exporta baze (test_services.json/test_categories.json/
// test_tags.json, avgust 2026.) da se sadržaj poklapa sa onim što je
// trenutno live.
//
// PAKETI (Package model - "5/10 tretmana" bundlovi i "premium" kombinacije
// dve usluge) su namerno u ODVOJENOM fajlu: service-packages.seed.js. Taj
// fajl zavisi od ovog (traži usluge/varijante po slugu), pa ga pokreni POSLE
// ovog seed-a.
//
// STARI fajlovi (esma-catalog.seed.js, esma-masaza-protokoli.seed.js) i
// njihovi runneri (run-esma-seed.js, run-esma-masaza-protokoli.seed.js) se
// mogu obrisati iz repo-a - ovaj fajl je njihova potpuna zamena.
// ---------------------------------------------------------------------------

// Koji deljeni fizički resurs(i) svaka usluga zauzima (Service.resources) -
// ESMA usluge zauzimaju sto za ESMA/uređaje, ručne masaže zauzimaju sto za
// masažu, a 4 hibridna protokola (jedna seansa koja koristi OBA) zauzimaju
// OBA stola za CEO termin, jer model resursa ne podržava "prva 2/3 termina
// resurs A, poslednja 1/3 resurs B" - rezervacija je uvek pun blok vremena.
const SERVICE_RESOURCE_MAP = {
  "teslatone-24": [RESOURCE_ESMA_TABLE_ID],
  "aquadrain-360": [RESOURCE_ESMA_TABLE_ID],
  "lipolise-russianmax": [RESOURCE_ESMA_TABLE_ID],
  "triactive-celluerase": [RESOURCE_ESMA_TABLE_ID],
  "lasersonic-face-sculpt": [RESOURCE_ESMA_TABLE_ID],
  "medicinski-bioreset": [RESOURCE_ESMA_TABLE_ID],
  "relaks-masaza": [RESOURCE_MASSAGE_TABLE_ID],
  "sportska-masaza": [RESOURCE_MASSAGE_TABLE_ID],
  "terapeutska-masaza": [RESOURCE_MASSAGE_TABLE_ID],
  "anticelulit-masaza": [RESOURCE_MASSAGE_TABLE_ID],
  "full-body-contouring-3u1": [RESOURCE_ESMA_TABLE_ID, RESOURCE_MASSAGE_TABLE_ID],
  "anticelulit-tightening-kombo": [RESOURCE_ESMA_TABLE_ID, RESOURCE_MASSAGE_TABLE_ID],
  "fizio-express-back-relief": [RESOURCE_ESMA_TABLE_ID, RESOURCE_MASSAGE_TABLE_ID],
  "post-op-regeneracija": [RESOURCE_ESMA_TABLE_ID, RESOURCE_MASSAGE_TABLE_ID],};

// ---------------------------------------------------------------------------
// Kategorije
// ---------------------------------------------------------------------------

const topLevelCategories = [
  {
    slug: "masaze",
    name: "Masaže",
    shortDescription: "Klasične ručne masaže - opuštanje, antistres, sport, terapeutska masaža i anticelulit tretmani.",
  },
  {
    slug: "struja",
    name: "Struja",
    shortDescription: "Tretmani zasnovani na električnoj stimulaciji - miostimulacija, mikrostrujna terapija, limfna drenaža strujom.",
  },
  {
    slug: "esma",
    name: "ESMA",
    shortDescription: "Tretmani na profesionalnom fizioterapeutskom aparatu ESMA Favorit, koji u jednom uređaju kombinuje miostimulaciju, limfnu drenažu, mikrostrujnu terapiju, ultrazvuk i svetlosnu (laser) terapiju.",
  },];

const childCategories = [
  {
    slug: "laser",
    name: "Laser",
    parentSlug: "esma",
    shortDescription: "Svetlosna (laserska) biostimulacija i regeneracija kože na ESMA Favorit aparatu.",
  },
  {
    slug: "ultrazvuk",
    name: "Ultrazvuk",
    parentSlug: "esma",
    shortDescription: "Ultrazvučni piling, ultrafonoforeza i ultrazvučna kavitacija na ESMA Favorit aparatu.",
  },];

// ---------------------------------------------------------------------------
// Tagovi
// ---------------------------------------------------------------------------

const tagDefs = [
  // Tagovi referencirani u tagSlugs 6 ESMA usluga (tesla-tone-24,
  // aqua-drain-360, lipolise-russian-max, tri-active-cellu-erase,
  // laser-sonic-face-sculpt, medicinski-bio-reset) - moraju postojati
  // ovde ili će upsertServices baciti grešku "nepostojeći tagSlug".
  { slug: "miostimulacija", name: "Miostimulacija" },
  { slug: "tonus-misica", name: "Tonus mišića" },
  { slug: "neurostimulacija", name: "Neurostimulacija" },
  { slug: "interferentne-struje", name: "Interferentne struje" },
  { slug: "limfodrenaza", name: "Limfna drenaža" },
  { slug: "detoksikacija", name: "Detoksikacija" },
  { slug: "anticelulit", name: "Anticelulit" },
  { slug: "elektrolipoliza", name: "Elektrolipoliza" },
  { slug: "ultrazvucni-piling", name: "Ultrazvučni piling" },
  { slug: "mikrostrujna-terapija", name: "Mikrostrujna terapija" },
  { slug: "lifting", name: "Lifting" },
  { slug: "biorevitalizacija", name: "Biorevitalizacija" },
  { slug: "anti-aging", name: "Anti-aging" },
  { slug: "analgezija", name: "Analgezija" },

  // NOVI tagovi (ESMA):
  { slug: "kombinovani-tretmani", name: "Kombinovani tretmani" },
  { slug: "visceralna-lipoliza", name: "Visceralna lipoliza" },
  { slug: "miolifting-lica", name: "Miolifting lica" },
  { slug: "terapija-bola", name: "Terapija bola" },
  { slug: "oporavak-misica", name: "Oporavak mišića" },
  { slug: "zatezanje-koze", name: "Zatezanje kože" },
  { slug: "sjaj-koze", name: "Sjaj kože" },
  { slug: "esma-favorit-beograd", name: "ESMA Favorit Beograd" },
  { slug: "limfna-drenaza-cena", name: "Limfna drenaža cena" },
  { slug: "miostimulacija-iskustva", name: "Miostimulacija iskustva" },
  { slug: "lifting-lica-bez-igala", name: "Lifting lica bez igala" },
  { slug: "ultrazvuk-za-lice", name: "Ultrazvuk za lice" },
  { slug: "laser-za-kozu", name: "Laser za kožu" },
  { slug: "celulit-tretman", name: "Celulit tretman" },
  // NOVI tagovi (masaže):
  { slug: "relaksaciona-masaza", name: "Relaksaciona masaža" },
  { slug: "antistres-masaza", name: "Antistres masaža" },
  { slug: "opustajuca-masaza", name: "Opuštajuća masaža" },
  { slug: "sportska-masaza-tag", name: "Sportska masaža" },
  { slug: "masaza-za-sportiste", name: "Masaža za sportiste" },
  { slug: "terapeutska-masaza-tag", name: "Terapeutska masaža" },
  { slug: "masaza-za-bol-u-ledjima", name: "Masaža za bol u leđima" },
  { slug: "anticelulit-masaza-tag", name: "Anticelulit masaža" },
  { slug: "rucna-masaza", name: "Ručna masaža" },
  { slug: "premium-paket", name: "Premium paket" },
  { slug: "esma-i-masaza", name: "ESMA + masaža" },
  { slug: "esma-i-rucna-masaza-protokol", name: "ESMA + ručna masaža protokol" },
  { slug: "oblikovanje-tela-protokol", name: "Oblikovanje tela protokol" },
  { slug: "fizio-terapeutski-protokol", name: "Fizio-terapeutski protokol" },
  { slug: "post-operativna-nega", name: "Post-operativna nega" },
  { slug: "dekontrakcija-misica", name: "Dekontrakcija mišića" },
  { slug: "leda-i-vrat-tretman", name: "Leđa i vrat tretman" },];

// ---------------------------------------------------------------------------
// Usluge - 14 ukupno:
//   1-6:   ESMA Favorit tretmani (Tesla-Tone 24, Aqua-Drain 360, Lipolise
//          Russian-Max, Tri-Active Cellu-Erase, Laser-Sonic Face Sculpt,
//          Medicinski Bio-Reset)
//   7-10:  Ručne masaže (Relaks, Sportska, Terapeutska, Anticelulit)
//   11-14: Kombinovani ESMA + ručna masaža protokoli, jedna seansa u jednoj
//          poseti (Full Body Contouring 3u1, Anticelulit & Tightening Kombo,
//          Fizio-Express Back Relief, Post-Op & Regeneracija)
// ---------------------------------------------------------------------------

const serviceDefs = [
  // 1. Tesla-Tone 24
  {
    slug: "teslatone-24",
    name: "Tesla‑Tone 24",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["miostimulacija", "tonus-misica", "neurostimulacija", "interferentne-struje", "esma-favorit-beograd", "miostimulacija-iskustva"],
    shortDescription: "Miostimulacija celog tela – jačanje mišića i podizanje tonusa bez napora. ESMA Favorit tretman za atletsku figuru.",
    longDescription:
      "Tesla‑Tone 24 je tretman miostimulacije na ESMA Favorit aparatu koji simulira intenzivan trening za celo telo. Kroz veliki broj nezavisnih kanala, aparat šalje impulse koji izazivaju snažne kontrakcije mišićnih vlakana, uključujući i duboke stabilizatore koje je teško aktivirati klasičnim treningom u teretani. Rezultat je čvršća muskulatura, poboljšano držanje tela i osećaj tonusa – bez znojenja i opterećenja zglobova. Ovaj tretman je pogodan za sve koji žele brži osećaj tonusa mišića, definisane ruke, čvršću zadnjicu i stomak, uz redovnu fizičku aktivnost i zdravu ishranu. Preporučuje se serija od 5 do 10 tretmana. Više o tome kako miostimulacija radi pročitajte na našem blogu: beautymedica.rs/blog/sta-je-miostimulacija-kako-deluje.",
    defaultDuration: 45,
    image: { img: "https://placehold.co/800x600?text=Tesla-Tone%2024", imgDesc: "Tesla-Tone 24 - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["tesla tone 24", "miostimulacija novi sad", "esma favorit miostimulacija", "tonus misica bez treninga"],
    features: [
      { name: "💪 Simulacija treninga", description: "Kontrakcija mišićnih vlakana bez znojenja i intenzivne upale mišića.", icon: "bi bi-lightning-charge", order: 1 },
      { name: "🎯 Duboki stabilizatori", description: "Cilja i mišiće koje je teško aktivirati klasičnim vežbanjem u teretani.", icon: "bi bi-bullseye", order: 2 },
      { name: "🧘 Atletski izgled", description: "Čvršći mišići i poboljšano držanje tela.", icon: "bi bi-emoji-smile", order: 3 },
      { name: "⏱️ Vidljivi rezultati", description: "Efekti se primećuju već nakon nekoliko tretmana, bez rizika od povreda.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (45 min)",
        slug: "jedan-tretman-45-min",
        sessions: 1,
        duration: 45,
        totalPrice: 3500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Da li miostimulacija boli?", answer: "Osećaj je prijatna mišićna kontrakcija i trnci, nikako bol. Intenzitet se podešava individualno prema tvom pragu tolerancije.", order: 1 },
      { question: "Koliko često treba raditi miostimulaciju?", answer: "Preporučuje se 2-3 puta nedeljno. Za vidljive rezultate potrebno je 5-10 tretmana.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, epilepsijom, akutnim upalama kože ili malignim oboljenjima. Pre zakazivanja obavezno se konsultuj sa terapeutom.", order: 3 },
      { question: "Da li je isplativije kupiti paket tretmana?", answer: "Da - paket od 5 tretmana nosi 10% popusta, a paket od 10 tretmana 20% popusta u odnosu na pojedinačnu cenu tretmana.", order: 4 },
    ],
    comparisonColumns: ["Tesla-Tone 24", "Klasičan trening"],
    comparisonTable: [
      { label: "Vreme trajanja", values: ["45 min", "60+ min"] },
      { label: "Opterećenje zglobova", values: ["Bez opterećenja", "Visoko"] },
      { label: "Rizik od povreda", values: ["Bez rizika", "Povećan"] },
      { label: "Znojenje", values: ["Bez znojenja", "Intenzivno"] },
      { label: "Potreban napor klijenta", values: ["Minimalan - ležite dok aparat radi", "Aktivno fizičko angažovanje"] },
    ],
  },
  // 2. Aqua-Drain 360
  {
    slug: "aquadrain-360",
    name: "Aqua‑Drain 360",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["limfodrenaza", "detoksikacija", "anticelulit", "limfna-drenaza-cena", "esma-favorit-beograd"],
    shortDescription: "Limfna drenaža celog tela – detoksikacija, uklanjanje viška vode i celulita. ESMA Favorit tretman za lagane noge.",
    longDescription:
      "Aqua‑Drain 360 je limfna drenaža na ESMA Favorit aparatu. Kroz veliki broj mikro-strujnih kanala kreira se ritmični talasni pritisak koji nežno potiskuje nakupljenu tečnost iz tkiva ka limfnim čvorovima, podstičući cirkulaciju i izbacivanje viška tečnosti. Ovaj tretman je pogodan za osobe sa sindromom „teških nogu“, oticanjem, zadržavanjem vode, kao i za regeneraciju nakon napornih treninga. Rezultat je olakšanje, smanjenje obima usled izbačene tečnosti i osećaj svežije kože. Preporučuje se serija od 5 do 10 tretmana. Kako limfni sistem radi i zašto ponekad zaostaje pročitajte na našem blogu: beautymedica.rs/blog/limfna-drenaza-cena-efekti.",
    defaultDuration: 45,
    image: { img: "https://placehold.co/800x600?text=Aqua-Drain%20360", imgDesc: "Aqua-Drain 360 - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["aqua drain 360", "limfna drenaza novi sad", "esma favorit limfna drenaza", "detoksikacija tretman"],
    features: [
      { name: "💧 Limfni reset", description: "Ritmični talasi potiskuju tečnost iz tkiva i smanjuju otoke.", icon: "bi bi-droplet", order: 1 },
      { name: "🧹 Podsticanje cirkulacije", description: "Ubrzava cirkulaciju i pomaže izbacivanju viška tečnosti iz organizma.", icon: "bi bi-arrow-repeat", order: 2 },
      { name: "🦵 Olakšanje nogu", description: "Smanjuje oticanje i sindrom teških, umornih nogu.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "✨ Svežija koža", description: "Poboljšava ten i osećaj kože nakon tretmana.", icon: "bi bi-stars", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (45 min)",
        slug: "jedan-tretman-45-min",
        sessions: 1,
        duration: 45,
        totalPrice: 3500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Šta je limfna drenaža i kako deluje?", answer: "Limfna drenaža je tretman koji stimulacijom limfnog sistema pomaže u uklanjanju viška tečnosti i podstiče cirkulaciju, smanjujući otoke i osećaj težine u nogama.", order: 1 },
      { question: "Koliko traje tretman limfne drenaže?", answer: "Jedan tretman traje 45 minuta, a preporučuje se serija od 5 do 10 tretmana za optimalne rezultate.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje osobama sa trombozom dubokih vena, srčanim oboljenjima, trudnicama ili osobama sa pejsmejkerom bez prethodne konsultacije sa lekarom.", order: 3 },
      { question: "Da li paket od 5 ili 10 tretmana ušteđuje novac?", answer: "Da - paket od 5 tretmana nosi 10% popusta, a paket od 10 tretmana 20% popusta u odnosu na pojedinačnu cenu.", order: 4 },
    ],
    comparisonColumns: ["Aqua-Drain 360", "Ručna limfna drenaža"],
    comparisonTable: [
      { label: "Trajanje tretmana", values: ["45 min", "60 min"] },
      { label: "Intenzitet", values: ["Kontrolisan, precizan", "Zavisi od terapeuta"] },
      { label: "Pokrivenost tela", values: ["Celo telo", "Obično parcijalno"] },
      { label: "Kombinovanje sa drugim modalitetima", values: ["Lako u istoj ESMA seansi", "Zahteva odvojenu posetu"] },
    ],
  },
  // 3. Lipolise Russian-Max
  {
    slug: "lipolise-russianmax",
    name: "Lipolise Russian‑Max",
    categorySlugs: ["esma", "struja"],
    tagSlugs: ["elektrolipoliza", "anticelulit", "visceralna-lipoliza", "esma-favorit-beograd", "celulit-tretman"],
    shortDescription: "Elektrolipoliza – rad na masnim naslagama i celulitu. ESMA Favorit tretman za oblikovanje tela.",
    longDescription:
      "Lipolise Russian‑Max je tretman elektrolipolize na ESMA Favorit aparatu. Struje deluju na masne ćelije (adipocite) u tretiranoj zoni, podstičući oslobađanje masnih naslaga koje se dalje prirodno metabolišu i izbacuju putem limfnog sistema. Ovaj tretman je pogodan za klijente sa lokalizovanim masnim naslagama na stomaku, bokovima i jahaćim pantalonama, kao i za tvrdokorni celulit. Rezultat je postepeno smanjenje obima na tretiranim zonama i utisak glađe kože. Preporučuje se serija od 5 do 10 tretmana, uz zdravu ishranu i fizičku aktivnost za najbolje i dugotrajnije rezultate. Pogledajte i naš tekst o anticelulit tretmanima na blogu: beautymedica.rs/blog/anticelulit-tretmani-celulit.",
    defaultDuration: 45,
    image: { img: "https://placehold.co/800x600?text=Lipolise%20Russian-Max", imgDesc: "Lipolise Russian-Max - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["lipolise russian max", "elektrolipoliza novi sad", "masne naslage tretman", "celulit tretman esma"],
    features: [
      { name: "🔥 Deluje na masne ćelije", description: "Struja podstiče oslobađanje masnih naslaga u tretiranoj zoni.", icon: "bi bi-water", order: 1 },
      { name: "🎯 Lokalizovane zone", description: "Fokus na stomak, bokove, butine i jahaće pantalone.", icon: "bi bi-bullseye", order: 2 },
      { name: "🧴 Utisak glađe kože", description: "Doprinosi boljoj teksturi kože i smanjenju izgleda celulita.", icon: "bi bi-stars", order: 3 },
      { name: "📉 Smanjenje obima", description: "Postepeno smanjenje obima na tretiranim zonama tokom serije tretmana.", icon: "bi bi-rulers", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (45 min)",
        slug: "jedan-tretman-45-min",
        sessions: 1,
        duration: 45,
        totalPrice: 4000,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Kako funkcioniše elektrolipoliza?", answer: "Elektrolipoliza koristi električne impulse koji deluju na masne ćelije u tretiranoj zoni, dok se oslobođena mast dalje prirodno metaboliše. Tretman je bezbolan i neinvazivan.", order: 1 },
      { question: "Koliko tretmana je potrebno za rezultate?", answer: "Za vidljive rezultate preporučuje se 5-10 tretmana, u zavisnosti od individualnih ciljeva i stanja.", order: 2 },
      { question: "Da li se rezultati zadržavaju?", answer: "Uz zdravu ishranu i fizičku aktivnost nakon tretmana, rezultati su dugotrajni – tretman značajno smanjuje zapreminu masnih naslaga u tretiranoj zoni.", order: 3 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, malignim oboljenjima ili akutnim upalama u tretiranoj zoni. Obavezna je konsultacija sa terapeutom pre zakazivanja.", order: 4 },
      { question: "Da li paket od 5 ili 10 tretmana ušteđuje novac?", answer: "Da - paket od 5 tretmana nosi 10% popusta, a paket od 10 tretmana 20% popusta u odnosu na pojedinačnu cenu.", order: 5 },
    ],
    comparisonColumns: ["Lipolise Russian-Max", "Klasična dijeta"],
    comparisonTable: [
      { label: "Vreme do rezultata", values: ["Nekoliko nedelja", "Meseci"] },
      { label: "Ciljano delovanje", values: ["Da, lokalizovano", "Ne"] },
      { label: "Bez napora", values: ["Da", "Ne"] },
    ],
  },
  // 4. Tri-Active Cellu-Erase (kombinovani)
  {
    slug: "triactive-celluerase",
    name: "Tri‑Active Cellu‑Erase",
    categorySlugs: ["esma", "ultrazvuk", "laser"],
    tagSlugs: ["kombinovani-tretmani", "anticelulit", "limfodrenaza", "ultrazvucni-piling", "zatezanje-koze", "celulit-tretman", "esma-favorit-beograd"],
    shortDescription: "Ultrazvuk + struja + svetlosna terapija – kombinovani tretman za celulit i masne naslage. ESMA Favorit tretman za zatezanje kože.",
    longDescription:
      "Tri‑Active Cellu‑Erase je kombinovani tretman na ESMA Favorit aparatu koji u jednoj proceduri objedinjuje tri tehnologije: ultrazvuk, interferentnu struju i svetlosnu (lasersku) terapiju. Tretman započinje ultrazvukom koji radi mikromasažu tkiva i priprema zonu za dalju obradu. Zatim se uključuje interferentna struja (elektrolipoliza) koja deluje na masne naslage kroz veliki broj nezavisnih kanala. Tretman se završava svetlosnom terapijom koja podstiče lokalnu cirkulaciju i doprinosi osećaju zategnutije kože na tretiranoj regiji. Pogodno za klijente sa dugotrajnim celulitom na bedrima i tvrdokornim masnim naslagama na stomaku. Preporučuje se serija od 5 do 10 tretmana. Pročitajte i naš tekst o anticelulit tretmanima: beautymedica.rs/blog/anticelulit-tretmani-celulit.",
    defaultDuration: 75,
    image: { img: "https://placehold.co/800x600?text=Tri-Active%20Cellu-Erase", imgDesc: "Tri-Active Cellu-Erase - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["tri active cellu erase", "kombinovani anticelulit tretman", "celulit tvrdokorni tretman novi sad"],
    features: [
      { name: "🌊 Ultrazvučna mikromasaža", description: "Priprema tkivo i tvrđi, fibrozni celulit za dalju obradu.", icon: "bi bi-water", order: 1 },
      { name: "⚡ Elektrolipoliza strujom", description: "Deluje na masne naslage kroz veliki broj nezavisnih kanala.", icon: "bi bi-lightning-charge", order: 2 },
      { name: "☀️ Svetlosna terapija", description: "Podstiče cirkulaciju i doprinosi osećaju zategnutije kože.", icon: "bi bi-sun", order: 3 },
      { name: "🔄 Sinergijski efekat", description: "Tri tehnologije deluju zajedno u okviru jedne procedure.", icon: "bi bi-arrow-repeat", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (75 min)",
        slug: "jedan-tretman-75-min",
        sessions: 1,
        duration: 75,
        totalPrice: 5500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Šta je kombinovani tretman i zašto se koristi?", answer: "Kombinovani tretman u jednoj proceduri koristi ultrazvuk, struju i svetlosnu terapiju, tako da svaka tehnologija dopunjuje efekat druge u okviru iste posete.", order: 1 },
      { question: "Koliko traje jedan tretman?", answer: "Jedan tretman traje 75 minuta, a preporučuje se serija od 5 do 10 tretmana za optimalne rezultate.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, malignim oboljenjima, akutnim upalama kože ili trombozom. Obavezna je prethodna konsultacija sa terapeutom.", order: 3 },
      { question: "Da li je ovo najsveobuhvatniji tretman za celulit u vašoj ponudi?", answer: "Da, kombinuje tri tehnologije u jednoj proceduri i najčešće se preporučuje za dugotrajan i tvrdokoran celulit, u odnosu na pojedinačne pristupe poput anticelulit masaže ili elektrolipolize.", order: 4 },
    ],
    comparisonColumns: ["Tri-Active Cellu-Erase", "Klasičan anticelulit tretman"],
    comparisonTable: [
      { label: "Tehnologije", values: ["Ultrazvuk + Struja + Svetlosna terapija", "Samo masaža"] },
      { label: "Trajanje", values: ["75 min", "60 min"] },
      { label: "Broj tretmana za rezultat", values: ["5-10", "10-15"] },
    ],
  },
  // 5. Laser-Sonic Face Sculpt (kombinovani za lice)
  {
    slug: "lasersonic-face-sculpt",
    name: "Laser‑Sonic Face Sculpt",
    categorySlugs: ["esma", "laser"],
    tagSlugs: ["mikrostrujna-terapija", "lifting", "miolifting-lica", "biorevitalizacija", "anti-aging", "sjaj-koze", "lifting-lica-bez-igala", "esma-favorit-beograd"],
    shortDescription: "Lifting lica bez igala – mikrostruje + ultrazvuk + svetlosna terapija za osećaj zategnutosti i sjaj kože. ESMA Favorit tretman.",
    longDescription:
      "Laser‑Sonic Face Sculpt je neinvazivni tretman za lice na ESMA Favorit aparatu koji kombinuje mikrostruje, ultrazvuk i svetlosnu (lasersku) terapiju, bez igala i bez perioda oporavka. Mikrostruje rade nežan miolifting lica – podstiču tonus mišića obraza i podbratka. Ultrazvučna fonoforeza pomaže unosu kozmetičkih aktivnih sastojaka (npr. hijaluron, vitamini) u kožu. Svetlosna terapija na kraju umiruje kožu i podstiče osećaj svežine i sjaja. Rezultat je vidljiv odmah nakon tretmana – zategnutije konture, svež ten i blistaviji izgled kože. Preporučuje se serija od 5 do 10 tretmana za dugotrajniji efekat. Više o mikrostrujnom liftingu pročitajte na blogu: beautymedica.rs/blog/lifting-lica-bez-igala.",
    defaultDuration: 45,
    image: { img: "https://placehold.co/800x600?text=Laser-Sonic%20Face%20Sculpt", imgDesc: "Laser-Sonic Face Sculpt - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["laser sonic face sculpt", "lifting lica bez igala", "mikrostrujni lifting novi sad", "nehirurski lifting lica"],
    features: [
      { name: "😊 Miolifting lica", description: "Podstiče tonus mišića obraza i podbratka.", icon: "bi bi-emoji-smile", order: 1 },
      { name: "💧 Ultrazvučna fonoforeza", description: "Pomaže unosu kozmetičkih aktivnih sastojaka u kožu, bez igala.", icon: "bi bi-droplet", order: 2 },
      { name: "✨ Svetlosna terapija", description: "Umiruje kožu i doprinosi osećaju svežine i sjaja.", icon: "bi bi-stars", order: 3 },
      { name: "🚫 Bez igala i bola", description: "Neinvazivan tretman bez perioda oporavka.", icon: "bi bi-shield-check", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (45 min)",
        slug: "jedan-tretman-45-min",
        sessions: 1,
        duration: 45,
        totalPrice: 4500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Da li lifting lica bez igala zaista deluje?", answer: "Mikrostruje podstiču tonus mišića lica, ultrazvuk pomaže unosu aktivnih sastojaka, a svetlosna terapija doprinosi osećaju svežine kože – efekat je vidljiv odmah, a za dugotrajniji rezultat preporučuje se serija tretmana.", order: 1 },
      { question: "Koliko traje jedan tretman lica?", answer: "Tretman traje 45 minuta i neinvazivan je. Preporučuje se 5-10 tretmana za optimalne rezultate.", order: 2 },
      { question: "Da li postoji period oporavka?", answer: "Ne, tretman je neinvazivan i nema period oporavka. Odmah nakon tretmana možeš se vratiti svakodnevnim aktivnostima.", order: 3 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, akutnim kožnim infekcijama u predelu lica ili neposredno nakon estetskih injekcionih tretmana (botoks, fileri) bez prethodne konsultacije.", order: 4 },
      { question: "Da li nudite i tretmane fokusiranim ultrazvukom (HIFU)?", answer: "Trenutno ne radimo na namenskom HIFU aparatu - Laser-Sonic Face Sculpt je naša alternativa za neinvazivni lifting lica, sa drugačijom ali srodnom kombinacijom tehnologija.", order: 5 },
    ],
    comparisonColumns: ["Laser-Sonic Face Sculpt", "Botox / Fileri"],
    comparisonTable: [
      { label: "Invazivnost", values: ["Neinvazivan", "Invazivan (igle)"] },
      { label: "Period oporavka", values: ["Bez oporavka", "Nekoliko dana"] },
      { label: "Cena", values: ["Pristupačnija", "Visoka"] },
    ],
  },
  // 6. Medicinski Bio-Reset (kombinovani za terapiju bola)
  {
    slug: "medicinski-bioreset",
    name: "Medicinski Bio‑Reset",
    categorySlugs: ["esma", "struja", "ultrazvuk"],
    tagSlugs: ["analgezija", "terapija-bola", "oporavak-misica", "ultrazvucni-piling", "esma-favorit-beograd"],
    shortDescription: "Fizikalna terapija za bolove u leđima, vratu i zglobovima – interferentne struje + ultrazvuk + svetlosna terapija. ESMA Favorit.",
    longDescription:
      "Medicinski Bio‑Reset je fizikalni tretman na ESMA Favorit aparatu koji kombinuje interferentne struje, ultrazvuk i svetlosnu terapiju radi ublažavanja bolova i mišićne napetosti. Interferentne struje deluju na zglob ili mišić i mogu doprineti smanjenju osećaja bola i mišićnog spazma. Ultrazvuk se koristi za mikromasažu tkiva, dok svetlosna terapija podstiče lokalnu cirkulaciju. Tretman je namenjen sportistima i osobama sa bolovima u leđima, vratu ili nakon manjih povreda zglobova, kao dopuna – ne zamena – redovnoj fizikalnoj terapiji i lekarskom tretmanu. Preporučuje se serija od 5 do 10 tretmana.",
    defaultDuration: 45,
    image: { img: "https://placehold.co/800x600?text=Medicinski%20Bio-Reset", imgDesc: "Medicinski Bio-Reset - privremena placeholder slika, zameniti pravom fotografijom" },
    seoKeywords: ["medicinski bio reset", "fizikalna terapija novi sad", "terapija bola esma", "oporavak misica sportisti"],
    features: [
      { name: "💊 Ublažavanje bola", description: "Interferentne struje mogu doprineti smanjenju osećaja bola i mišićnog spazma.", icon: "bi bi-heart-pulse", order: 1 },
      { name: "🛡️ Podrška cirkulaciji", description: "Ultrazvuk radi mikromasažu tkiva u zoni bola.", icon: "bi bi-water", order: 2 },
      { name: "⚡ Svetlosna terapija", description: "Podstiče lokalnu cirkulaciju u tretiranoj zoni.", icon: "bi bi-sun", order: 3 },
      { name: "🏃 Dopuna oporavku", description: "Koristan dodatak fizikalnoj terapiji za sportiste i rekreativce.", icon: "bi bi-activity", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (45 min)",
        slug: "jedan-tretman-45-min",
        sessions: 1,
        duration: 45,
        totalPrice: 4500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      { question: "Da li ovaj tretman leči bol u leđima?", answer: "Tretman može doprineti smanjenju mišićne napetosti i osećaja bola, ali ne predstavlja medicinsko lečenje niti zamenu za pregled lekara ili fizijatra. Kod jakog ili dugotrajnog bola obavezno se prvo obratite lekaru.", order: 1 },
      { question: "Da li je tretman bezbedan za sportiste?", answer: "Da, tretman je neinvazivan i često se koristi kao dodatak rehabilitacionim programima kod sportista, uz prethodnu procenu terapeuta.", order: 2 },
      { question: "Koliko tretmana je potrebno kod hroničnih bolova?", answer: "Za hronične tegobe preporučuje se serija od 5 do 10 tretmana, u zavisnosti od stanja i preporuke terapeuta.", order: 3 },
      { question: "Ko ne bi trebalo da radi ovaj tretman?", answer: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, akutnim upalama, malignim oboljenjima ili neposredno nakon operacije, bez prethodne konsultacije sa lekarom.", order: 4 },
      { question: "Da li se ovaj tretman kombinuje sa sportskom masažom?", answer: "Da, terapeut može predložiti kombinaciju Medicinski Bio-Reset tretmana i sportske masaže za sveobuhvatniju podršku oporavku.", order: 5 },
    ],
    comparisonColumns: ["Medicinski Bio-Reset", "Klasična fizikalna terapija"],
    comparisonTable: [
      { label: "Tehnologije", values: ["Struja + Ultrazvuk + Svetlosna terapija", "Obično samo struja"] },
      { label: "Trajanje tretmana", values: ["45 min", "30-45 min"] },
      { label: "Broj tretmana", values: ["5-10", "10-15"] },
    ],
  },

  // ---------------------------------------------------------------------------
  // Usluge – Ručne masaže (novo)
  // Svaka masaža ima dve varijante: 30 min (gornji ili donji deo tela) i
  // 60 min (celo telo). Ove usluge NE dobijaju automatske pakete od 5/10
  // tretmana (skipBundlePackages: true) jer se prodaju pojedinačno.
  // ---------------------------------------------------------------------------

  // 7. Relaks masaža
  {
    slug: "relaks-masaza",
    name: "Relaks masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["relaksaciona-masaza", "antistres-masaza", "opustajuca-masaza", "rucna-masaza"],
    shortDescription: "Klasična opuštajuća masaža koja smanjuje stres i mišićnu napetost. Bira se 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
    longDescription:
      "Relaks masaža je klasična ručna masaža blagim, ritmičnim pokretima namenjena opštem opuštanju tela i uma. Tretman pomaže u smanjenju napetosti u mišićima nastale usled stresa, dugog sedenja ili svakodnevnog fizičkog opterećenja, i podstiče lokalnu cirkulaciju krvi. Redovna relaks masaža može doprineti boljem kvalitetu sna i opštem osećaju odmornosti. Varijanta od 30 minuta obuhvata gornji (vrat, ramena, leđa, ruke) ili donji deo tela (noge, stopala, donji deo leđa) po izboru klijenta, dok varijanta od 60 minuta obuhvata masažu celog tela. Za poređenje sa aparaturnim tretmanima pogledajte i naš tekst: beautymedica.rs/blog/masaza-vs-aparaturni-tretmani.",
    defaultDuration: 60,
    image: { img: "https://placehold.co/800x600?text=Relaks%20masaza", imgDesc: "Relaks masaza - privremena placeholder slika, zameniti pravom fotografijom" },
    skipBundlePackages: true,
    seoKeywords: ["relaks masaza novi sad", "antistres masaza", "opustajuca masaza", "masaza za opustanje"],
    features: [
      { name: "🌿 Smanjenje stresa", description: "Blagi, ritmični pokreti podstiču opuštanje nervnog sistema.", icon: "bi bi-flower1", order: 1 },
      { name: "💤 Bolji kvalitet sna", description: "Redovna masaža može doprineti boljem odmoru i opuštanju.", icon: "bi bi-moon-stars", order: 2 },
      { name: "🩸 Podsticanje cirkulacije", description: "Blag pritisak podstiče protok krvi kroz mišiće i kožu.", icon: "bi bi-droplet", order: 3 },
      { name: "🕐 Fleksibilno trajanje", description: "30 minuta za ciljanu zonu ili 60 minuta za celo telo.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      { name: "30 min (gornji ili donji deo tela)", slug: "30-min-gornji-ili-donji-deo-tela", sessions: 1, duration: 30, totalPrice: 2500, order: 1, isBest: false },
      { name: "60 min (celo telo)", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4300, order: 2, isBest: true },
    ],
    faq: [
      { question: "Koja je razlika između 30 i 60 minuta masaže?", answer: "Varijanta od 30 minuta obuhvata gornji ili donji deo tela po vašem izboru, dok varijanta od 60 minuta obuhvata masažu celog tela.", order: 1 },
      { question: "Da li relaks masaža boli?", answer: "Ne. Relaks masaža se izvodi blagim, ravnomernim pritiskom i namenjena je isključivo opuštanju, bez agresivnog rada na dubokim slojevima mišića.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovu masažu?", answer: "Masaža se ne preporučuje osobama sa povišenom telesnom temperaturom, akutnim upalama kože, trombozom dubokih vena ili neposredno nakon hirurških zahvata. Kod trudnoće ili hroničnih oboljenja obavezna je prethodna konsultacija sa terapeutom.", order: 3 },
      { question: "Po čemu se razlikuje od terapeutske ili sportske masaže?", answer: "Relaks masaža je najblaža po intenzitetu i fokusirana na opuštanje - terapeutska masaža cilja hroničnu napetost i bol, a sportska je namenjena pripremi i oporavku sportista.", order: 4 },
    ],
    comparisonColumns: ["Relaks masaža", "Terapeutska masaža", "Sportska masaža"],
    comparisonTable: [
      { label: "Glavni cilj", values: ["Opuštanje i smanjenje stresa", "Ublažavanje hronične napetosti i bola", "Priprema i oporavak posle fizičke aktivnosti"] },
      { label: "Intenzitet pritiska", values: ["Blag, ravnomeran", "Ciljano dubinski", "Jači, ciljan na opterećene mišiće"] },
    ],
  },

  // 8. Sportska masaža
  {
    slug: "sportska-masaza",
    name: "Sportska masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["sportska-masaza-tag", "masaza-za-sportiste", "oporavak-misica", "rucna-masaza"],
    shortDescription: "Masaža prilagođena sportistima i rekreativcima – priprema mišiće pre napora i pomaže oporavku nakon treninga.",
    longDescription:
      "Sportska masaža koristi dublje, ciljane tehnike (gnječenje, kompresija, istezanje) prilagođene fizički aktivnim osobama. Masaža pre treninga može pomoći u pripremi mišića i poboljšanju fleksibilnosti, dok masaža nakon napora pomaže u smanjenju osećaja ukočenosti i zamora, podržavajući oporavak. Sportska masaža je pogodna i za rekreativce i za sportiste, kao deo redovne pripreme ili oporavka. Varijanta od 30 minuta pokriva gornji ili donji deo tela (npr. samo noge nakon trčanja), dok varijanta od 60 minuta obuhvata celo telo. Za poređenje sa drugim tipovima masaže pogledajte i naš blog: beautymedica.rs/blog/masaza-vs-aparaturni-tretmani.",
    defaultDuration: 60,
    image: { img: "https://placehold.co/800x600?text=Sportska%20masaza", imgDesc: "Sportska masaza - privremena placeholder slika, zameniti pravom fotografijom" },
    skipBundlePackages: true,
    seoKeywords: ["sportska masaza novi sad", "masaza za sportiste", "masaza za oporavak misica"],
    features: [
      { name: "🏃 Priprema pre treninga", description: "Podstiče protok krvi u mišiće i doprinosi boljoj fleksibilnosti.", icon: "bi bi-activity", order: 1 },
      { name: "🔄 Podrška oporavku", description: "Pomaže u smanjenju osećaja ukočenosti i zamora nakon napora.", icon: "bi bi-arrow-repeat", order: 2 },
      { name: "💪 Ciljani rad na mišićima", description: "Fokus na grupe mišića koje su najviše opterećene treningom.", icon: "bi bi-bullseye", order: 3 },
      { name: "🕐 30 ili 60 minuta", description: "Birajte prema tome koliko vremena imate i šta vam je potrebno.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      { name: "30 min (gornji ili donji deo tela)", slug: "30-min-gornji-ili-donji-deo-tela", sessions: 1, duration: 30, totalPrice: 2800, order: 1, isBest: false },
      { name: "60 min (celo telo)", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4700, order: 2, isBest: true },
    ],
    faq: [
      { question: "Kada je najbolje zakazati sportsku masažu?", answer: "Masaža pre treninga može pomoći u pripremi mišića, dok masaža 12-24h nakon intenzivnog napora najviše doprinosi oporavku.", order: 1 },
      { question: "Da li sportska masaža boli?", answer: "Pritisak je jači nego kod klasične relaks masaže, ali se intenzitet prilagođava individualnom pragu tolerancije klijenta.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovu masažu?", answer: "Masaža se ne preporučuje kod akutnih povreda mišića ili ligamenata, upala, povišene telesne temperature ili neposredno nakon operacije. Kod akutne povrede prvo se obratite lekaru.", order: 3 },
      { question: "Da li se kombinuje sa Medicinski Bio-Reset tretmanom?", answer: "Da, terapeut može predložiti kombinaciju sportske masaže i Medicinski Bio-Reset tretmana za sveobuhvatniju podršku oporavku.", order: 4 },
    ],
    comparisonColumns: ["Sportska masaža", "Relaks masaža", "Terapeutska masaža"],
    comparisonTable: [
      { label: "Glavni cilj", values: ["Priprema i oporavak posle fizičke aktivnosti", "Opuštanje i smanjenje stresa", "Ublažavanje hronične napetosti i bola"] },
      { label: "Intenzitet pritiska", values: ["Jači, ciljan na opterećene mišiće", "Blag, ravnomeran", "Ciljano dubinski"] },
    ],
  },

  // 9. Terapeutska masaža
  {
    slug: "terapeutska-masaza",
    name: "Terapeutska masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["terapeutska-masaza-tag", "masaza-za-bol-u-ledjima", "terapija-bola", "rucna-masaza"],
    shortDescription: "Ciljana masaža za hroničnu napetost, mišićne čvoriće i tegobe nastale usled dugog sedenja ili lošeg držanja tela.",
    longDescription:
      "Terapeutska masaža koristi tehnike dubinskog rada na mišićima i rad na zategnutim zonama radi ublažavanja hronične napetosti u vratu, ramenima i leđima, kao i posledica dugotrajnog sedenja i lošeg držanja tela. Terapeut identifikuje zategnute zone i mišićne čvoriće i radi na njihovom postepenom otpuštanju kroz kombinaciju pritiska i istezanja. Ovaj tretman može biti koristan dodatak fizikalnoj terapiji, ali je ne zamenjuje niti predstavlja medicinsko lečenje. Dostupna je varijanta od 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo). Pogledajte i naš tekst o izboru između masaže i aparaturnih tretmana: beautymedica.rs/blog/masaza-vs-aparaturni-tretmani.",
    defaultDuration: 60,
    image: { img: "https://placehold.co/800x600?text=Terapeutska%20masaza", imgDesc: "Terapeutska masaza - privremena placeholder slika, zameniti pravom fotografijom" },
    skipBundlePackages: true,
    seoKeywords: ["terapeutska masaza novi sad", "masaza za bol u ledjima", "masaza za napetost u vratu"],
    features: [
      { name: "🎯 Rad na zategnutim zonama", description: "Ciljano otpuštanje zategnutih mišićnih čvorića.", icon: "bi bi-bullseye", order: 1 },
      { name: "🧍 Podrška kod lošeg držanja", description: "Ublažava napetost nastalu usled dugog sedenja.", icon: "bi bi-activity", order: 2 },
      { name: "🩹 Ublažavanje napetosti", description: "Pomaže kod osećaja napetosti u vratu, ramenima i leđima.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "🕐 30 ili 60 minuta", description: "Prilagodite trajanje svojim potrebama.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      { name: "30 min (gornji ili donji deo tela)", slug: "30-min-gornji-ili-donji-deo-tela", sessions: 1, duration: 30, totalPrice: 3000, order: 1, isBest: false },
      { name: "60 min (celo telo)", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 5000, order: 2, isBest: true },
    ],
    faq: [
      { question: "Da li terapeutska masaža leči bol?", answer: "Terapeutska masaža može značajno ublažiti mišićnu napetost i osećaj nelagode nastao usled stresa ili lošeg držanja tela, ali ne predstavlja medicinski tretman niti zamenu za lekarski pregled. Kod jakog ili dugotrajnog bola obavezno se obratite lekaru.", order: 1 },
      { question: "Kome je namenjena?", answer: "Osobama koje provode mnogo vremena sedeći, sportistima sa hroničnom napetošću, kao i svima ko oseća stalnu ukočenost u vratu, ramenima ili leđima.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovu masažu?", answer: "Masaža se ne preporučuje kod akutnih upala, povišene temperature, skorašnje operacije ili akutne diskus hernije bez prethodne konsultacije sa lekarom.", order: 3 },
      { question: "Da li se kombinuje sa Medicinski Bio-Reset tretmanom?", answer: "Da, za hroničnu napetost terapeut može predložiti kombinaciju terapeutske masaže i Medicinski Bio-Reset tretmana u okviru šireg plana.", order: 4 },
    ],
    comparisonColumns: ["Terapeutska masaža", "Relaks masaža", "Sportska masaža"],
    comparisonTable: [
      { label: "Glavni cilj", values: ["Ublažavanje hronične napetosti i bola", "Opuštanje i smanjenje stresa", "Priprema i oporavak posle fizičke aktivnosti"] },
      { label: "Intenzitet pritiska", values: ["Ciljano dubinski", "Blag, ravnomeran", "Jači, ciljan na opterećene mišiće"] },
    ],
  },

  // 10. Anticelulit masaža
  {
    slug: "anticelulit-masaza",
    name: "Anticelulit masaža",
    categorySlugs: ["masaze"],
    tagSlugs: ["anticelulit-masaza-tag", "anticelulit", "limfodrenaza", "celulit-tretman", "rucna-masaza"],
    shortDescription: "Ručna anticelulit masaža koja podstiče lokalnu cirkulaciju i limfnu drenažu, za bolju teksturu kože.",
    longDescription:
      "Anticelulit masaža koristi intenzivnije tehnike gnječenja i rolanja kože u zonama sklonim celulitu – najčešće na butinama, bokovima i stomaku – kako bi podstakla lokalnu cirkulaciju krvi i limfe. Redovni tretmani mogu doprineti boljoj teksturi kože i privremenom poboljšanju izgleda kože sklone celulitu, naročito u kombinaciji sa zdravom ishranom i fizičkom aktivnošću. Važno je napomenuti da ručna masaža ne menja trajno strukturu vezivnog tkiva niti uklanja masne naslage – za izraženiji rad na masnim naslagama pogledajte i naše ESMA tretmane poput Lipolise Russian-Max. Dostupna je varijanta od 30 minuta (gornji ili donji deo tela) i 60 minuta (celo telo).",
    defaultDuration: 60,
    image: { img: "https://placehold.co/800x600?text=Anticelulit%20masaza", imgDesc: "Anticelulit masaza - privremena placeholder slika, zameniti pravom fotografijom" },
    skipBundlePackages: true,
    seoKeywords: ["anticelulit masaza novi sad", "rucna masaza protiv celulita", "masaza za celulit"],
    features: [
      { name: "🤲 Ručna tehnika gnječenja", description: "Intenzivniji pokreti podstiču mikrocirkulaciju u zonama sklonim celulitu.", icon: "bi bi-water", order: 1 },
      { name: "💧 Podsticanje limfne drenaže", description: "Pomaže cirkulaciji limfe u tretiranoj zoni.", icon: "bi bi-droplet", order: 2 },
      { name: "✨ Bolja tekstura kože", description: "Doprinosi utisku glađe i ujednačenije kože.", icon: "bi bi-stars", order: 3 },
      { name: "🕐 30 ili 60 minuta", description: "Birajte ciljanu zonu ili celo telo.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      { name: "30 min (gornji ili donji deo tela)", slug: "30-min-gornji-ili-donji-deo-tela", sessions: 1, duration: 30, totalPrice: 2800, order: 1, isBest: false },
      { name: "60 min (celo telo)", slug: "60-min-celo-telo", sessions: 1, duration: 60, totalPrice: 4700, order: 2, isBest: true },
    ],
    faq: [
      { question: "Da li anticelulit masaža trajno uklanja celulit?", answer: "Ne. Ručna masaža poboljšava cirkulaciju i privremeno poboljšava izgled kože, ali ne menja trajno strukturu vezivnog tkiva. Za izraženije rezultate na masnim naslagama, tretmani poput elektrolipolize (npr. Lipolise Russian-Max) mogu biti efikasniji dodatak.", order: 1 },
      { question: "Koliko često treba raditi anticelulit masažu?", answer: "Za vidljive rezultate preporučuje se serija od najmanje 8-10 tretmana, 1-2 puta nedeljno.", order: 2 },
      { question: "Ko ne bi trebalo da radi ovu masažu?", answer: "Masaža se ne preporučuje trudnicama (posebno u predelu stomaka), osobama sa proširenim venama, trombozom, kožnim infekcijama u tretiranoj zoni ili neposredno nakon operacije.", order: 3 },
      { question: "Koja je razlika između ove masaže i ESMA anticelulit tretmana?", answer: "Anticelulit masaža je ručna tehnika za blaži, postepen pristup, dok Lipolise Russian-Max i Tri-Active Cellu-Erase koriste aparaturu za izraženiji rad na masnim naslagama i tvrdokornom celulitu.", order: 4 },
    ],
    comparisonColumns: ["Anticelulit masaža", "Lipolise Russian-Max", "Tri-Active Cellu-Erase"],
    comparisonTable: [
      { label: "Pristup", values: ["Ručna tehnika", "Elektrolipoliza (struja)", "Ultrazvuk + struja + svetlosna terapija"] },
      { label: "Intenzitet delovanja na masne naslage", values: ["Blag", "Izraženiji", "Najizraženiji"] },
      { label: "Trajanje tretmana", values: ["30-60 min", "45 min", "75 min"] },
    ],
  },

  // ---------------------------------------------------------------------------
  // Usluge - kombinovani ESMA + ručna masaža protokoli (jedna seansa, jedna poseta)
  // ---------------------------------------------------------------------------

  // 1. Full Body Contouring 3u1
  {
    slug: "full-body-contouring-3u1",
    name: "Full Body Contouring 3u1",
    categorySlugs: ["esma", "struja", "ultrazvuk", "masaze"],
    tagSlugs: [
      "kombinovani-tretmani",
      "anticelulit",
      "limfodrenaza",
      "celulit-tretman",
      "rucna-masaza",
      "esma-favorit-beograd",
      "oblikovanje-tela-protokol",
      "esma-i-rucna-masaza-protokol",
    ],
    shortDescription:
      "ESMA struja za celo telo + ciljani ultrazvuk + 30 min ručne limfne drenaže ili anticelulit masaže, sve u jednoj poseti. Kompletno oblikovanje tela u Novom Sadu.",
    longDescription:
      "Full Body Contouring 3u1 je naš najsveobuhvatniji protokol za oblikovanje tela u jednoj poseti - spaja aparaturni i ručni rad u istom terminu, umesto da zahteva dve odvojene posete. Tretman počinje 24-kanalnom ESMA strujom koja radi na tonusu mišića celog tela, nastavlja se ESMA terapijskim ultrazvukom fokusiranim na kritične zone (stomak, bokovi, butine), a završava se sa 30 minuta ručne limfne drenaže ili anticelulit masaže, po proceni terapeuta ili želji klijenta. Aparaturni deo radi na dubljim slojevima (mišićni tonus, masne naslage), dok ručni deo u istom terminu odmah dopunjuje efekat kroz cirkulaciju i limfnu drenažu - bez čekanja na drugi termin. Namenjen je klijentima koji žele efikasan, sveobuhvatan pristup oblikovanju tela uz redovnu fizičku aktivnost i zdravu ishranu za najbolje rezultate. Pogledajte i naš tekst o razlici između ručne masaže i aparaturnih tretmana: beautymedica.rs/blog/masaza-vs-aparaturni-tretmani.",
    defaultDuration: 75,
    image: {
      img: "https://placehold.co/800x600?text=Full%20Body%20Contouring%203u1",
      imgDesc: "Full Body Contouring 3u1 - privremena placeholder slika, zameniti pravom fotografijom",
    },
    seoKeywords: [
      "full body contouring novi sad",
      "esma i masaza u jednoj poseti",
      "oblikovanje tela paket novi sad",
      "kombinovani tretman telo i masaza",
    ],
    features: [
      { name: "⚡ ESMA struja celo telo", description: "24-kanalna struja radi na tonusu mišića celog tela.", icon: "bi bi-lightning-charge", order: 1 },
      { name: "🎯 Ciljani ultrazvuk", description: "ESMA terapijski ultrazvuk fokusiran na kritične zone (stomak, bokovi, butine).", icon: "bi bi-bullseye", order: 2 },
      { name: "💆 Ručna drenaža ili masaža", description: "30 min ručne limfne drenaže ili anticelulit masaže, u istom terminu.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "⏱️ Sve u jednoj poseti", description: "Aparaturni i ručni deo u jednom terminu od 75 minuta, bez dodatnog zakazivanja.", icon: "bi bi-clock-history", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (75 min)",
        slug: "jedan-tretman-75-min",
        sessions: 1,
        duration: 75,
        totalPrice: 6000,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      {
        question: "Po čemu se ovaj protokol razlikuje od ostalih paketa koji kombinuju ESMA i masažu?",
        answer:
          "Kod ostalih premium paketa ESMA tretmani i masaže se zakazuju kao odvojeni termini (npr. 5 ESMA + 3 masaže tokom nekoliko nedelja). Full Body Contouring 3u1 spaja oba dela u JEDAN termin od 75 minuta - aparaturni i ručni rad se rade odmah jedan za drugim, u istoj poseti.",
        order: 1,
      },
      {
        question: "Da li ja biram da li će biti limfna drenaža ili anticelulit masaža?",
        answer:
          "Terapeut na konsultaciji predlaže koja varijanta više odgovara vašem cilju - limfna drenaža za osećaj lakoće i smanjenje zadržavanja tečnosti, anticelulit masaža za rad na teksturi kože. Uzimamo u obzir i vašu želju.",
        order: 2,
      },
      {
        question: "Koliko tretmana je potrebno za vidljive rezultate?",
        answer: "Za primetniju promenu preporučuje se serija od 6 do 10 tretmana - zato nudimo paket od 6 i paket od 10 tretmana po povoljnijoj ceni po tretmanu.",
        order: 3,
      },
      {
        question: "Ko ne bi trebalo da radi ovaj tretman?",
        answer:
          "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, malignim oboljenjima ili akutnim upalama kože, bez prethodne konsultacije sa terapeutom.",
        order: 4,
      },
    ],
    comparisonColumns: ["Full Body Contouring 3u1", "ESMA tretman i masaža u dve posete"],
    comparisonTable: [
      { label: "Broj poseta", values: ["1 poseta (75 min)", "2 odvojene posete"] },
      { label: "Tehnologije", values: ["Struja + Ultrazvuk + Ručna masaža", "Zavisi šta se zakaže"] },
      { label: "Ušteda vremena", values: ["Da - sve u jednom terminu", "Ne - potrebna dva dolaska"] },
    ],
  },

  // 2. Anticelulit & Tightening Kombo
  {
    slug: "anticelulit-tightening-kombo",
    name: "Anticelulit & Tightening Kombo",
    categorySlugs: ["esma", "ultrazvuk", "laser", "masaze"],
    tagSlugs: [
      "kombinovani-tretmani",
      "anticelulit",
      "zatezanje-koze",
      "celulit-tretman",
      "ultrazvucni-piling",
      "rucna-masaza",
      "esma-favorit-beograd",
      "esma-i-rucna-masaza-protokol",
    ],
    shortDescription:
      "ESMA ultrazvuk sa lipolitičkim gelom + ESMA biostimulativni laser za zatezanje kože + 30 min ručne anticelulit masaže, u jednoj poseti od 60 minuta.",
    longDescription:
      "Anticelulit & Tightening Kombo je protokol koji u jednoj poseti spaja tri koraka rada na celulitu i teksturi kože. Tretman počinje ESMA terapijskim ultrazvukom sa lipolitičkim gelom (20 minuta), koji radi mikromasažu tkiva u zonama sklonim celulitu. Nastavlja se ESMA biostimulativnim laserom, koji doprinosi osećaju zategnutije kože nakon tretmana. Poslednji korak je 30 minuta ručne anticelulit masaže, koja intenzivnijim tehnikama gnječenja i rolanja dodatno podstiče lokalnu cirkulaciju krvi i limfe. Protokol je namenjen klijentima koji žele sveobuhvatniji pristup radu na celulitu u jednom terminu, umesto da aparaturni i ručni deo zakazuju odvojeno. Za trajniji efekat preporučuje se redovna serija tretmana, uz zdravu ishranu i fizičku aktivnost. Više o anticelulit tretmanima pročitajte na blogu: beautymedica.rs/blog/anticelulit-tretmani-celulit.",
    defaultDuration: 60,
    image: {
      img: "https://placehold.co/800x600?text=Anticelulit%20%26%20Tightening%20Kombo",
      imgDesc: "Anticelulit & Tightening Kombo - privremena placeholder slika, zameniti pravom fotografijom",
    },
    seoKeywords: [
      "anticelulit tightening kombo",
      "esma ultrazvuk i masaza celulit",
      "zatezanje koze i anticelulit masaza novi sad",
      "kombinovani anticelulit protokol",
    ],
    features: [
      { name: "🌊 Ultrazvuk sa lipolitičkim gelom", description: "20 min ESMA terapijskog ultrazvuka usmerenog na zone sklone celulitu.", icon: "bi bi-water", order: 1 },
      { name: "✨ Biostimulativni laser", description: "Doprinosi osećaju zategnutije kože nakon tretmana.", icon: "bi bi-stars", order: 2 },
      { name: "💆 Ručna anticelulit masaža", description: "30 min intenzivnije ručne masaže za teksturu kože i cirkulaciju.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "🔄 Tri koraka, jedna poseta", description: "Aparaturni i ručni rad odmah jedan za drugim, bez dodatnog zakazivanja.", icon: "bi bi-arrow-repeat", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (60 min)",
        slug: "jedan-tretman-60-min",
        sessions: 1,
        duration: 60,
        totalPrice: 4500,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      {
        question: "Da li ovaj protokol trajno uklanja celulit?",
        answer:
          "Ne postoji tretman koji garantovano i trajno uklanja celulit. Kombinacija ultrazvuka, laserske biostimulacije i ručne masaže može doprineti boljoj teksturi kože i cirkulaciji, naročito uz redovnu seriju tretmana, zdravu ishranu i fizičku aktivnost.",
        order: 1,
      },
      {
        question: "Po čemu se razlikuje od Tri-Active Cellu-Erase tretmana?",
        answer:
          "Tri-Active Cellu-Erase kombinuje ultrazvuk, struju i lasersku terapiju u jednoj ESMA proceduri od 75 min. Anticelulit & Tightening Kombo je kraći (60 min) i ručnu anticelulit masažu uključuje direktno u isti termin, umesto da se ona zakazuje posebno.",
        order: 2,
      },
      {
        question: "Koliko često treba dolaziti na ovaj protokol?",
        answer: "Za primetniju razliku preporučuje se paket od 8 tretmana, sa dinamikom koju terapeut predlaže na konsultaciji prema stanju kože.",
        order: 3,
      },
      {
        question: "Ko ne bi trebalo da radi ovaj tretman?",
        answer:
          "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, malignim oboljenjima, akutnim upalama kože ili trombozom, bez prethodne konsultacije sa terapeutom.",
        order: 4,
      },
    ],
    comparisonColumns: ["Anticelulit & Tightening Kombo", "Samo anticelulit masaža"],
    comparisonTable: [
      { label: "Tehnologije", values: ["Ultrazvuk + Laser + Ručna masaža", "Samo ručna masaža"] },
      { label: "Trajanje", values: ["60 min", "30-60 min"] },
      { label: "Fokus", values: ["Celulit i tekstura kože, dublje i površinski", "Cirkulacija i tekstura kože"] },
    ],
  },

  // 3. Fizio-Express Back Relief
  {
    slug: "fizio-express-back-relief",
    name: "Fizio-Express Back Relief",
    categorySlugs: ["esma", "struja", "ultrazvuk", "masaze"],
    tagSlugs: [
      "terapija-bola",
      "oporavak-misica",
      "analgezija",
      "rucna-masaza",
      "esma-favorit-beograd",
      "fizio-terapeutski-protokol",
      "leda-i-vrat-tretman",
      "dekontrakcija-misica",
    ],
    shortDescription:
      "ESMA terapijski ultrazvuk ili interferentne struje na bolnim zonama (20 min) + 30 min ručne terapeutske masaže. Fizio protokol za leđa i vrat, u jednoj poseti od 50 minuta.",
    longDescription:
      "Fizio-Express Back Relief je fizio protokol namenjen bolovima i napetosti u leđima i vratu, koji u jednoj poseti od 50 minuta spaja aparaturni i ručni rad. Tretman počinje sa 20 minuta ESMA terapijskog ultrazvuka ili interferentnih struja usmerenih na bolne zone - ovaj deo pomaže u omekšavanju zategnutih mišićnih čvorova pre ručnog rada. Nastavlja se sa 30 minuta ručne terapeutske masaže, koja ciljano radi na već opuštenijem mišiću. Protokol je namenjen osobama sa bolovima u leđima ili vratu nastalim usled dugog sedenja, stresa ili fizičkog naprezanja, kao dopuna - ne zamena - redovnoj fizikalnoj terapiji i lekarskom pregledu. Kod jakog, iznenadnog ili dugotrajnog bola prvo se obratite lekaru ili fizijatru. Više o razlici između ručne masaže i aparaturnih tretmana pročitajte na blogu: beautymedica.rs/blog/masaza-vs-aparaturni-tretmani.",
    defaultDuration: 50,
    image: {
      img: "https://placehold.co/800x600?text=Fizio-Express%20Back%20Relief",
      imgDesc: "Fizio-Express Back Relief - privremena placeholder slika, zameniti pravom fotografijom",
    },
    seoKeywords: [
      "fizio express back relief",
      "tretman za bol u ledjima novi sad",
      "esma i masaza za vrat i ledja",
      "fizio terapeutski protokol novi sad",
    ],
    features: [
      { name: "⚡ Ultrazvuk ili struje", description: "20 min ESMA terapijskog ultrazvuka ili interferentnih struja na bolnim zonama.", icon: "bi bi-lightning-charge", order: 1 },
      { name: "🧘 Omekšavanje čvorova", description: "Aparaturni deo priprema zategnut mišić pre ručnog rada.", icon: "bi bi-arrow-repeat", order: 2 },
      { name: "💆 Terapeutska masaža", description: "30 min ručne terapeutske masaže na već opuštenijem mišiću.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "🏃 Dopuna oporavku", description: "Koristan dodatak fizikalnoj terapiji, ne zamena za lekarski pregled.", icon: "bi bi-activity", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (50 min)",
        slug: "jedan-tretman-50-min",
        sessions: 1,
        duration: 50,
        totalPrice: 4200,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      {
        question: "Da li ovaj protokol leči bol u leđima?",
        answer:
          "Ne. Fizio-Express Back Relief može doprineti smanjenju mišićne napetosti i osećaja bola, ali ne predstavlja medicinsko lečenje niti zamenu za pregled lekara ili fizijatra. Kod jakog ili dugotrajnog bola obavezno se prvo obratite lekaru.",
        order: 1,
      },
      {
        question: "Zašto se prvo radi aparaturni deo, pa tek onda masaža?",
        answer:
          "Ultrazvuk ili interferentne struje pomažu u omekšavanju zategnutih mišićnih čvorova, tako da ručna terapeutska masaža koja sledi radi na već opuštenijem mišiću i klijent lakše podnosi dublji pritisak.",
        order: 2,
      },
      {
        question: "Koliko tretmana je potrebno kod hroničnih bolova u leđima ili vratu?",
        answer: "Za hronične tegobe preporučuje se serija od 5 do 10 tretmana, u zavisnosti od stanja i preporuke terapeuta - zato nudimo paket od 5 i paket od 10 tretmana.",
        order: 3,
      },
      {
        question: "Ko ne bi trebalo da radi ovaj tretman?",
        answer:
          "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, akutnim upalama, malignim oboljenjima ili neposredno nakon operacije, bez prethodne konsultacije sa lekarom.",
        order: 4,
      },
    ],
    comparisonColumns: ["Fizio-Express Back Relief", "Samo terapeutska masaža"],
    comparisonTable: [
      { label: "Priprema mišića pre masaže", values: ["Da - ultrazvuk/struje", "Ne"] },
      { label: "Trajanje", values: ["50 min", "60 min"] },
      { label: "Fokus", values: ["Bolne zone leđa i vrata, ciljano", "Celo telo ili odabrana zona"] },
    ],
  },

  // 4. Post-Op & Regeneracija
  {
    slug: "post-op-regeneracija",
    name: "Post-Op & Regeneracija",
    categorySlugs: ["esma", "struja", "laser", "masaze"],
    tagSlugs: [
      "oporavak-misica",
      "limfodrenaza",
      "rucna-masaza",
      "esma-favorit-beograd",
      "post-operativna-nega",
      "fizio-terapeutski-protokol",
    ],
    shortDescription:
      "ESMA biostimulativni laser + drenažni program na ESMA kanalima + lagana ručna limfna drenaža, u jednoj poseti od 60 minuta. Podrška oporavku nakon estetskih zahvata ili teških treninga.",
    longDescription:
      "Post-Op & Regeneracija je protokol namenjen podršci oporavku nakon estetskih ili hirurških zahvata, kao i nakon posebno zahtevnih treninga. Tretman kombinuje ESMA biostimulativni laser, drenažni program na ESMA kanalima i 30 minuta lagane ručne limfne drenaže, u jednoj poseti od 60 minuta. Aparaturni deo podstiče lokalnu cirkulaciju, dok lagana ručna limfna drenaža dodatno pomaže u smanjenju osećaja otečenosti u tretiranoj zoni. Protokol je isključivo podrška oporavku - ne predstavlja medicinski tretman niti zamenu za uputstva lekara koji je izvršio zahvat. Pre zakazivanja, posebno nakon skorašnje operacije, obavezno se prvo konsultujte sa svojim lekarom o tome kada je bezbedno započeti ovakav tretman. Za sportiste i rekreativce nakon posebno zahtevnih treninga, protokol može doprineti osećaju bržeg oporavka mišića.",
    defaultDuration: 60,
    image: {
      img: "https://placehold.co/800x600?text=Post-Op%20%26%20Regeneracija",
      imgDesc: "Post-Op & Regeneracija - privremena placeholder slika, zameniti pravom fotografijom",
    },
    seoKeywords: [
      "post op regeneracija novi sad",
      "oporavak nakon estetskog zahvata",
      "limfna drenaza posle operacije",
      "regeneracija nakon treninga esma",
    ],
    features: [
      { name: "✨ Biostimulativni laser", description: "Podstiče lokalnu cirkulaciju u tretiranoj zoni.", icon: "bi bi-sun", order: 1 },
      { name: "⚡ Drenažni program", description: "ESMA kanali rade na smanjenju osećaja otečenosti.", icon: "bi bi-lightning-charge", order: 2 },
      { name: "💆 Lagana ručna drenaža", description: "30 min blage ručne limfne drenaže, prilagođene osetljivom stanju tkiva.", icon: "bi bi-heart-pulse", order: 3 },
      { name: "🛡️ Podrška, ne zamena", description: "Dopuna oporavku, uz obaveznu prethodnu konsultaciju sa lekarom.", icon: "bi bi-shield-check", order: 4 },
    ],
    packages: [
      {
        name: "Jedan tretman (60 min)",
        slug: "jedan-tretman-60-min",
        sessions: 1,
        duration: 60,
        totalPrice: 4800,
        order: 1,
        isBest: false,
      },
    ],
    faq: [
      {
        question: "Kada je bezbedno početi ovaj protokol nakon operacije?",
        answer:
          "To zavisi od vrste zahvata i individualnog oporavka, i mora proceniti lekar koji je izvršio zahvat. Obavezno se prvo konsultujte sa svojim lekarom pre zakazivanja, posebno u ranoj fazi oporavka.",
        order: 1,
      },
      {
        question: "Da li protokol ubrzava zarastanje?",
        answer:
          "Protokol je podrška oporavku kroz podsticanje cirkulacije i laganu limfnu drenažu, ali ne predstavlja medicinski tretman niti garantuje ubrzano zarastanje - ne zamenjuje uputstva vašeg lekara.",
        order: 2,
      },
      {
        question: "Da li je pogodan i za sportiste bez operacije, samo nakon teškog treninga?",
        answer: "Da, protokol se koristi i kao podrška oporavku mišića nakon posebno zahtevnih treninga, ne samo nakon zahvata.",
        order: 3,
      },
      {
        question: "Zašto je ručna drenaža ovde 'lagana', za razliku od drugih protokola?",
        answer:
          "Tkivo u ranoj fazi oporavka je osetljivije, pa se intenzitet ručnog rada namerno prilagođava - terapeut procenjuje pritisak individualno, u dogovoru sa vama.",
        order: 4,
      },
    ],
    comparisonColumns: ["Post-Op & Regeneracija", "Samo lagana ručna drenaža"],
    comparisonTable: [
      { label: "Tehnologije", values: ["Laser + ESMA drenažni program + Ručna drenaža", "Samo ručna drenaža"] },
      { label: "Trajanje", values: ["60 min", "30-60 min"] },
      { label: "Namena", values: ["Podrška oporavku nakon zahvata/treninga", "Opšte smanjenje otoka"] },
    ],
  },];

// ---------------------------------------------------------------------------
// Upsert funkcije
// ---------------------------------------------------------------------------

async function upsertTopLevelCategories() {
  const bySlug = {};
  for (const def of topLevelCategories) {
    const doc = await Category.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, shortDescription: def.shortDescription, parent: null },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
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
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
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
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    bySlug[def.slug] = doc;
  }
  return bySlug;
}

async function upsertServices(categoriesBySlug, tagsBySlug) {
  const serviceIdsBySlug = {};
  const variantIdsBySlug = {};

  for (const def of serviceDefs) {
    const categories = def.categorySlugs.map((slug) => {
      const cat = categoriesBySlug[slug];
      if (!cat) {
        throw new Error(`Usluga "${def.slug}" referenciše nepostojeći categorySlug "${slug}" - proveri topLevelCategories/childCategories.`);
      }
      return cat._id;
    });

    const tags = def.tagSlugs.map((slug) => {
      const tag = tagsBySlug[slug];
      if (!tag) {
        throw new Error(`Usluga "${def.slug}" referenciše nepostojeći tagSlug "${slug}" - proveri tagDefs.`);
      }
      return tag._id;
    });

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
      image: def.image || null,
      categories,
      tags,
      resources: SERVICE_RESOURCE_MAP[def.slug] || [],
      defaultDuration: def.defaultDuration,
      ctaText: "Zakaži termin",
      features: def.features || [],
      packages,
      faq: def.faq || [],
      comparisonColumns: def.comparisonColumns || [],
      comparisonTable: def.comparisonTable || [],
      seoKeywords: def.seoKeywords || [],
      isActive: true,
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

// ---------------------------------------------------------------------------
// Glavna seed funkcija
// ---------------------------------------------------------------------------

export async function seedServiceCatalog() {
  let categoriesBySlug = await upsertTopLevelCategories();
  categoriesBySlug = await upsertChildCategories(categoriesBySlug);
  const tagsBySlug = await upsertTags();
  const { serviceIdsBySlug, variantIdsBySlug } = await upsertServices(categoriesBySlug, tagsBySlug);

  console.log("\n📊 KATALOG USLUGA (14 ukupno):");
  console.table(
    serviceDefs.map((s) => ({
      naziv: s.name,
      trajanje: `${s.defaultDuration} min`,
      pojedinacnaCena: `${s.packages[0].totalPrice} RSD`,
    }))
  );

  const summary = {
    categories: Object.keys(categoriesBySlug).length,
    tags: Object.keys(tagsBySlug).length,
    services: Object.keys(serviceIdsBySlug).length,
  };

  logInfo("Katalog usluga (kategorije + tagovi + 14 usluga) seedovan", summary);
  return { ...summary, serviceIdsBySlug, variantIdsBySlug };
}

export default seedServiceCatalog;