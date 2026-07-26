import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import { logInfo } from "../../utils/logger.util.js";

const DOMAIN = "post";

// ---------------------------------------------------------------------------
// NAPOMENA O ČINJENIČNOJ PROVERI (pročitati pre korišćenja)
// ---------------------------------------------------------------------------
// Tekstovi ispod namerno izbegavaju medicinski obećavajuće/apsolutne tvrdnje
// ("trajno uklanja", "garantovano", "leči") iz istog razloga koji je već
// naveden u esma-catalog.seed.js - to su tvrdnje koje aparat/tretman ne može
// pouzdano da garantuje i mogu se tumačiti kao medicinsko obećanje. Umesto
// toga se koristi oprezniji jezik ("može doprineti", "u kombinaciji sa...",
// "rezultati zavise od organizma"). Sve cene, brojevi kanala i tehničke
// specifikacije NAMERNO nisu pominjane u tekstu postova (za razliku od
// naslova usluga) - ako želiš da uključiš konkretne cene u sadržaj postova,
// preporučujem da ih ručno dodaš/proveriš u administraciji pre objave, jer
// se cenovnik menja češće nego blog sadržaj.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Kategorije (domain: "post")
// ---------------------------------------------------------------------------

const categoryDefs = [
  {
    slug: "esma-tretmani",
    name: "ESMA tretmani",
    shortDescription: "Sve o tretmanima na ESMA Favorit aparatu - miostimulacija, limfna drenaža, mikrostrujna terapija, ultrazvuk i laser u jednom sistemu.",
  },
  {
    slug: "telo-i-oblikovanje",
    name: "Telo i oblikovanje",
    shortDescription: "Anticelulit, limfna drenaža, EMS oblikovanje tela i drugi tretmani za konturu i tonus tela.",
  },
  {
    slug: "lice-i-lifting",
    name: "Lice i lifting",
    shortDescription: "Nehirurško zatezanje i lifting lica - HIFU, mikrostrujni lifting i mioLifting tretmani.",
  },
  {
    slug: "laser-i-koza",
    name: "Laser i nega kože",
    shortDescription: "Laserska epilacija, ultrazvučni piling i regeneracija kože.",
  },
  {
    slug: "masaza-i-relaksacija",
    name: "Masaža i relaksacija",
    shortDescription: "Klasične ručne masaže - opuštanje, antistres, sport i terapeutska masaža.",
  },
  {
    slug: "vodic-i-saveti",
    name: "Vodič i saveti",
    shortDescription: "Praktični saveti pre i posle tretmana, čega da se pridržavate i šta da očekujete.",
  },
];

// ---------------------------------------------------------------------------
// Tagovi (domain: "post") - namerno isti dugorepni ključni izrazi koje već
// koristiš kao service-domain tagove (zaclaude4.json), ovde ponovo kreirani
// u "post" domenu jer je slug+domain jedinstven po domenu (vidi tag.model.js).
// ---------------------------------------------------------------------------

const tagDefs = [
  { slug: "miostimulacija-iskustva", name: "Miostimulacija iskustva" },
  { slug: "esma-favorit-novi-sad", name: "ESMA Favorit Novi Sad" },
  { slug: "limfna-drenaza-cena", name: "Limfna drenaža cena" },
  { slug: "lifting-lica-bez-igala", name: "Lifting lica bez igala" },
  { slug: "hifu-lifting", name: "HIFU lifting" },
  { slug: "celulit-tretman", name: "Celulit tretman" },
  { slug: "anticelulit-masaza", name: "Anticelulit masaža" },
  { slug: "ultrazvuk-za-lice", name: "Ultrazvuk za lice" },
  { slug: "laser-za-kozu", name: "Laser za kožu" },
  { slug: "oblikovanje-tela", name: "Oblikovanje tela" },
  { slug: "relaksaciona-masaza", name: "Relaksaciona masaža" },
  { slug: "pre-i-posle-tretmana", name: "Pre i posle tretmana" },
];

// ---------------------------------------------------------------------------
// Pomoćne funkcije
// ---------------------------------------------------------------------------

// numbers blocks in order automatically so post defs below don't repeat `order: n`
function blocks(list) {
  return list.map((block, i) => ({ ...block, order: i + 1 }));
}

