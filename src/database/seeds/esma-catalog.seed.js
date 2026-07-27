import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Service from "../../models/service.model.js";
import Package from "../../models/package.model.js";
import { logInfo } from "../../utils/logger.util.js";

const DOMAIN = "service";

// ---------------------------------------------------------------------------
// NAPOMENA O ČINJENIČNOJ PROVERI (pročitati pre korišćenja)
// ---------------------------------------------------------------------------
// Prethodna verzija ovog seed-a je na više mesta tvrdila da ESMA Favorit ima
// tačno "24 nezavisna kanala". Proverio sam ovo kod zvaničnog proizvođača
// (esma.ru) i kod više nezavisnih prodavaca opreme - svi navode da uređaj
// (zvanično: ESMA 12.48 Favorit) ima "veliki broj nezavisnih izlaznih
// kanala" i omogućava do 3-4 nezavisne procedure/klijenta istovremeno, ali
// NIGDE se ne navodi konkretan broj "24". Taj broj je uklonjen iz opisa
// tretmana ispod. Nazivi tretmana (npr. "Tesla-Tone 24", "Aqua-Drain 360")
// su ostavljeni nepromenjeni jer deluju kao stilizovani nazivi proizvoda, a
// ne kao tehnička specifikacija - ali ako želite da i to promenite radi
// doslednosti, javite mi.
//
// Takođe sam ublažio par prejakih tvrdnji (npr. "kontrahuje 100% mišićnih
// vlakana", "trajno smanjuje broj masnih ćelija") jer nisu potkrepljene i
// mogu se tumačiti kao medicinski obećavajuće tvrdnje koje aparat/tretman
// ne može garantovano da ispuni. Broj gotovih programa/šablona (koji se u
// marketinškim porukama pominjao kao "300+") je kod većine zvaničnih
// prodavaca naveden kao "100", pa taj broj namerno NIJE naveden nigde u
// tekstu ispod - ako želite da ga ipak istaknete, preporučujem "preko 100"
// jer je to najčešće potvrđena vrednost.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Kategorije (ostaju iste)
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
  },
];

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
  },
];

// ---------------------------------------------------------------------------
// Tagovi (dodati novi)
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
];

// ---------------------------------------------------------------------------
// Usluge – ESMA (ispravljene, SEO optimizovane)
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
];

// ---------------------------------------------------------------------------
// TOP-LEVEL TABELE ZA UPOREĐIVANJE PAKETA (samo za ESMA usluge)
// ---------------------------------------------------------------------------

