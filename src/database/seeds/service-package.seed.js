import Tag from "../../models/tag.model.js";
import Service from "../../models/service.model.js";
import Package from "../../models/package.model.js";
import { logInfo } from "../../utils/logger.util.js";

// ---------------------------------------------------------------------------
// NAPOMENA (konsolidacija, avgust 2026.)
// ---------------------------------------------------------------------------
// Ovaj fajl zamenjuje i objedinjuje SVE Package (top-level, "kupi više
// tretmana/usluga odjednom") definicije koje su ranije bile razbacane po:
//   - esma-catalog.seed.js        (12 "5/10 tretmana" bundlova za 6 ESMA usluga)
//   - premium-combo-packages.seed.js (6 "premium" paketa - kombinacija DVE
//     različite usluge kroz više odvojenih poseta, npr. 5 ESMA + 3 masaže)
//   - esma-masaza-protokoli.seed.js  (6 "N tretmana" bundlova za 4 nova
//     hibridna protokola)
// = 24 Package dokumenta ukupno, svi u JEDNOM fajlu.
//
// VAŽNA ISPRAVKA U ODNOSU NA STARI esma-catalog.seed.js: onaj fajl je imao
// DVE paralelne definicije bundlova za istih 6 ESMA usluga - 12 ručno pisanih
// objekata (bogat FAQ/SEO, ali slug oblika "tesla-tone-24-5-tretmana", npr.
// SA crtom između "tesla" i "tone") KOJI NIKAD nisu bili pušteni na produkciju,
// plus automatski generisanih 12 objekata (prazan FAQ/SEO, slug oblika
// "teslatone-24-5-tretmana", BEZ crte - ovo je ono što stvarno postoji u bazi
// danas, provereno protiv test_packages.json exporta). Da bi se izbeglo da
// ponovno pokretanje seed-a napravi 12 NOVIH duplikata pored postojećih 12,
// ovaj fajl koristi TAČAN live slug format, ali zadržava bogatiji FAQ/SEO
// sadržaj iz ručno pisanih objekata (upsert po slugu će samo OBOGATITI
// postojećih 12 paketa u bazi umesto da napravi duplikate).
//
// ZAVISNOST: ovaj seed pretpostavlja da je service-catalog.seed.js već
// pokrenut (koristi njegove kategorije/tagove/usluge/varijante po slugu) -
// pokreni run-service-catalog.seed.js PRE ovog seed-a.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BUNDLOVI - paket od N sesija JEDNE iste usluge (18 ukupno: 12 za 6 osnovnih
// ESMA usluga + 6 za 4 hibridna protokola)
// ---------------------------------------------------------------------------