// mirrors the word-count formula in post.model.js's pre("save") hook - needed
// here because the seed upserts via findOneAndUpdate, which does NOT run that hook
function computeReadingTime(content) {
  const words = content
    .filter((b) => b.type === "paragraph" || b.type === "heading" || b.type === "quote")
    .reduce((sum, b) => sum + (b.text ? b.text.trim().split(/\s+/).length : 0), 0);
  return Math.max(1, Math.ceil(words / 200));
}

// today at a fixed hour, offset by N days (negative = past, positive = future) -
// used to stagger publishedAt (backdated, for an archive that doesn't look like
// it all went live in one dump) and scheduledFor (future, to demonstrate the
// cron sweep actually has something queued to publish)
function dayOffset(days, hour = 9) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function placeholderImage(label) {
  return {
    img: `https://placehold.co/1200x675?text=${encodeURIComponent(label)}`,
    imgDesc: `${label} - privremena placeholder slika, zameniti pravom fotografijom iz studija`,
  };
}

// ---------------------------------------------------------------------------
// Postovi
// ---------------------------------------------------------------------------
// 4 već "objavljena" (backdated publishedAt, tako da arhiva ne izgleda kao da
// je sve odjednom izašlo) + 8 "zakazanih" (scheduledFor u budućnosti, otprilike
// 2x nedeljno) - demonstruje cron posao odmah nakon prvog seed-a.