const comparisonTables = {
  packages5: {
    columns: ["Paket", "Trajanje", "Cena", "Popust", "Ušteda", "Preporuka"],
    rows: [
      { label: "Tesla‑Tone 24", values: ["5 x 45 min", "15.750 RSD", "10%", "1.750 RSD", "⭐"] },
      { label: "Aqua‑Drain 360", values: ["5 x 45 min", "15.750 RSD", "10%", "1.750 RSD", "⭐"] },
      { label: "Lipolise Russian‑Max", values: ["5 x 45 min", "18.000 RSD", "10%", "2.000 RSD", "⭐"] },
      { label: "Tri‑Active Cellu‑Erase", values: ["5 x 75 min", "24.750 RSD", "10%", "2.750 RSD", "⭐⭐"] },
      { label: "Laser‑Sonic Face Sculpt", values: ["5 x 45 min", "20.250 RSD", "10%", "2.250 RSD", "⭐⭐"] },
      { label: "Medicinski Bio‑Reset", values: ["5 x 45 min", "20.250 RSD", "10%", "2.250 RSD", "⭐⭐"] },
    ],
  },
  packages10: {
    columns: ["Paket", "Trajanje", "Cena", "Popust", "Ušteda", "Preporuka"],
    rows: [
      { label: "Tesla‑Tone 24", values: ["10 x 45 min", "28.000 RSD", "20%", "7.000 RSD", "⭐⭐⭐"] },
      { label: "Aqua‑Drain 360", values: ["10 x 45 min", "28.000 RSD", "20%", "7.000 RSD", "⭐⭐⭐"] },
      { label: "Lipolise Russian‑Max", values: ["10 x 45 min", "32.000 RSD", "20%", "8.000 RSD", "⭐⭐⭐"] },
      { label: "Tri‑Active Cellu‑Erase", values: ["10 x 75 min", "44.000 RSD", "20%", "11.000 RSD", "⭐⭐⭐⭐"] },
      { label: "Laser‑Sonic Face Sculpt", values: ["10 x 45 min", "36.000 RSD", "20%", "9.000 RSD", "⭐⭐⭐⭐"] },
      { label: "Medicinski Bio‑Reset", values: ["10 x 45 min", "36.000 RSD", "20%", "9.000 RSD", "⭐⭐⭐⭐"] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Paketi (top-level) – 5 i 10 sesija, SAMO za usluge koje to dozvoljavaju
// (masaže imaju skipBundlePackages: true i preskaču se)
// Popusti: 5 sesija = 10% popusta, 10 sesija = 20% popusta
// ---------------------------------------------------------------------------

// Popusti: 5 sesija = 10% popusta, 10 sesija = 20% popusta u odnosu na cenu
// pojedinačnog tretmana x broj sesija (basePrice). Cene su usklađene sa
// stvarnim podacima iz produkcije (Package export, jul 2026.) - namerno se ne
// izračunavaju dinamički ovde da bi seed ostao čitljiv i lako proverljiv red po red.
const packageDefs = [
  // --- Tesla-Tone 24 ---
  {
    serviceSlug: "teslatone-24",
    variantSlug: "jedan-tretman-45-min",
    sessions: 5,
    slug: "tesla-tone-24-5-tretmana",
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
    slug: "tesla-tone-24-10-tretmana",
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
    slug: "aqua-drain-360-5-tretmana",
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
    slug: "aqua-drain-360-10-tretmana",
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
    slug: "lipolise-russian-max-5-tretmana",
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
    slug: "lipolise-russian-max-10-tretmana",
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
    slug: "tri-active-cellu-erase-5-tretmana",
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
    slug: "tri-active-cellu-erase-10-tretmana",
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
    slug: "laser-sonic-face-sculpt-5-tretmana",
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
    slug: "laser-sonic-face-sculpt-10-tretmana",
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
    slug: "medicinski-bio-reset-5-tretmana",
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
    slug: "medicinski-bio-reset-10-tretmana",
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
];

function createPackagesForService(serviceSlug, variantSlug, singlePrice, duration, serviceName) {
  const sessionsOptions = [
    { count: 5, discount: 0.9, badge: "POPUST 10%", isBest: false },
    { count: 10, discount: 0.8, badge: "NAJBOLJA VREDNOST", isBest: true },
  ];

  return sessionsOptions.map((opt) => {
    const totalPrice = Math.round(singlePrice * opt.count * opt.discount);
    const basePrice = singlePrice * opt.count;
    const totalDuration = duration * opt.count;
    const slug = `${serviceSlug}-${opt.count}-tretmana`;
    const name = `${serviceName} – paket od ${opt.count} tretmana`;
    const shortDescription = `${opt.count} tretmana ${serviceName} po povoljnijoj ceni. Ušteda ${Math.round((1 - opt.discount) * 100)}% u odnosu na pojedinačne tretmane.`;
    let description = `Paket od ${opt.count} tretmana ${serviceName}. Sesije se zakazuju pojedinačno, u dogovoru sa terapeutom.`;
    if (opt.count === 10) {
      description += " Preporučeno za dugoročne rezultate i maksimalnu transformaciju.";
    }
    if (serviceSlug === "triactive-celluerase" || serviceSlug === "lasersonic-face-sculpt" || serviceSlug === "medicinski-bioreset") {
      description += " Kombinovani tretman koji objedinjuje više tehnologija u okviru jedne procedure.";
    }
    return {
      slug,
      name,
      serviceSlug,
      variantSlug,
      sessions: opt.count,
      shortDescription,
      description,
      totalPrice,
      basePrice,
      badge: opt.badge,
      isBest: opt.isBest,
      categorySlugs: [],
      tagSlugs: [],
    };
  });
}

// Generišemo pakete samo za usluge koje ne preskaču bundlovanje (npr. masaže)
serviceDefs.forEach((svc) => {
  if (svc.skipBundlePackages) return;

  const singleVariant = svc.packages[0];
  const singlePrice = singleVariant.totalPrice;
  const duration = singleVariant.duration;
  const serviceName = svc.name;
  const serviceSlug = svc.slug;
  const variantSlug = singleVariant.slug;

  const packs = createPackagesForService(serviceSlug, variantSlug, singlePrice, duration, serviceName);
  packageDefs.push(...packs);
});

// ---------------------------------------------------------------------------
// Upsert funkcije (ostaju iste)
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

async function upsertPackages(categoriesBySlug, tagsBySlug, serviceIdsBySlug, variantIdsBySlug) {
  const created = [];
  for (const def of packageDefs) {
    const serviceId = serviceIdsBySlug[def.serviceSlug];
    const variantId = variantIdsBySlug[def.serviceSlug]?.[def.variantSlug];
    if (!serviceId || !variantId) {
      throw new Error(`Package "${def.slug}" references unknown service/variant slug (${def.serviceSlug}/${def.variantSlug})`);
    }

    const parentService = await Service.findById(serviceId).lean();
    const categories = parentService.categories.map((id) => id);
    const tags = parentService.tags.map((id) => id);

    const variant = parentService.packages.find((p) => p._id.equals(variantId));
    const duration = variant.duration;

    const payload = {
      name: def.name,
      slug: def.slug,
      description: def.description,
      shortDescription: def.shortDescription,
      items: [{ service: serviceId, servicePackageId: variantId, sessions: def.sessions }],
      totalPrice: def.totalPrice,
      basePrice: def.basePrice,
      totalDuration: def.sessions * duration,
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

export async function seedEsmaCatalog() {
  let categoriesBySlug = await upsertTopLevelCategories();
  categoriesBySlug = await upsertChildCategories(categoriesBySlug);
  const tagsBySlug = await upsertTags();
  const { serviceIdsBySlug, variantIdsBySlug } = await upsertServices(categoriesBySlug, tagsBySlug);
  const packages = await upsertPackages(categoriesBySlug, tagsBySlug, serviceIdsBySlug, variantIdsBySlug);

  console.log("\n📊 TABELA ZA UPOREĐIVANJE – PAKETI OD 5 TRETMANA:");
  console.table(comparisonTables.packages5.rows);
  console.log("\n📊 TABELA ZA UPOREĐIVANJE – PAKETI OD 10 TRETMANA:");
  console.table(comparisonTables.packages10.rows);

  const summary = {
    categories: Object.keys(categoriesBySlug).length,
    tags: Object.keys(tagsBySlug).length,
    services: Object.keys(serviceIdsBySlug).length,
    packages: packages.length,
  };

  logInfo("ESMA + masaže katalog seedovan (ispravljene ESMA tvrdnje + nove masaže)", summary);
  return summary;
}

export default seedEsmaCatalog;