const bundleDefs = [
  // --- Tesla-Tone 24 ---
  {
    serviceSlug: "teslatone-24",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "teslatone-24-5-tretmana",
    name: "Tesla‑Tone 24 – paket od 5 tretmana",
    shortDescription: "5 tretmana Tesla‑Tone 24 po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Tesla‑Tone 24. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 15750,
    basePrice: 17500,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["tesla tone 24 paket", "miostimulacija paket", "5 tretmana miostimulacije"],
    faq: [
      { question: "Da li moram sve tretmane da zakažem odjednom?", answer: "Ne. Paket se plaća unapred, a sesije se zakazuju pojedinačno u dogovoru sa terapeutom, prema vašem rasporedu.", order: 1 },
      { question: "Da li paket ima rok trajanja?", answer: "Preporučujemo da svih 5 tretmana iskoristite u razmaku od nekoliko nedelja, jer se najbolji rezultati postižu redovnošću. Za tačan rok važenja pitajte na konsultaciji.", order: 2 },
      { question: "Šta ako mi zatreba više tretmana od 5?", answer: "Uvek možete kupiti dodatni paket ili preći na paket od 10 tretmana za još povoljniju cenu po tretmanu.", order: 3 },
    ],
  },
  {
    serviceSlug: "teslatone-24",
    variantSlug: "jedan-tretman-45-min",
    sessions: 10,
    slug: "teslatone-24-10-tretmana",
    name: "Tesla‑Tone 24 – paket od 10 tretmana",
    shortDescription: "10 tretmana Tesla‑Tone 24 po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Tesla‑Tone 24. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom. Preporučeno za dugoročne rezultate i maksimalnu transformaciju.",
    totalPrice: 28000,
    basePrice: 35000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["tesla tone 24 paket 10 tretmana", "miostimulacija serija tretmana"],
    faq: [
      { question: "Zašto je paket od 10 tretmana povoljniji?", answer: "Popust raste sa brojem tretmana - paket od 10 nosi 20% popusta u odnosu na pojedinačnu cenu, dvostruko više od paketa od 5.", order: 1 },
      { question: "Kome se preporučuje ovaj paket?", answer: "Onima koji žele primetniju i dugotrajniju promenu tonusa mišića, ne samo održavanje - terapeut na konsultaciji potvrđuje da li je 10 tretmana realan cilj za vas.", order: 2 },
    ],
  },

  // --- Aqua-Drain 360 ---
  {
    serviceSlug: "aquadrain-360",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "aquadrain-360-5-tretmana",
    name: "Aqua‑Drain 360 – paket od 5 tretmana",
    shortDescription: "5 tretmana Aqua‑Drain 360 po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Aqua‑Drain 360. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 15750,
    basePrice: 17500,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["aqua drain 360 paket", "limfna drenaza paket", "5 tretmana limfne drenaze"],
    faq: [
      { question: "Koliko često treba dolaziti u okviru paketa?", answer: "Za osećaj olakšanja preporučuje se nekoliko puta nedeljno u intenzivnijoj fazi, a terapeut prilagođava dinamiku vašem stanju.", order: 1 },
      { question: "Da li paket pokriva celo telo svaki put?", answer: "Da, svaka sesija u okviru paketa je 45-minutni tretman celog tela, isto kao pojedinačna poseta.", order: 2 },
    ],
  },
  {
    serviceSlug: "aquadrain-360",
    variantSlug: "jedan-tretman-45-min",
    sessions: 10,
    slug: "aquadrain-360-10-tretmana",
    name: "Aqua‑Drain 360 – paket od 10 tretmana",
    shortDescription: "10 tretmana Aqua‑Drain 360 po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Aqua‑Drain 360. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 28000,
    basePrice: 35000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["aqua drain 360 paket 10 tretmana", "limfna drenaza serija"],
    faq: [
      { question: "Da li 10 tretmana daje trajniji efekat od 5?", answer: "Duži ciklus redovnih tretmana obično daje primetniju i dužu razliku u osećaju cirkulacije, ali svaki organizam reaguje individualno.", order: 1 },
    ],
  },

  // --- Lipolise Russian-Max ---
  {
    serviceSlug: "lipolise-russianmax",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "lipolise-russianmax-5-tretmana",
    name: "Lipolise Russian‑Max – paket od 5 tretmana",
    shortDescription: "5 tretmana Lipolise Russian‑Max po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Lipolise Russian‑Max. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 18000,
    basePrice: 20000,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["lipolise russian max paket", "elektrolipoliza paket"],
    faq: [
      { question: "Da li je 5 tretmana dovoljno za rezultate?", answer: "Za lokalizovane manje zone može biti dovoljno kao početna serija, ali za izraženije naslage terapeut često predlaže nastavak paketom od 10.", order: 1 },
    ],
  },
  {
    serviceSlug: "lipolise-russianmax",
    variantSlug: "jedan-tretman-45-min",
    sessions: 10,
    slug: "lipolise-russianmax-10-tretmana",
    name: "Lipolise Russian‑Max – paket od 10 tretmana",
    shortDescription: "10 tretmana Lipolise Russian‑Max po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Lipolise Russian‑Max. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 32000,
    basePrice: 40000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["lipolise russian max paket 10 tretmana", "elektrolipoliza serija"],
    faq: [
      { question: "Da li mogu kombinovati ovaj paket sa anticelulit masažom?", answer: "Da, terapeut može predložiti kombinaciju elektrolipolize i ručne anticelulit masaže za dodatnu podršku cirkulaciji.", order: 1 },
    ],
  },

  // --- Tri-Active Cellu-Erase ---
  {
    serviceSlug: "triactive-celluerase",
    variantSlug: "jedan-tretman-75-min",
    sessions: 5,
    slug: "triactive-celluerase-5-tretmana",
    name: "Tri‑Active Cellu‑Erase – paket od 5 tretmana",
    shortDescription: "5 tretmana Tri‑Active Cellu‑Erase po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Tri‑Active Cellu‑Erase. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 24750,
    basePrice: 27500,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["tri active cellu erase paket", "kombinovani anticelulit tretman paket"],
    faq: [
      { question: "Zašto je ovaj paket skuplji od ostalih ESMA paketa?", answer: "Tri-Active Cellu-Erase je 75-minutni kombinovani tretman (ultrazvuk + struja + svetlosna terapija), duži i sveobuhvatniji od standardnog 45-minutnog tretmana, što se odražava na cenu.", order: 1 },
    ],
  },
  {
    serviceSlug: "triactive-celluerase",
    variantSlug: "jedan-tretman-75-min",
    sessions: 10,
    slug: "triactive-celluerase-10-tretmana",
    name: "Tri‑Active Cellu‑Erase – paket od 10 tretmana",
    shortDescription: "10 tretmana Tri‑Active Cellu‑Erase po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Tri‑Active Cellu‑Erase. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 44000,
    basePrice: 55000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["tri active cellu erase paket 10 tretmana", "celulit tretman serija"],
    faq: [
      { question: "Kome se preporučuje paket od 10 tretmana?", answer: "Klijentima sa dugotrajnim, tvrdokornim celulitom kojima je potreban duži ciklus da bi se videla primetnija razlika.", order: 1 },
    ],
  },

  // --- Laser-Sonic Face Sculpt ---
  {
    serviceSlug: "lasersonic-face-sculpt",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "lasersonic-face-sculpt-5-tretmana",
    name: "Laser‑Sonic Face Sculpt – paket od 5 tretmana",
    shortDescription: "5 tretmana Laser‑Sonic Face Sculpt po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Laser‑Sonic Face Sculpt. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 20250,
    basePrice: 22500,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["laser sonic face sculpt paket", "lifting lica paket", "mikrostrujni lifting serija"],
    faq: [
      { question: "Da li je 5 tretmana dovoljno za lifting lica?", answer: "Za suptilniju, postepenu promenu da - za izraženiji i duži efekat terapeuti češće preporučuju paket od 10 tretmana.", order: 1 },
    ],
  },
  {
    serviceSlug: "lasersonic-face-sculpt",
    variantSlug: "jedan-tretman-45-min",
    sessions: 10,
    slug: "lasersonic-face-sculpt-10-tretmana",
    name: "Laser‑Sonic Face Sculpt – paket od 10 tretmana",
    shortDescription: "10 tretmana Laser‑Sonic Face Sculpt po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Laser‑Sonic Face Sculpt. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 36000,
    basePrice: 45000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["laser sonic face sculpt paket 10 tretmana", "lifting lica serija tretmana"],
    faq: [
      { question: "Koliko često se preporučuje dolazak u okviru ovog paketa?", answer: "Terapeut najčešće predlaže tretmane u razmaku od nedelju do dve, uz periodično održavanje nakon završetka paketa.", order: 1 },
    ],
  },

  // --- Medicinski Bio-Reset ---
  {
    serviceSlug: "medicinski-bioreset",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "medicinski-bioreset-5-tretmana",
    name: "Medicinski Bio‑Reset – paket od 5 tretmana",
    shortDescription: "5 tretmana Medicinski Bio‑Reset po povoljnijoj ceni. Ušteda 10% u odnosu na pojedinačne tretmane.",
    description: "Paket od 5 tretmana Medicinski Bio‑Reset. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 20250,
    basePrice: 22500,
    badge: "POPUST 10%",
    isBest: false,
    seoKeywords: ["medicinski bio reset paket", "fizikalna terapija paket", "terapija bola serija"],
    faq: [
      { question: "Da li ovaj paket zamenjuje lekarski tretman?", answer: "Ne. Medicinski Bio-Reset je dopuna, ne zamena za pregled lekara ili fizijatra - kod jakog ili dugotrajnog bola prvo se obratite lekaru.", order: 1 },
    ],
  },
  {
    serviceSlug: "medicinski-bioreset",
    variantSlug: "jedan-tretman-45-min",
    sessions: 10,
    slug: "medicinski-bioreset-10-tretmana",
    name: "Medicinski Bio‑Reset – paket od 10 tretmana",
    shortDescription: "10 tretmana Medicinski Bio‑Reset po povoljnijoj ceni. Ušteda 20% u odnosu na pojedinačne tretmane.",
    description: "Paket od 10 tretmana Medicinski Bio‑Reset. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 36000,
    basePrice: 45000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["medicinski bio reset paket 10 tretmana", "terapija bola serija tretmana"],
    faq: [
      { question: "Kome se preporučuje duži paket od 10 tretmana?", answer: "Sportistima i osobama sa hroničnom napetošću kojima je potrebna redovna, dugotrajnija podrška oporavku, uz procenu terapeuta na konsultaciji.", order: 1 },
    ],
  },

  // --- Full Body Contouring 3u1, Anticelulit & Tightening Kombo,
  //     Fizio-Express Back Relief, Post-Op & Regeneracija (hibridni protokoli) ---
  // --- Full Body Contouring 3u1 ---
  {
    serviceSlug: "full-body-contouring-3u1",
    variantSlug: "jedan-tretman-75-min",
    sessions: 6,
    slug: "full-body-contouring-3u1-6-tretmana",
    name: "Full Body Contouring 3u1 – paket od 6 tretmana",
    shortDescription: "6 tretmana Full Body Contouring 3u1 po 5.000 RSD po tretmanu. Ušteda u odnosu na pojedinačnu cenu.",
    description: "Paket od 6 tretmana Full Body Contouring 3u1. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 30000,
    basePrice: 36000,
    badge: "UŠTEDA",
    isBest: false,
    seoKeywords: ["full body contouring paket 6 tretmana", "oblikovanje tela paket novi sad"],
    faq: [
      { question: "Zašto je paket od 6 tretmana povoljniji od pojedinačnih poseta?", answer: "Cena po tretmanu u paketu od 6 iznosi 5.000 RSD, umesto pojedinačnih 6.000 RSD - ušteda raste dodatno u paketu od 10 tretmana.", order: 1 },
      { question: "Da li paket ima rok trajanja?", answer: "Preporučujemo da svih 6 tretmana iskoristite u razmaku od nekoliko nedelja radi kontinuiteta efekta. Za tačan rok važenja pitajte na konsultaciji.", order: 2 },
    ],
  },
  {
    serviceSlug: "full-body-contouring-3u1",
    variantSlug: "jedan-tretman-75-min",
    sessions: 10,
    slug: "full-body-contouring-3u1-10-tretmana",
    name: "Full Body Contouring 3u1 – paket od 10 tretmana",
    shortDescription: "10 tretmana Full Body Contouring 3u1 po 4.500 RSD po tretmanu. Najveća ušteda po tretmanu.",
    description: "Paket od 10 tretmana Full Body Contouring 3u1. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom. Preporučeno za dugoročne rezultate i sveobuhvatnu transformaciju tela.",
    totalPrice: 45000,
    basePrice: 60000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["full body contouring paket 10 tretmana", "oblikovanje tela serija tretmana"],
    faq: [
      { question: "Kome se preporučuje paket od 10 tretmana?", answer: "Klijentima koji žele primetniju i dugotrajniju promenu u obliku i tonusu tela, ne samo održavanje - terapeut na konsultaciji potvrđuje da li je 10 tretmana realan cilj za vas.", order: 1 },
    ],
  },

  // --- Anticelulit & Tightening Kombo ---
  {
    serviceSlug: "anticelulit-tightening-kombo",
    variantSlug: "jedan-tretman-60-min",
    sessions: 8,
    slug: "anticelulit-tightening-kombo-8-tretmana",
    name: "Anticelulit & Tightening Kombo – paket od 8 tretmana",
    shortDescription: "8 tretmana Anticelulit & Tightening Kombo po 3.750 RSD po tretmanu. Ušteda u odnosu na pojedinačnu cenu.",
    description: "Paket od 8 tretmana Anticelulit & Tightening Kombo. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom. Preporučeno za primetniju i dugotrajniju razliku u teksturi kože.",
    totalPrice: 30000,
    basePrice: 36000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["anticelulit tightening kombo paket", "anticelulit paket 8 tretmana novi sad"],
    faq: [
      { question: "Zašto je preporučena serija od 8 tretmana?", answer: "Rad na celulitu i teksturi kože daje primetnije rezultate uz redovnost - terapeut na konsultaciji prilagođava tačnu dinamiku dolazaka vašem stanju.", order: 1 },
      { question: "Da li paket ima rok trajanja?", answer: "Preporučujemo da svih 8 tretmana iskoristite u razmaku od nekoliko nedelja radi kontinuiteta efekta. Za tačan rok važenja pitajte na konsultaciji.", order: 2 },
    ],
  },

  // --- Fizio-Express Back Relief ---
  {
    serviceSlug: "fizio-express-back-relief",
    variantSlug: "jedan-tretman-50-min",
    sessions: 5,
    slug: "fizio-express-back-relief-5-tretmana",
    name: "Fizio-Express Back Relief – paket od 5 tretmana",
    shortDescription: "5 tretmana Fizio-Express Back Relief po 3.600 RSD po tretmanu. Ušteda u odnosu na pojedinačnu cenu.",
    description: "Paket od 5 tretmana Fizio-Express Back Relief. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.",
    totalPrice: 18000,
    basePrice: 21000,
    badge: "UŠTEDA",
    isBest: false,
    seoKeywords: ["fizio express back relief paket", "tretman za bol u ledjima paket novi sad"],
    faq: [
      { question: "Da li ovaj paket zamenjuje lekarski tretman ili fizikalnu terapiju?", answer: "Ne. Paket je dopuna redovnoj fizikalnoj terapiji i lekarskom tretmanu, ne zamena - kod jakog ili dugotrajnog bola prvo se obratite lekaru ili fizijatru.", order: 1 },
    ],
  },
  {
    serviceSlug: "fizio-express-back-relief",
    variantSlug: "jedan-tretman-50-min",
    sessions: 10,
    slug: "fizio-express-back-relief-10-tretmana",
    name: "Fizio-Express Back Relief – paket od 10 tretmana",
    shortDescription: "10 tretmana Fizio-Express Back Relief po 3.200 RSD po tretmanu. Najveća ušteda po tretmanu.",
    description: "Paket od 10 tretmana Fizio-Express Back Relief. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom. Preporučeno kod hronične napetosti u leđima i vratu.",
    totalPrice: 32000,
    basePrice: 42000,
    badge: "NAJBOLJA VREDNOST",
    isBest: true,
    seoKeywords: ["fizio express back relief paket 10 tretmana", "terapija bola serija tretmana novi sad"],
    faq: [
      { question: "Kome se preporučuje duži paket od 10 tretmana?", answer: "Osobama sa hroničnom napetošću ili ponavljanim bolom u leđima i vratu kojima je potrebna redovna, dugotrajnija podrška, uz procenu terapeuta na konsultaciji.", order: 1 },
    ],
  },

  // --- Post-Op & Regeneracija ---
  {
    serviceSlug: "post-op-regeneracija",
    variantSlug: "jedan-tretman-60-min",
    sessions: 6,
    slug: "post-op-regeneracija-6-tretmana",
    name: "Post-Op & Regeneracija – paket od 6 tretmana",
    shortDescription: "6 tretmana Post-Op & Regeneracija po 4.000 RSD po tretmanu. Ušteda u odnosu na pojedinačnu cenu.",
    description: "Paket od 6 tretmana Post-Op & Regeneracija. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom i uz prethodnu saglasnost vašeg lekara.",
    totalPrice: 24000,
    basePrice: 28800,
    badge: "UŠTEDA",
    isBest: true,
    seoKeywords: ["post op regeneracija paket", "oporavak nakon zahvata paket tretmana"],
    faq: [
      { question: "Da li mogu da kupim paket pre nego što znam tačan datum zahvata?", answer: "Da, paket možete kupiti unapred - sesije se zakazuju pojedinačno kada vam lekar potvrdi da je bezbedno započeti tretmane.", order: 1 },
    ],
  },];