const postDefs = [
  // --- već objavljeni (4) ---
  {
    slug: "sta-je-miostimulacija-kako-deluje",
    title: "Šta je miostimulacija i kako deluje na tonus mišića",
    excerpt: "Miostimulacija koristi električne impulse da izazove kontrakciju mišića bez klasičnog treninga. Objašnjavamo kako radi, kome je namenjena i šta realno možete da očekujete.",
    categorySlugs: ["esma-tretmani"],
    tagSlugs: ["miostimulacija-iskustva", "esma-favorit-novi-sad"],
    statusOffset: -21,
    seo: {
      title: "Miostimulacija - kako deluje i kome je namenjena | Estetik Lab",
      description: "Šta je miostimulacija, kako električni impulsi deluju na mišiće i kome je ovaj tretman najviše namenjen.",
      keywords: ["miostimulacija", "miostimulacija iskustva", "tonus mišića", "esma favorit"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kako miostimulacija radi" },
      {
        type: "paragraph",
        text: "Miostimulacija je tretman kod kog se preko elektroda na koži šalju kontrolisani električni impulsi koji izazivaju kontrakciju mišićnih vlakana - slično signalu koji mišić inače dobija od nervnog sistema tokom vežbanja. Na ESMA Favorit aparatu ovi impulsi se prilagođavaju regiji tela i cilju tretmana (jačanje, tonus ili opuštanje), pod nadzorom terapeuta.",
      },
      {
        type: "paragraph",
        text: "Osećaj tokom tretmana je ritmična kontrakcija i lagani trnci, a intenzitet se podešava individualno prema pragu tolerancije klijenta. Tretman traje između 30 i 45 minuta, u zavisnosti od regije koja se radi.",
      },
      { type: "heading", level: 3, text: "Kome je namenjena" },
      {
        type: "list",
        ordered: false,
        items: [
          "Osobama koje žele dodatnu stimulaciju mišića uz redovnu fizičku aktivnost",
          "Onima koji imaju sedeći način života i žele da rade na držanju tela i tonusu",
          "Klijentima koji se oporavljaju od perioda smanjene aktivnosti (uz saglasnost lekara)",
        ],
      },
      {
        type: "paragraph",
        text: "Važno je naglasiti da miostimulacija nije zamena za trening, već dopuna - najbolji rezultati se postižu u kombinaciji sa redovnom fizičkom aktivnošću i uravnoteženom ishranom. Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, epilepsijom ili akutnim upalama kože - o tome se uvek razgovara na konsultaciji pre prvog tretmana.",
      },
    ]),
  },
  {
    slug: "esma-favorit-sta-je",
    title: "ESMA Favorit – šta je i koje tretmane kombinuje",
    excerpt: "ESMA Favorit je profesionalni fizioterapeutski aparat koji u jednom sistemu kombinuje nekoliko tehnologija. Objašnjavamo koje su to i kako se biraju za svakog klijenta.",
    categorySlugs: ["esma-tretmani"],
    tagSlugs: ["esma-favorit-novi-sad"],
    statusOffset: -14,
    seo: {
      title: "ESMA Favorit - šta je i šta sve radi | Estetik Lab Novi Sad",
      description: "ESMA Favorit u jednom uređaju kombinuje miostimulaciju, limfnu drenažu, mikrostrujnu terapiju, ultrazvuk i lasersku biostimulaciju.",
      keywords: ["esma favorit", "esma favorit novi sad", "esma tretmani"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "ESMA Favorit je profesionalni fizioterapeutski aparat koji u jednom sistemu kombinuje nekoliko različitih tehnologija - električnu stimulaciju mišića, limfnu drenažu strujom, mikrostrujnu terapiju, ultrazvuk i svetlosnu (lasersku) biostimulaciju. Umesto da klijent prolazi kroz nekoliko odvojenih uređaja, terapeut na jednom sistemu bira kombinaciju modaliteta koja odgovara cilju tretmana.",
      },
      { type: "heading", level: 2, text: "Šta aparat kombinuje" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-lightning-charge", title: "Miostimulacija", text: "Kontrakcija mišićnih vlakana za tonus i jačanje." },
          { icon: "bi bi-droplet", title: "Limfna drenaža", text: "Ritmični impulsi koji podstiču cirkulaciju i smanjuju osećaj težine u nogama." },
          { icon: "bi bi-activity", title: "Mikrostrujna terapija", text: "Niskointenzivna struja koja se koristi i za tretmane lica." },
          { icon: "bi bi-soundwave", title: "Ultrazvuk", text: "Ultrazvučni piling i podrška regeneraciji kože." },
        ],
      },
      {
        type: "paragraph",
        text: "Terapeut pre prvog tretmana radi kratku procenu - pita o cilju (tonus, opuštanje, nega kože), zdravstvenom stanju i eventualnim kontraindikacijama, i na osnovu toga predlaže kombinaciju i broj tretmana. Serija se najčešće preporučuje jer su efekti kumulativni, a pojedinačni tretman je uvod, ne konačan rezultat.",
      },
      {
        type: "quote",
        text: "Cilj nije da nabijemo što više tehnologije u jedan tretman, već da izaberemo ono što konkretnoj osobi zaista treba.",
        meta: "Estetik Lab, tim terapeuta",
      },
    ]),
  },
  {
    slug: "limfna-drenaza-cena-efekti",
    title: "Limfna drenaža – cena, efekti i za koga je pravi izbor",
    excerpt: "Limfna drenaža pomaže kod osećaja teških nogu i zadržavanja tečnosti. Objašnjavamo kako tretman izgleda, šta utiče na cenu i kome je najviše preporučljiv.",
    categorySlugs: ["telo-i-oblikovanje"],
    tagSlugs: ["limfna-drenaza-cena", "esma-favorit-novi-sad"],
    statusOffset: -7,
    seo: {
      title: "Limfna drenaža - cena, efekti i za koga je | Estetik Lab",
      description: "Šta utiče na cenu limfne drenaže, kako tretman izgleda i kome se najviše preporučuje.",
      keywords: ["limfna drenaža cena", "limfna drenaža", "detoksikacija"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Limfna drenaža je tretman koji ritmičnim pritiskom - ručno ili aparatom, poput ESMA Favorit sistema - podstiče kretanje limfe kroz tkivo, pomažući organizmu da se rastereti viška tečnosti. Najčešće se traži zbog osećaja \"teških nogu\", otoka na kraju dana ili kao deo oporavka posle napornih treninga.",
      },
      { type: "heading", level: 3, text: "Šta utiče na cenu" },
      {
        type: "list",
        ordered: false,
        items: [
          "Regija koja se tretira (noge, stomak, celo telo)",
          "Da li se radi pojedinačni tretman ili paket od više seansi (paketi izlaze povoljnije po tretmanu)",
          "Da li se kombinuje sa drugim modalitetom (npr. mikrostrujnom terapijom)",
        ],
      },
      {
        type: "paragraph",
        text: "Tačan cenovnik uvek pogledajte na stranici konkretne usluge, jer se cene paketa periodično ažuriraju. Ono što je konstantno je preporuka: za osećaj olakšanja posle jednog tretmana, ali za primetniju i dužu razliku, terapeuti najčešće predlažu seriju od 5 do 10 tretmana, u razmaku od nekoliko dana.",
      },
      {
        type: "paragraph",
        text: "Limfna drenaža se ne preporučuje osobama sa akutnim infekcijama, trombozom ili određenim srčanim i bubrežnim stanjima - to je jedan od prvih pitanja koje terapeut postavlja na konsultaciji.",
      },
    ]),
  },
  {
    slug: "anticelulit-tretmani-celulit",
    title: "Anticelulit tretmani – šta zaista pomaže kod celulita",
    excerpt: "Celulit je normalna pojava kod većine žena, a ne stanje koje se \"leči\". Objašnjavamo koji tretmani mogu doprineti izgledu kože i šta realno da očekujete.",
    categorySlugs: ["telo-i-oblikovanje"],
    tagSlugs: ["celulit-tretman", "anticelulit-masaza"],
    statusOffset: -3,
    seo: {
      title: "Anticelulit tretmani - šta pomaže kod celulita | Estetik Lab",
      description: "Koji anticelulit tretmani postoje, kako deluju i kakvi rezultati su realno očekivani.",
      keywords: ["celulit tretman", "anticelulit masaža", "elektrolipoliza"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Prvo najvažnije: celulit je potpuno normalna pojava koja pogađa veliku većinu žena, bez obzira na težinu ili nivo fizičke aktivnosti, i nastaje zbog strukture vezivnog tkiva ispod kože. Nijedan tretman ga ne \"leči\" niti trajno uklanja - ono što tretmani mogu jeste da doprinesu izgledu kože, cirkulaciji i osećaju zategnutosti, u kombinaciji sa zdravim navikama.",
      },
      { type: "heading", level: 3, text: "Pristupi koje nudimo" },
      {
        type: "table",
        table: {
          columns: ["Tretman", "Fokus"],
          rows: [
            { label: "Anticelulit masaža", values: ["Ručna stimulacija cirkulacije i limfne drenaže"] },
            { label: "Elektrolipoliza", values: ["Ciljana električna stimulacija problematičnih zona"] },
            { label: "Kombinovani ESMA tretman", values: ["Limfna drenaža + ultrazvuk + zatezanje kože u jednoj seansi"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Terapeut na konsultaciji procenjuje tip i stepen izraženosti celulita i predlaže kombinaciju koja ima smisla - najčešće serija tretmana, uz savet o hidrataciji i kretanju, jer aparatura sama po sebi radi bolje kao deo šire rutine, a ne kao izolovano rešenje.",
      },
    ]),
  },

  // --- zakazani (8) ---
  {
    slug: "lifting-lica-bez-igala",
    title: "Lifting lica bez igala – šta stvarno možete da očekujete",
    excerpt: "Mikrostrujni lifting deluje na nivou mišića lica, bez igala i bez oporavka. Objašnjavamo princip rada, trajanje efekta i realna očekivanja.",
    categorySlugs: ["lice-i-lifting"],
    tagSlugs: ["lifting-lica-bez-igala", "esma-favorit-novi-sad"],
    statusOffset: 2,
    seo: {
      title: "Lifting lica bez igala - kako radi mikrostrujni lifting | Estetik Lab",
      description: "Kako mikrostrujni lifting lica deluje na tonus mišića, koliko traje efekat i za koga je pogodan.",
      keywords: ["lifting lica bez igala", "miolifting lica", "mikrostrujna terapija"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Starenje lica ne dešava se samo na koži - opuštaju se i duboki mišićni slojevi koji drže konturu obraza, vilice i vrata. Klasične kreme i površinski tretmani ne dopiru do tog nivoa. Mikrostrujni lifting radi drugačije: niskointenzivna struja stimuliše mišiće lica direktno, slično treningu za lice.",
      },
      { type: "heading", level: 3, text: "Šta tretman uključuje" },
      {
        type: "list",
        ordered: true,
        items: [
          "Mikrostrujna stimulacija dubokih mišića lica",
          "Podrška tonusu i konturi obraza i vilice",
          "Poboljšanje cirkulacije i sjaja kože kao dodatni efekat",
        ],
      },
      {
        type: "paragraph",
        text: "Tretman je bezbolan, bez perioda oporavka - klijent može odmah nastaviti dan. Efekat posle jednog tretmana je suptilan i privremen; za primetniju i dužu razliku terapeuti preporučuju seriju tretmana, uz periodično održavanje. Ovo nije zamena za hiruršku intervenciju, već neinvazivna alternativa za onе koji žele postepen, prirodniji pristup.",
      },
    ]),
  },
  {
    slug: "hifu-lifting-kako-radi",
    title: "HIFU lifting – kako radi neinvazivno zatezanje kože",
    excerpt: "HIFU koristi fokusirani ultrazvuk da podstakne prirodnu proizvodnju kolagena u dubljim slojevima kože. Objašnjavamo princip rada i kada se vidi razlika.",
    categorySlugs: ["lice-i-lifting"],
    tagSlugs: ["hifu-lifting"],
    statusOffset: 5,
    seo: {
      title: "HIFU lifting - kako deluje neinvazivno zatezanje kože | Estetik Lab",
      description: "Kako HIFU fokusirani ultrazvuk podstiče kolagen, koliko traje tretman i kada su rezultati vidljivi.",
      keywords: ["hifu lifting", "zatezanje kože", "anti-aging"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "HIFU (High-Intensity Focused Ultrasound) je tehnologija koja fokusiranim ultrazvučnim talasima cilja dublje slojeve kože i potkožnog tkiva, bez oštećenja površinske kože. Cilj je da se podstakne prirodna proizvodnja kolagena, što telu treba vremena da samo izgradi.",
      },
      { type: "heading", level: 3, text: "Šta znači \"neinvazivno\"" },
      {
        type: "paragraph",
        text: "Za razliku od hirurškog liftinga, HIFU nema rezove, anesteziju ni period oporavka - klijent može odmah nastaviti sa svakodnevnim aktivnostima. Sam tretman traje od nekoliko desetina minuta do sat vremena, u zavisnosti od tretirane zone (lice, vrat, jagodice).",
      },
      {
        type: "paragraph",
        text: "Ono što je važno postaviti realno: efekat se ne vidi odmah na izlasku iz salona. Kolagen se gradi postepeno, pa se puni efekat obično primećuje tokom narednih nedelja do meseci, a rezultat zavisi od individualnih karakteristika kože i starosne strukture kolagena. Terapeut na konsultaciji procenjuje da li je HIFU pravi izbor za konkretnu zonu i cilj.",
      },
    ]),
  },
  {
    slug: "ultrazvuk-za-lice-piling",
    title: "Ultrazvuk za lice – piling, kavitacija i regeneracija kože",
    excerpt: "Ultrazvučni tretmani za lice imaju više primena - od dubinskog čišćenja do podrške regeneraciji kože. Objašnjavamo razlike i kako se biraju.",
    categorySlugs: ["laser-i-koza"],
    tagSlugs: ["ultrazvuk-za-lice"],
    statusOffset: 9,
    seo: {
      title: "Ultrazvuk za lice - piling i regeneracija kože | Estetik Lab",
      description: "Šta je ultrazvučni piling, kako deluje na kožu lica i kome je najviše preporučljiv.",
      keywords: ["ultrazvuk za lice", "ultrazvučni piling", "sjaj kože"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Ultrazvučni tretmani za lice koriste vibracije visoke frekvencije u nekoliko različitih svrha - od nežnog uklanjanja mrtvih ćelija kože i nečistoća iz pora (ultrazvučni piling), do podrške cirkulaciji i utrljavanju aktivnih sastojaka dublje u kožu.",
      },
      { type: "heading", level: 3, text: "Za koga je pogodan" },
      {
        type: "list",
        ordered: false,
        items: [
          "Za dubinsko čišćenje kože sklone zamršenim porama",
          "Kao priprema kože pre drugih tretmana lica",
          "Za osećaj svežine i sjaja kože bez agresivnog piling efekta",
        ],
      },
      {
        type: "paragraph",
        text: "Tretman je nežan i bez oporavka, pogodan i za osetljiviju kožu, ali kao i kod svih tretmana lica, terapeut prvo procenjuje tip kože i eventualne kontraindikacije (aktivna akne infekcija, otvorene rane, određena kožna stanja).",
      },
    ]),
  },
  {
    slug: "laserska-epilacija-tip-lasera",
    title: "Laserska epilacija – kako izabrati pravi tip lasera za vašu kožu",
    excerpt: "Ne postoji jedan laser koji odgovara svima. Objašnjavamo na šta terapeut obraća pažnju pri izboru parametara za tip kože i dlake.",
    categorySlugs: ["laser-i-koza"],
    tagSlugs: ["laser-za-kozu"],
    statusOffset: 12,
    seo: {
      title: "Laserska epilacija - kako se bira pravi laser | Estetik Lab",
      description: "Šta utiče na izbor parametara laserske epilacije za različite tipove kože i dlake.",
      keywords: ["laser za kožu", "laserska epilacija", "trajna epilacija"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Laserska epilacija radi na principu da laserska svetlost cilja pigment (melanin) u korenu dlake, oštećujući folikul dovoljno da uspori ili zaustavi rast. Zato tip kože i boja dlake direktno utiču na to koji parametri (talasna dužina, snaga, dužina impulsa) će dati najbolji i najbezbedniji rezultat.",
      },
      { type: "heading", level: 3, text: "Zašto konsultacija nije formalnost" },
      {
        type: "paragraph",
        text: "Na prvom pregledu terapeut procenjuje ton kože, boju i debljinu dlake, kao i istoriju osetljivosti kože, i na osnovu toga podešava aparat. Moderni medicinski laseri imaju prilagodljive parametre baš zbog toga - jedno podešavanje koje odlično radi za jednu osobu može biti potpuno pogrešno za drugu.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Tamnija koža obično zahteva drugačije parametre nego svetlija",
          "Fine, svetle dlake sporije reaguju na lasersku epilaciju od tamnih",
          "Rezultati se grade kroz seriju tretmana, jer laser deluje samo na dlake u aktivnoj fazi rasta",
        ],
      },
      {
        type: "paragraph",
        text: "Zato je serija od više tretmana, u preporučenim razmacima, standardan i očekivan deo procesa, a ne znak da nešto ne funkcioniše.",
      },
    ]),
  },
  {
    slug: "ems-oblikovanje-tela",
    title: "EMS oblikovanje tela – šta je i kome je namenjeno",
    excerpt: "EMS tehnologija kombinuje električnu stimulaciju mišića sa radiofrekvencijom. Objašnjavamo princip rada i realna očekivanja od serije tretmana.",
    categorySlugs: ["telo-i-oblikovanje"],
    tagSlugs: ["oblikovanje-tela"],
    statusOffset: 16,
    seo: {
      title: "EMS oblikovanje tela - princip rada i za koga je | Estetik Lab",
      description: "Kako EMS + RF tretmani za oblikovanje tela rade i šta realno možete da očekujete od serije tretmana.",
      keywords: ["oblikovanje tela", "ems tretman", "body sculpt"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "EMS (Electrical Muscle Stimulation) tretmani za oblikovanje tela kombinuju električnu stimulaciju mišića sa radiofrekvencijom koja zagreva dublje slojeve tkiva. Cilj kombinacije je dvostruk - podrška tonusu mišića i istovremeno rad na zatezanju kože iznad njih.",
      },
      { type: "heading", level: 3, text: "Kako izgleda tretman" },
      {
        type: "paragraph",
        text: "Elektrode se postavljaju na ciljanu zonu (najčešće stomak, butine ili zadnjica), a aparat naizmenično radi kontrakcije i radiofrekventno zagrevanje. Tretman se najčešće opisuje kao intenzivan, ali podnošljiv - nema znojenja ni fizičkog napora kakav bi imao klasičan trening iste zone.",
      },
      {
        type: "paragraph",
        text: "Kao i kod svih tretmana ove vrste, jedan tretman daje osećaj, a rezultat gradi serija - terapeuti obično predlažu paket od više seansi, uz napomenu da rezultati zavise od polazne tačke, načina života i redovnosti dolazaka, ne samo od same tehnologije.",
      },
    ]),
  },
  {
    slug: "masaza-vs-aparaturni-tretmani",
    title: "Klasična masaža vs aparaturni tretmani – šta izabrati",
    excerpt: "Ručna masaža i aparaturni tretmani rade na različite načine i za različite ciljeve. Objašnjavamo kada je jedno bolji izbor od drugog, ili kombinacija oba.",
    categorySlugs: ["masaza-i-relaksacija"],
    tagSlugs: ["relaksaciona-masaza"],
    statusOffset: 19,
    seo: {
      title: "Klasična masaža ili aparaturni tretman - šta izabrati | Estetik Lab",
      description: "Razlike između ručne masaže i aparaturnih tretmana, i kada se najbolje kombinuju.",
      keywords: ["relaksaciona masaža", "antistres masaža", "terapeutska masaža"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Pitanje \"masaža ili aparat\" zapravo nema jedan tačan odgovor - zavisi od toga šta je cilj tog dana. Ručna masaža radi na opuštanju mišićnog tkiva, smanjenju napetosti i psihičkom opuštanju kroz direktan dodir i pritisak terapeuta, prilagođen u realnom vremenu.",
      },
      { type: "heading", level: 3, text: "Kada birati šta" },
      {
        type: "table",
        table: {
          columns: ["Cilj", "Bolji izbor"],
          rows: [
            { label: "Opuštanje i smanjenje stresa", values: ["Relaksaciona / antistres masaža"] },
            { label: "Bol u leđima ili napetost od sedenja", values: ["Terapeutska masaža"] },
            { label: "Tonus mišića i oblikovanje", values: ["ESMA / EMS aparaturni tretman"] },
            { label: "Detoksikacija i lagane noge", values: ["Limfna drenaža (ručna ili aparaturna)"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Dobra vest je da se ova dva pristupa odlično kombinuju - mnogi klijenti naizmenično ili u istoj poseti kombinuju ručnu masažu sa aparaturnim delom tretmana. Terapeut na konsultaciji može predložiti kombinaciju koja odgovara vašem cilju i raspoloživom vremenu.",
      },
    ]),
  },
  {
    slug: "pre-i-posle-esma-tretmana-vodic",
    title: "Šta da očekujete pre i posle ESMA tretmana – vodič za početnike",
    excerpt: "Prvi put na ESMA tretmanu? Evo praktičnog vodiča - šta poneti, na šta se pripremiti i kako da nega posle tretmana bude što efikasnija.",
    categorySlugs: ["vodic-i-saveti", "esma-tretmani"],
    tagSlugs: ["pre-i-posle-tretmana", "esma-favorit-novi-sad"],
    statusOffset: 23,
    seo: {
      title: "Pre i posle ESMA tretmana - vodič za početnike | Estetik Lab",
      description: "Praktičan vodič šta da očekujete pre prve posete i kako da nega posle ESMA tretmana bude efikasnija.",
      keywords: ["pre i posle tretmana", "esma favorit novi sad", "esma tretmani"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Pre tretmana" },
      {
        type: "list",
        ordered: true,
        items: [
          "Dođite bez losiona ili ulja na koži tretirane zone - koža treba da bude čista",
          "Popijte dovoljno vode tokom dana - dobra hidratacija olakšava rad limfnog sistema",
          "Obavezno recite terapeutu o trudnoći, pejsmejkeru, epilepsiji ili akutnim upalama kože",
          "Nosite udobnu odeću koja se lako skida sa zone koja se tretira",
        ],
      },
      { type: "heading", level: 2, text: "Posle tretmana" },
      {
        type: "list",
        ordered: true,
        items: [
          "Popijte čašu vode odmah po završetku - pomaže procesu koji je tretman pokrenuo",
          "Lagana šetnja istog dana je poželjna, izbegavajte intenzivan trening neposredno posle",
          "Blaga crvenilo ili osećaj zategnutosti su normalni i prolaze u toku dana",
          "Za tretmane lica, izbegavajte agresivnu kozmetiku prvih 24 sata",
        ],
      },
      {
        type: "paragraph",
        text: "Ako niste sigurni da li se nešto specifično odnosi na vas (lekovi, hronična stanja, trudnoća), najbolje je da to pomenete terapeutu pre prvog tretmana - konsultacija postoji baš zato da se tretman prilagodi vama, a ne obrnuto.",
      },
    ]),
  },
  {
    slug: "koliko-tretmana-je-potrebno",
    title: "Koliko tretmana je potrebno za vidljive rezultate",
    excerpt: "Jedno od najčešćih pitanja klijenata. Objašnjavamo zašto se estetski tretmani rade u serijama i kako se broj tretmana određuje.",
    categorySlugs: ["vodic-i-saveti"],
    tagSlugs: ["pre-i-posle-tretmana"],
    statusOffset: 26,
    seo: {
      title: "Koliko tretmana je potrebno za rezultate | Estetik Lab",
      description: "Zašto se estetski i wellness tretmani rade u seriji, i od čega zavisi koliko tretmana je potrebno.",
      keywords: ["pre i posle tretmana", "koliko tretmana", "esma tretmani"],
    },
    content: blocks([
      {
        type: "paragraph",
        text: "Skoro svaki tretman u ovoj kategoriji - miostimulacija, limfna drenaža, HIFU, laserska epilacija - deluje kumulativno. To znači da jedan tretman pokreće proces (kontrakciju, cirkulaciju, proizvodnju kolagena, oštećenje folikula dlake), ali da se puni efekat gradi tek kroz seriju, jer telo reaguje postepeno.",
      },
      { type: "heading", level: 3, text: "Od čega zavisi broj tretmana" },
      {
        type: "list",
        ordered: false,
        items: [
          "Cilj tretmana (održavanje vs. primetna promena)",
          "Polazno stanje kože/mišića/dlake",
          "Tip tretmana - neki (npr. laserska epilacija) prate biološki ciklus koji se ne može ubrzati",
          "Individualne razlike u metabolizmu i regeneraciji",
        ],
      },
      {
        type: "paragraph",
        text: "Zato terapeuti na konsultaciji retko obećavaju tačan broj unapred bez procene uživo - umesto toga daju opšti okvir (najčešće između 5 i 10 tretmana za većinu ESMA i telo tretmana) i prilagođavaju ga posle prvih par seansi, kada se vidi kako organizam reaguje.",
      },
    ]),
  },
];

// ---------------------------------------------------------------------------
// Upsert funkcije
// ---------------------------------------------------------------------------

async function upsertCategories() {
  const bySlug = {};
  for (const def of categoryDefs) {
    const doc = await Category.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, shortDescription: def.shortDescription, parent: null },
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

// resolves who posts get authored as. Priority: explicit POST_SEED_AUTHOR_EMAIL
// env var (set this if you want a specific admin/employee credited), otherwise
// the earliest-created user with the "admin" role.
async function resolveAuthorId() {
  const email = process.env.POST_SEED_AUTHOR_EMAIL;
  if (email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new Error(`POST_SEED_AUTHOR_EMAIL="${email}" ne odgovara nijednom postojećem User-u.`);
    return user._id;
  }

  const adminRole = await Role.findOne({ name: "admin" });
  if (!adminRole) throw new Error('Rola "admin" ne postoji - pokreni prvo run-roles-seed.js.');

  const admin = await User.findOne({ role: adminRole._id }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error(
      "Nijedan User nema rolu \"admin\" - Post.author je obavezan. Kreiraj admin nalog ili postavi POST_SEED_AUTHOR_EMAIL u .env na email postojećeg zaposlenog/admina."
    );
  }
  return admin._id;
}

async function upsertPosts(categoriesBySlug, tagsBySlug, authorId) {
  const created = [];
  for (const def of postDefs) {
    const categories = def.categorySlugs.map((slug) => {
      const cat = categoriesBySlug[slug];
      if (!cat) throw new Error(`Post "${def.slug}" referenciše nepostojeći categorySlug "${slug}".`);
      return cat._id;
    });

    const tags = def.tagSlugs.map((slug) => {
      const tag = tagsBySlug[slug];
      if (!tag) throw new Error(`Post "${def.slug}" referenciše nepostojeći tagSlug "${slug}".`);
      return tag._id;
    });

    const isFuture = def.statusOffset > 0;
    const status = isFuture ? "scheduled" : "published";
    const scheduledFor = isFuture ? dayOffset(def.statusOffset) : null;
    const publishedAt = isFuture ? null : dayOffset(def.statusOffset);

    const payload = {
      title: def.title,
      slug: def.slug,
      excerpt: def.excerpt,
      content: def.content,
      coverImage: placeholderImage(def.title),
      categories,
      tags,
      author: authorId,
      status,
      scheduledFor,
      publishedAt,
      seo: def.seo,
      isIndexable: true,
      readingTimeMinutes: computeReadingTime(def.content),
    };

    const doc = await Post.findOneAndUpdate({ slug: def.slug }, payload, {
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

export async function seedPostContent() {
  const categoriesBySlug = await upsertCategories();
  const tagsBySlug = await upsertTags();
  const authorId = await resolveAuthorId();
  const posts = await upsertPosts(categoriesBySlug, tagsBySlug, authorId);

  const summary = {
    categories: Object.keys(categoriesBySlug).length,
    tags: Object.keys(tagsBySlug).length,
    posts: posts.length,
    published: posts.filter((p) => p.status === "published").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    author: authorId.toString(),
  };

  logInfo("Blog post sadržaj seedovan", summary);
  return summary;
}

export default seedPostContent;