// ---------------------------------------------------------------------------
// PREMIUM KOMBINACIJE - paket koji spaja DVE različite usluge (jedna ESMA/
// struja usluga kao glavni akcenat + jedna ručna masaža kao sporedni akcenat,
// zakazuju se kao odvojene posete). Za razliku od bundlova iznad, ovi paketi
// referenciraju DVE usluge u `items`, i koriste 2 dodatna taga
// ("premium-paket", "esma-i-masaza") koji su definisani u
// service-catalog.seed.js - ovde se samo učitavaju po slugu.
// ---------------------------------------------------------------------------

const PREMIUM_TAG_SLUGS = ["premium-paket", "esma-i-masaza"];

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
  },];

// ---------------------------------------------------------------------------
// Upsert funkcije
// ---------------------------------------------------------------------------

async function loadService(slug) {
  const service = await Service.findOne({ slug }).lean();
  if (!service) {
    throw new Error(`Usluga "${slug}" ne postoji - pokreni prvo run-service-catalog.seed.js pre ovog seed-a.`);
  }
  return service;
}

function findVariant(service, variantSlug) {
  const variant = (service.packages || []).find((p) => p.slug === variantSlug);
  if (!variant) {
    throw new Error(`Usluga "${service.slug}" nema varijantu "${variantSlug}" - proveri service-catalog.seed.js.`);
  }
  return variant;
}

// De-dupes a list of ObjectId-like values by string form - main/secondary
// services u premium kombinacijama često dele kategoriju (npr. oboje "esma"/
// "struja"), ali nikad ne dele kategoriju ručne masaže ("masaze"), pa paket
// koji spaja oba postaje filtriran pod bilo kojom od njih.
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

async function upsertBundlePackages() {
  const created = [];
  for (const def of bundleDefs) {
    const service = await loadService(def.serviceSlug);
    const variant = findVariant(service, def.variantSlug);

    const payload = {
      name: def.name,
      slug: def.slug,
      description: def.description,
      shortDescription: def.shortDescription,
      items: [{ service: service._id, servicePackageId: variant._id, sessions: def.sessions }],
      totalPrice: def.totalPrice,
      basePrice: def.basePrice,
      totalDuration: def.sessions * variant.duration,
      badge: def.badge,
      isBest: def.isBest || false,
      categories: service.categories,
      tags: service.tags,
      faq: def.faq || [],
      seoKeywords: def.seoKeywords || [],
      isActive: true,
    };

    const doc = await Package.findOneAndUpdate({ slug: def.slug }, payload, {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: true,
    });
    created.push(doc);
  }
  return created;
}

async function loadPremiumTagIds() {
  const ids = [];
  for (const slug of PREMIUM_TAG_SLUGS) {
    const tag = await Tag.findOne({ slug, domain: "service" }).lean();
    if (!tag) {
      throw new Error(`Tag "${slug}" ne postoji - pokreni prvo run-service-catalog.seed.js pre ovog seed-a.`);
    }
    ids.push(tag._id);
  }
  return ids;
}

async function upsertComboPackages(premiumTagIds) {
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
      returnDocument: "after",
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

export async function seedServicePackages() {
  const bundles = await upsertBundlePackages();
  const premiumTagIds = await loadPremiumTagIds();
  const combos = await upsertComboPackages(premiumTagIds);
  const all = [...bundles, ...combos];

  console.log("\n📊 SVI PAKETI (24 ukupno: 18 bundlova + 6 premium kombinacija):");
  console.table(
    all.map((p) => ({
      naziv: p.name,
      cena: `${p.totalPrice} RSD`,
      staraCena: `${p.basePrice} RSD`,
      trajanje: `${p.totalDuration} min`,
      oznaka: p.badge,
      najbolji: p.isBest ? "DA" : "-",
    }))
  );

  const summary = { bundles: bundles.length, combos: combos.length, total: all.length };
  logInfo("Svi paketi (bundlovi + premium kombinacije) seedovani", summary);
  return summary;
}

export default seedServicePackages;