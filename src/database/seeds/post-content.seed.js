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
      { type: "heading", level: 2, text: "Šta je miostimulacija i zašto je postala jedan od najpopularnijih tretmana za tonus mišića" },
      {
        type: "paragraph",
        text: "Miostimulacija je profesionalna metoda stimulacije mišića pomoću pažljivo kontrolisanih električnih impulsa. Ova tehnologija već decenijama ima značajnu primenu u fizioterapiji, sportskoj medicini, rehabilitaciji i estetskim tretmanima, gde se koristi kao podrška očuvanju ili poboljšanju mišićnog tonusa. Zahvaljujući savremenim aparatima, poput ESMA Favorit sistema, intenzitet i način stimulacije mogu se precizno prilagoditi potrebama svake osobe i cilju tretmana.",
      },
      {
        type: "paragraph",
        text: "Iako mnogi miostimulaciju povezuju isključivo sa oblikovanjem tela, njena primena je mnogo šira. Koristi se kao dopuna redovnoj fizičkoj aktivnosti, za aktivaciju određenih mišićnih grupa, podršku osobama koje dugo sede ili imaju smanjenu fizičku aktivnost, kao i u pojedinim programima rehabilitacije kada to preporuči stručnjak. Važno je naglasiti da miostimulacija nije zamena za vežbanje, već metoda koja može doprineti postizanju boljih rezultata kada se kombinuje sa zdravim životnim navikama.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Važno je znati",
        text: "Miostimulacija nije čudesno rešenje koje zamenjuje fizičku aktivnost ili pravilnu ishranu. Najbolji rezultati postižu se kada je tretman deo šireg plana koji uključuje kretanje, balansiranu ishranu, dovoljno sna i redovne dolaske na tretmane.",
      },
      { type: "heading", level: 2, text: "Kako funkcioniše kontrakcija mišića" },
      {
        type: "paragraph",
        text: "Svaki pokret koji napravimo započinje u nervnom sistemu. Kada želimo da pomerimo ruku, ustanemo sa stolice ili napravimo korak, mozak šalje električni signal kroz nerve do odgovarajućih mišića. Kada signal stigne do mišićnih vlakana, ona se kontrahuju i nastaje pokret. Bez ovog električnog impulsa mišići ne bi mogli da izvrše svoju funkciju.",
      },
      {
        type: "paragraph",
        text: "Miostimulacija koristi isti prirodni princip rada organizma. Umesto impulsa koji dolazi iz centralnog nervnog sistema, aparat preko elektroda na površini kože šalje pažljivo kontrolisane električne impulse koji izazivaju kontrakciju mišića. Parametri poput intenziteta, frekvencije i trajanja impulsa podešavaju se individualno kako bi tretman bio bezbedan, prijatan i prilagođen cilju koji želimo da postignemo.",
      },
      {
        type: "quote",
        text: "Osnovni princip miostimulacije nije stvaranje neprirodnog pokreta, već kontrolisana stimulacija prirodnog procesa kontrakcije mišića.",
        meta: "Estetik Lab",
      },
      { type: "heading", level: 2, text: "Tesla-Tone 24 – naš tretman miostimulacije na ESMA Favorit aparatu" },
      {
        type: "paragraph",
        text: "U Estetik Lab-u miostimulaciju sprovodimo kroz tretman Tesla-Tone 24, koji radi na profesionalnom ESMA Favorit sistemu. Kroz veliki broj nezavisnih kanala aparat šalje impulse koji izazivaju kontrakcije mišićnih vlakana na više zona tela istovremeno, uključujući i duboke stabilizatore koje je teško direktno aktivirati klasičnim vežbanjem. Tretman traje 45 minuta i ne zahteva nikakvu pripremu osim čiste kože na tretiranoj zoni.",
      },
      {
        type: "serviceReference",
        title: "Tesla-Tone 24 – miostimulacija celog tela",
        text: "Naš tretman miostimulacije za tonus i jačanje mišića, bez znojenja i opterećenja zglobova. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
      },
      {
        type: "serviceReference",
        title: "Paket od 5 tretmana – povoljnija cena po tretmanu",
        text: "Ako planirate seriju, paket od 5 Tesla-Tone 24 tretmana izlazi povoljnije po tretmanu nego pojedinačne posete.",
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/tesla-tone-24-5-tretmana" },
      },
      { type: "heading", level: 2, text: "Kako izgleda prvi dolazak na tretman miostimulacije" },
      {
        type: "paragraph",
        text: "Prvi dolazak nije rezervisan samo za izvođenje tretmana, već predstavlja priliku da terapeut upozna vaše potrebe, ciljeve i zdravstveno stanje. Svaka osoba dolazi sa drugačijim očekivanjima - neko želi da poboljša tonus stomaka nakon perioda fizičke neaktivnosti, neko želi podršku oporavku posle intenzivnih treninga, dok je drugima cilj osećaj stabilnijih i aktivnijih mišića. Upravo zbog toga individualna procena predstavlja važan deo svakog profesionalnog tretmana.",
      },
      {
        type: "paragraph",
        text: "Tokom konsultacije terapeut razgovara sa klijentom o svakodnevnim navikama, nivou fizičke aktivnosti, prethodnim povredama, operacijama, hroničnim bolestima, terapiji koju osoba koristi, kao i o eventualnim kontraindikacijama. Na osnovu prikupljenih informacija određuje se da li je miostimulacija odgovarajući izbor i koji program rada će dati najbolje rezultate.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Kratak razgovor o ciljevima tretmana.",
          "Procena zdravstvenog stanja i mogućih kontraindikacija.",
          "Odabir regije tela koja će se tretirati.",
          "Određivanje odgovarajućeg programa stimulacije.",
          "Objašnjenje kako će tretman izgledati i šta možete da očekujete.",
        ],
      },
      {
        type: "callout",
        variant: "success",
        title: "Individualni pristup",
        text: "Ne postoji univerzalni program koji odgovara svima. Parametri stimulacije biraju se u skladu sa vašim ciljevima, fizičkom spremom, osetljivošću i regijom tela koja se tretira.",
      },
      { type: "heading", level: 2, text: "Kako izgleda sam tretman" },
      {
        type: "paragraph",
        text: "Nakon pripreme kože terapeut postavlja elektrode na unapred određene mišićne grupe. Njihov položaj nije slučajan, već zavisi od anatomije mišića i željenog efekta tretmana. Nakon postavljanja elektroda aparat se postepeno uključuje, a intenzitet stimulacije povećava se postepeno kako bi se organizam prilagodio impulsima.",
      },
      {
        type: "paragraph",
        text: "Tokom rada aparat izaziva ritmične kontrakcije mišića koje prate unapred definisan program. Terapeut tokom cele seanse prati reakciju organizma i po potrebi prilagođava intenzitet stimulacije. Cilj nije da stimulacija bude što jača, već da bude dovoljno intenzivna da aktivira mišiće uz očuvanje prijatnog osećaja tokom tretmana.",
      },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-clipboard-check", title: "Priprema", text: "Koža tretirane regije treba da bude čista i bez krema ili ulja kako bi elektrode ostvarile dobar kontakt." },
          { icon: "bi bi-lightning", title: "Stimulacija", text: "Električni impulsi izazivaju kontrolisane kontrakcije mišića koje terapeut prati i prilagođava tokom cele seanse." },
          { icon: "bi bi-clock-history", title: "Završetak", text: "Po završetku tretmana elektrode se uklanjaju, a terapeut daje preporuke za naredni dolazak i održavanje postignutih rezultata." },
        ],
      },
      { type: "heading", level: 2, text: "Kako izgleda osećaj tokom tretmana" },
      {
        type: "paragraph",
        text: "Većina klijenata opisuje osećaj kao ritmično zatezanje mišića praćeno blagim trncima ispod elektroda. Intenzitet kontrakcije postepeno raste dok terapeut ne pronađe nivo koji je dovoljno snažan da aktivira mišiće, ali i dalje prijatan za klijenta. Tokom tretmana ne bi trebalo da postoji jak bol ili osećaj pečenja. Ukoliko se javi nelagodnost, intenzitet se odmah prilagođava.",
      },
      {
        type: "paragraph",
        text: "Nakon završetka tretmana moguće je osetiti blagi umor mišića, sličan onome koji se javlja nakon kvalitetnog treninga. Kod pojedinih osoba može se javiti prolazno crvenilo kože na mestu gde su bile postavljene elektrode, što je očekivana reakcija i uglavnom nestaje ubrzo nakon tretmana.",
      },
      {
        type: "quote",
        text: "Profesionalno izvedena miostimulacija ne treba da bude bolna. Cilj tretmana nije neprijatnost, već efikasna i kontrolisana aktivacija mišića.",
        meta: "Tim Estetik Lab",
      },
      { type: "heading", level: 2, text: "Koje regije tela se najčešće tretiraju" },
      {
        type: "table",
        table: {
          columns: ["Najčešći cilj tretmana"],
          rows: [
            { label: "Stomak", values: ["Podrška aktivaciji trbušnih mišića i poboljšanju tonusa."] },
            { label: "Gluteus", values: ["Aktivacija mišića zadnjice i podrška oblikovanju konture."] },
            { label: "Butine", values: ["Stimulacija mišića prednje i zadnje lože uz podršku tonusu."] },
            { label: "Nadlaktice", values: ["Poboljšanje tonusa mišića ruku kao dopuna fizičkoj aktivnosti."] },
            { label: "Leđa", values: ["Aktivacija pojedinih mišićnih grupa i podrška pravilnom držanju tela."] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Izbor regije zavisi od vaših ciljeva i procene terapeuta. Kod pojedinih klijenata fokus je na jednoj regiji, dok se kod drugih pravi plan koji obuhvata više zona kroz seriju tretmana. Profesionalni pristup podrazumeva postepeno planiranje tretmana kako bi organizam imao dovoljno vremena da se prilagodi stimulaciji.",
      },
      { type: "heading", level: 2, text: "Koliko traje tretman i koliko često se preporučuje" },
      {
        type: "paragraph",
        text: "Jedan tretman Tesla-Tone 24 traje 45 minuta. Većina klijenata dolazi u serijama, jer se efekti grade postepeno. Broj tretmana nije isti za sve i zavisi od početnog stanja, ciljeva, redovnosti dolazaka i načina života - terapeuti najčešće predlažu seriju od 5 do 10 tretmana.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Rezultati se grade postepeno",
        text: "Miostimulacija deluje kumulativno. Jedan tretman može pružiti osećaj aktivacije mišića, ali se vidljiviji rezultati očekuju kroz pravilno planiranu seriju tretmana u kombinaciji sa zdravim životnim navikama.",
      },

      { type: "heading", level: 2, text: "Kome je miostimulacija namenjena" },
      {
        type: "paragraph",
        text: "Miostimulacija nije rezervisana samo za sportiste ili osobe koje žele estetske promene. Zahvaljujući mogućnosti prilagođavanja intenziteta i programa rada, tretman može biti koristan različitim grupama ljudi. Najvažnije je da se pre početka napravi procena zdravstvenog stanja i definiše jasan cilj tretmana. Na osnovu toga terapeut određuje da li je miostimulacija odgovarajući izbor i kako će izgledati plan tretmana.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Osobama koje žele da poboljšaju tonus pojedinih mišićnih grupa.",
          "Ljudima koji vode pretežno sedeći način života i žele dodatnu aktivaciju mišića.",
          "Rekreativcima kao dopuna redovnim treninzima.",
          "Sportistima u periodima između intenzivnih treninga, u skladu sa planom oporavka.",
          "Osobama koje žele podršku oblikovanju tela u kombinaciji sa pravilnom ishranom i fizičkom aktivnošću.",
          "Klijentima koji se vraćaju fizičkoj aktivnosti nakon perioda neaktivnosti, uz preporuku i saglasnost lekara kada je to potrebno.",
        ],
      },
      {
        type: "paragraph",
        text: "Važno je razumeti da ciljevi tretmana nisu isti za svakoga. Nekome je prioritet osećaj čvršćih mišića, drugome podrška fizičkoj aktivnosti, dok neko želi da unapredi izgled određene regije tela. Upravo zato profesionalni tretman podrazumeva individualni pristup, a ne isti program za svakog klijenta.",
      },
      { type: "heading", level: 2, text: "Kada se miostimulacija ne preporučuje" },
      {
        type: "paragraph",
        text: "Iako se smatra bezbednom metodom kada se pravilno primenjuje, postoje situacije u kojima se miostimulacija ne izvodi ili je potrebno prethodno mišljenje lekara. Bezbednost klijenta uvek ima prednost u odnosu na izvođenje tretmana.",
      },
      {
        type: "callout",
        variant: "warning",
        title: "Kontraindikacije",
        text: "Pre svakog tretmana obavezno obavestite terapeuta o svim zdravstvenim problemima, implantima, lekovima koje koristite i eventualnoj trudnoći. Na taj način tretman može biti prilagođen ili odložen ukoliko postoji razlog za to.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Trudnoća.",
          "Ugrađen pejsmejker ili drugi elektronski medicinski implantati.",
          "Epilepsija.",
          "Akutne infekcije i povišena telesna temperatura.",
          "Otvorene rane ili aktivna upala kože na regiji koja se tretira.",
          "Pojedina ozbiljna kardiovaskularna oboljenja.",
          "Stanja kod kojih lekar proceni da električna stimulacija nije preporučljiva.",
        ],
      },
      {
        type: "paragraph",
        text: "Lista kontraindikacija može biti šira u zavisnosti od zdravstvenog stanja klijenta i vrste tretmana koji se planira. Zato razgovor sa terapeutom nije formalnost, već važan deo bezbednog izvođenja svakog tretmana.",
      },
      { type: "heading", level: 2, text: "Miostimulacija ili klasičan trening – u čemu je razlika?" },
      {
        type: "paragraph",
        text: "Jedna od najčešćih zabluda jeste da miostimulacija može potpuno da zameni fizičku aktivnost. Iako oba pristupa dovode do kontrakcije mišića, njihov način delovanja i krajnji ciljevi nisu isti. Profesionalni terapeuti zato miostimulaciju posmatraju kao dopunu, a ne zamenu za aktivan način života.",
      },
      {
        type: "table",
        table: {
          columns: ["Aktivacija mišića", "Opterećenje zglobova", "Potrošnja energije"],
          rows: [
            { label: "Tesla-Tone 24 (miostimulacija)", values: ["Električni impulsi izazivaju kontrolisanu kontrakciju.", "Bez opterećenja zglobova.", "Niža u odnosu na intenzivan trening."] },
            { label: "Klasičan trening", values: ["Kontrakciju pokreće nervni sistem tokom pokreta.", "Zavisi od vrste vežbi i intenziteta.", "Znatno zavisi od trajanja i intenziteta aktivnosti."] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Drugim rečima, miostimulacija može biti odlična podrška fizičkoj aktivnosti, ali ne može da zameni sve benefite koje donose redovno kretanje, vežbanje, razvoj kondicije i pravilna ishrana.",
      },
      { type: "heading", level: 2, text: "Kako postići najbolje rezultate" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-calendar-check", title: "Redovni dolasci", text: "Najbolji rezultati postižu se kroz pravilno planiranu seriju tretmana, a ne samo jednom posetom." },
          { icon: "bi bi-droplet-half", title: "Dobra hidratacija", text: "Dovoljan unos tečnosti važan je za normalno funkcionisanje organizma i oporavak nakon tretmana." },
          { icon: "bi bi-heart-pulse", title: "Fizička aktivnost", text: "Miostimulacija daje najbolje rezultate kada se kombinuje sa redovnim kretanjem i vežbanjem." },
          { icon: "bi bi-egg-fried", title: "Balansirana ishrana", text: "Kvalitetna ishrana doprinosi očuvanju mišićne mase i dugoročnijim rezultatima." },
        ],
      },
      {
        type: "paragraph",
        text: "Svaki organizam reaguje drugačije. Zbog toga nije moguće unapred garantovati identične rezultate svim klijentima. Na konačan efekat utiču starost, nivo fizičke aktivnosti, telesna kompozicija, ishrana, kontinuitet dolazaka i broj drugih faktora. Upravo zato se plan tretmana po potrebi prilagođava tokom serije kako bi odgovarao reakciji organizma.",
      },
      { type: "heading", level: 2, text: "Miostimulacija u kombinaciji sa drugim tretmanima" },
      {
        type: "paragraph",
        text: "Jedna od prednosti profesionalnih sistema kao što je ESMA Favorit jeste mogućnost kombinovanja više različitih terapijskih modaliteta. U zavisnosti od cilja tretmana, miostimulacija se može uključiti u širi plan koji obuhvata limfnu drenažu, mikrostrujnu terapiju, ultrazvučne tretmane ili ručne masaže. Kombinovanjem metoda moguće je prilagoditi tretman individualnim potrebama klijenta, uz poštovanje svih bezbednosnih smernica i procene terapeuta.",
      },
      {
        type: "table",
        table: {
          columns: ["Najčešći cilj"],
          rows: [
            { label: "Tesla-Tone 24 + Aqua-Drain 360 (limfna drenaža)", values: ["Podrška cirkulaciji i osećaju lakših nogu uz aktivaciju mišića."] },
            { label: "Tesla-Tone 24 + terapeutska masaža", values: ["Aktivacija mišića uz opuštanje napetih mišićnih grupa."] },
          ],
        },
      },

      { type: "heading", level: 2, text: "Najčešće zablude o miostimulaciji" },
      {
        type: "paragraph",
        text: "O miostimulaciji postoji veliki broj informacija, ali nisu sve tačne. Na internetu se često mogu pronaći tvrdnje koje stvaraju nerealna očekivanja ili potpuno pogrešno predstavljaju način rada ovog tretmana. Profesionalna primena miostimulacije zasniva se na individualnom pristupu, realnim ciljevima i pravilnoj proceni terapeuta.",
      },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-x-circle", title: "Zabluda: Miostimulacija menja trening", text: "Ne. Miostimulacija može biti odlična dopuna fizičkoj aktivnosti, ali ne može zameniti sve benefite koje donose redovno vežbanje, kretanje i razvoj kondicije." },
          { icon: "bi bi-x-circle", title: "Zabluda: Rezultati su trajni posle jednog tretmana", text: "Efekti se grade postepeno. Za većinu ciljeva preporučuje se serija tretmana, uz održavanje i zdrave životne navike." },
          { icon: "bi bi-x-circle", title: "Zabluda: Jači intenzitet znači bolje rezultate", text: "Ne. Intenzitet mora biti prilagođen osobi. Preterano jaka stimulacija ne znači automatski bolji efekat i može biti neprijatna." },
        ],
      },
      { type: "heading", level: 2, text: "Najčešće postavljana pitanja" },
      {
        type: "faq",
        title: "FAQ - Miostimulacija",
        faqItems: [
          { question: "Da li je miostimulacija bolna?", answer: "Većina klijenata oseća ritmične kontrakcije mišića i blage trnce. Tretman ne bi trebalo da bude bolan, a intenzitet se tokom cele seanse prilagođava vašoj toleranciji." },
          { question: "Koliko traje jedan tretman?", answer: "Tesla-Tone 24 traje 45 minuta, u zavisnosti od regije koja se tretira i plana terapije." },
          { question: "Koliko tretmana je potrebno?", answer: "Broj tretmana zavisi od cilja, početnog stanja i individualne reakcije organizma. Terapeut nakon konsultacije daje preporuku za okviran plan tretmana - najčešće 5 do 10 tretmana." },
          { question: "Da li mogu odmah da nastavim sa svakodnevnim aktivnostima?", answer: "Da. Većina osoba odmah nakon tretmana nastavlja sa uobičajenim dnevnim obavezama." },
          { question: "Da li miostimulacija može pomoći ako dugo sedim na poslu?", answer: "Kod osoba koje vode pretežno sedeći način života tretman može biti deo programa za dodatnu aktivaciju pojedinih mišićnih grupa, uz preporuku redovnog kretanja i vežbanja." },
          { question: "Da li miostimulacija sagoreva masne naslage?", answer: "Primarni cilj miostimulacije je stimulacija mišića. Rezultati u oblikovanju tela zavise od više faktora, uključujući ishranu, fizičku aktivnost i celokupan način života." },
          { question: "Da li muškarci mogu koristiti miostimulaciju?", answer: "Da. Tretman je namenjen i ženama i muškarcima kada za to postoje odgovarajuće indikacije i nema kontraindikacija." },
          { question: "Da li postoji period oporavka?", answer: "Ne postoji poseban period oporavka. Nakon tretmana moguće je osetiti blagi zamor mišića, slično osećaju nakon fizičke aktivnosti." },
          { question: "Da li je potrebno posebno se pripremiti za tretman?", answer: "Preporučuje se da koža bude čista, bez krema i ulja na regiji koja se tretira, kao i da budete dovoljno hidrirani." },
          { question: "Da li mogu kombinovati miostimulaciju sa drugim tretmanima?", answer: "Da. U zavisnosti od cilja, terapeut može preporučiti kombinaciju sa limfnom drenažom, masažom ili drugim modalitetima koje omogućava ESMA sistem." },
        ],
      },
      { type: "heading", level: 2, text: "Zaključak" },
      {
        type: "paragraph",
        text: "Miostimulacija predstavlja savremenu i neinvazivnu metodu koja može biti korisna kao podrška aktivaciji mišića, poboljšanju tonusa i programima oblikovanja tela kada se primenjuje pravilno i u skladu sa individualnim potrebama klijenta. Najbolje rezultate daje kao deo šireg pristupa koji uključuje redovnu fizičku aktivnost, uravnoteženu ishranu i kontinuitet tretmana.",
      },
      {
        type: "paragraph",
        text: "Profesionalna procena terapeuta igra ključnu ulogu u određivanju odgovarajućeg programa rada. Zbog toga svaki tretman započinje razgovorom, procenom zdravstvenog stanja i definisanjem realnih očekivanja. Individualni pristup omogućava da se plan tretmana prilagodi vašim ciljevima i da se svaki modalitet koristi na bezbedan i efikasan način.",
      },
      {
        type: "cta",
        title: "Zakažite Tesla-Tone 24",
        text: "Ukoliko želite da saznate da li je miostimulacija odgovarajući izbor za vas, zakažite Tesla-Tone 24 tretman ili konsultaciju sa našim terapeutom. Nakon procene vaših ciljeva i zdravstvenog stanja dobićete preporuku za individualni plan tretmana.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
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
      { type: "heading", level: 2, text: "Jedan aparat, više terapijskih modaliteta" },
      {
        type: "paragraph",
        text: "ESMA Favorit je profesionalni fizioterapeutski aparat koji u jednom sistemu kombinuje nekoliko različitih tehnologija - električnu stimulaciju mišića, limfnu drenažu strujom, mikrostrujnu terapiju, ultrazvuk i svetlosnu (lasersku) biostimulaciju. Umesto da klijent prolazi kroz nekoliko odvojenih uređaja, terapeut na jednom sistemu bira kombinaciju modaliteta koja odgovara cilju tretmana.",
      },
      {
        type: "paragraph",
        text: "Ovakav pristup ima praktičnu prednost: terapeut može da kombinuje modalitete unutar jedne seanse - na primer miostimulaciju za tonus i limfnu drenažu za cirkulaciju u istom terminu - umesto da klijent zakazuje nekoliko odvojenih poseta za svaki efekat pojedinačno.",
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
      { type: "heading", level: 2, text: "Kako terapeut bira kombinaciju" },
      {
        type: "paragraph",
        text: "Terapeut pre prvog tretmana radi kratku procenu - pita o cilju (tonus, opuštanje, nega kože), zdravstvenom stanju i eventualnim kontraindikacijama, i na osnovu toga predlaže kombinaciju i broj tretmana. Serija se najčešće preporučuje jer su efekti kumulativni, a pojedinačni tretman je uvod, ne konačan rezultat.",
      },
      {
        type: "table",
        table: {
          columns: ["Modaliteti koji se najčešće kombinuju"],
          rows: [
            { label: "Tonus i oblikovanje tela", values: ["Miostimulacija + limfna drenaža"] },
            { label: "Nega i tonus lica", values: ["Mikrostrujna terapija + ultrazvuk"] },
            { label: "Opuštanje i cirkulacija nogu", values: ["Limfna drenaža + laserska biostimulacija"] },
            { label: "Sveobuhvatan wellness tretman", values: ["Kombinacija sva četiri modaliteta, prilagođena redom i intenzitetom"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "info",
        title: "Serija, ne pojedinačni tretman",
        text: "ESMA Favorit tretmani deluju kumulativno. Terapeut retko predlaže samo jedan tretman - uobičajena preporuka je serija od nekoliko seansi, uz prilagođavanje nakon prvih poseta na osnovu reakcije organizma.",
      },
      {
        type: "quote",
        text: "Cilj nije da nabijemo što više tehnologije u jedan tretman, već da izaberemo ono što konkretnoj osobi zaista treba.",
        meta: "Estetik Lab, tim terapeuta",
      },
      { type: "heading", level: 2, text: "Naši ESMA tretmani po imenu" },
      {
        type: "paragraph",
        text: "U praksi ove kombinacije modaliteta imaju konkretna imena kod nas u studiju - svaki tretman je unapred sastavljen za određeni cilj, tako da ne morate sami da smišljate kombinaciju. Evo nekoliko primera:",
      },
      {
        type: "serviceReference",
        title: "Tesla-Tone 24 – miostimulacija za tonus tela",
        text: "Miostimulacija celog tela za jačanje mišića i podizanje tonusa, bez znojenja i opterećenja zglobova.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
      },
      {
        type: "serviceReference",
        title: "Aqua-Drain 360 – limfna drenaža celog tela",
        text: "Detoksikacija, uklanjanje viška vode i osećaj lakših nogu kroz ritmičnu stimulaciju limfnog sistema.",
        button: { text: "Zakažite Aqua-Drain 360", url: "/zakazivanje/aquadrain-360" },
      },
      {
        type: "serviceReference",
        title: "Laser-Sonic Face Sculpt – nega i lifting lica",
        text: "Mikrostruje + ultrazvuk + svetlosna terapija za lice, bez igala i bez perioda oporavka.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - ESMA Favorit",
        faqItems: [
          { question: "Da li se svi modaliteti koriste u svakom tretmanu?", answer: "Ne. Terapeut bira kombinaciju prema cilju - neko dolazi samo zbog miostimulacije, neko kombinuje više modaliteta u istoj seansi." },
          { question: "Koliko traje jedan ESMA tretman?", answer: "U zavisnosti od izabrane kombinacije, najčešće između 30 i 60 minuta." },
          { question: "Da li je potrebna posebna priprema pre tretmana?", answer: "Dovoljno je da koža bude čista, bez krema ili ulja na tretiranoj zoni, i da budete dobro hidrirani." },
          { question: "Kome ESMA Favorit nije preporučljiv?", answer: "Trudnicama, osobama sa pejsmejkerom ili drugim elektronskim implantatima, epilepsijom, i osobama sa akutnim upalama kože na tretiranoj zoni - o tome se razgovara na konsultaciji." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte sve ESMA tretmane",
        text: "Pregledajte kompletnu ponudu ESMA Favorit tretmana i odaberite onaj koji najviše odgovara vašem cilju, ili zakažite konsultaciju za personalizovanu preporuku.",
        button: { text: "Pogledajte ESMA tretmane", url: "/usluge/kategorija/esma" },
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
      { type: "heading", level: 2, text: "Kako limfni sistem radi i zašto ponekad zaostaje" },
      {
        type: "paragraph",
        text: "Limfni sistem prati krvotok i ima ulogu da iz tkiva odvede višak tečnosti, otpadne produkte i toksine. Za razliku od krvi koju pumpa srce, limfa se kreće zahvaljujući kontrakciji mišića i pokretu tela - zato dug boravak u sedećem ili stajaćem položaju, malo kretanja ili topli dani mogu usporiti njeno kretanje i dovesti do osećaja težine, otoka ili zadržavanja tečnosti, najčešće u nogama.",
      },
      {
        type: "paragraph",
        text: "Limfna drenaža je tretman koji ritmičnim pritiskom - ručno ili aparatom, poput ESMA Favorit sistema - podstiče kretanje limfe kroz tkivo, pomažući organizmu da se rastereti viška tečnosti. Najčešće se traži zbog osećaja \"teških nogu\", otoka na kraju dana ili kao deo oporavka posle napornih treninga.",
      },
      { type: "heading", level: 3, text: "Kako izgleda tretman" },
      {
        type: "list",
        ordered: true,
        items: [
          "Kratak razgovor o cilju tretmana i eventualnim zdravstvenim stanjima",
          "Postavljanje elektroda ili izvođenje ručnih pokreta u pravcu limfnih čvorova",
          "Ritmična, blaga stimulacija - bez bola, uglavnom prijatan osećaj pritiska",
          "Preporuka za hidrataciju i lagano kretanje posle tretmana",
        ],
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
        type: "table",
        table: {
          columns: ["Karakteristike"],
          rows: [
            { label: "Ručna limfna drenaža", values: ["Precizni ručni pokreti, terapeut prilagođava pritisak u realnom vremenu"] },
            { label: "Aparaturna limfna drenaža (ESMA)", values: ["Ravnomerna stimulacija veće površine, pogodna za kombinovanje sa drugim modalitetima u istoj seansi"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "warning",
        title: "Kada limfna drenaža nije preporučljiva",
        text: "Limfna drenaža se ne preporučuje osobama sa akutnim infekcijama, trombozom ili određenim srčanim i bubrežnim stanjima - to je jedno od prvih pitanja koje terapeut postavlja na konsultaciji.",
      },
      { type: "heading", level: 2, text: "Aqua-Drain 360 – naš tretman limfne drenaže" },
      {
        type: "paragraph",
        text: "U Estetik Lab-u limfnu drenažu sprovodimo kroz tretman Aqua-Drain 360, na ESMA Favorit aparatu. Kroz veliki broj mikro-strujnih kanala kreira se ritmični talasni pritisak koji nežno potiskuje nakupljenu tečnost iz tkiva ka limfnim čvorovima. Tretman traje 45 minuta i pokriva celo telo u jednoj seansi.",
      },
      {
        type: "serviceReference",
        title: "Aqua-Drain 360 – limfna drenaža celog tela",
        text: "Detoksikacija, uklanjanje viška vode i celulita, olakšanje kod sindroma teških nogu. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Aqua-Drain 360", url: "/zakazivanje/aquadrain-360" },
      },
      {
        type: "serviceReference",
        title: "Paket od 5 tretmana – povoljnija cena po tretmanu",
        text: "Za seriju Aqua-Drain 360 tretmana, paket od 5 seansi izlazi povoljnije po tretmanu nego pojedinačne posete.",
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/aqua-drain-360-5-tretmana" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Limfna drenaža",
        faqItems: [
          { question: "Da li limfna drenaža boli?", answer: "Ne. Tretman se opisuje kao prijatan pritisak, bez bola." },
          { question: "Koliko brzo se oseti razlika?", answer: "Mnogi klijenti prijave osećaj lakših nogu odmah posle prvog tretmana, ali trajniji efekat gradi se kroz seriju." },
          { question: "Da li mogu da radim limfnu drenažu svake nedelje?", answer: "Terapeut predlaže dinamiku prema cilju i stanju - najčešće nekoliko puta nedeljno u intenzivnijoj fazi, a zatim ređe za održavanje." },
          { question: "Da li se limfna drenaža kombinuje sa drugim tretmanima?", answer: "Da, često se kombinuje sa mikrostrujnom terapijom ili miostimulacijom u istoj ESMA seansi." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Aqua-Drain 360",
        text: "Ako se borite sa osećajem teških nogu ili zadržavanjem tečnosti, zakažite Aqua-Drain 360 tretman ili konsultaciju sa našim terapeutom.",
        button: { text: "Zakažite Aqua-Drain 360", url: "/zakazivanje/aquadrain-360" },
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
      { type: "heading", level: 2, text: "Zašto celulit nastaje" },
      {
        type: "paragraph",
        text: "Prvo najvažnije: celulit je potpuno normalna pojava koja pogađa veliku većinu žena, bez obzira na težinu ili nivo fizičke aktivnosti, i nastaje zbog strukture vezivnog tkiva ispod kože. Vezivna vlakna kod žena su raspoređena drugačije nego kod muškaraca, pa se masno tkivo lakše \"gura\" ka površini kože, stvarajući karakterističan izgled.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Nijedan tretman ga ne \"leči\"",
        text: "Celulit se ne leči niti trajno uklanja - ono što tretmani mogu jeste da doprinesu izgledu kože, cirkulaciji i osećaju zategnutosti, u kombinaciji sa zdravim navikama. Bilo koje obećanje trajnog i potpunog uklanjanja treba primiti sa rezervom.",
      },
      { type: "heading", level: 3, text: "Pristupi koje nudimo" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-hand-index-thumb", title: "Anticelulit masaža", text: "Ručna stimulacija cirkulacije i limfne drenaže problematičnih zona." },
          { icon: "bi bi-lightning", title: "Elektrolipoliza", text: "Ciljana električna stimulacija za rad na specifičnim zonama." },
          { icon: "bi bi-stars", title: "Kombinovani ESMA tretman", text: "Limfna drenaža + ultrazvuk + zatezanje kože u jednoj seansi." },
        ],
      },
      {
        type: "table",
        table: {
          columns: ["Fokus"],
          rows: [
            { label: "Anticelulit masaža", values: ["Ručna stimulacija cirkulacije i limfne drenaže"] },
            { label: "Elektrolipoliza", values: ["Ciljana električna stimulacija problematičnih zona"] },
            { label: "Kombinovani ESMA tretman", values: ["Limfna drenaža + ultrazvuk + zatezanje kože u jednoj seansi"] },
          ],
        },
      },
      { type: "heading", level: 2, text: "Šta dodatno pomaže uz tretmane" },
      {
        type: "list",
        ordered: false,
        items: [
          "Redovna fizička aktivnost, posebno kretanje i lagani trening nogu",
          "Dovoljan unos vode tokom dana",
          "Izbegavanje dugog sedenja bez pauza za kretanje",
          "Uravnotežena ishrana kao deo šire rutine, ne kao brzo rešenje",
        ],
      },
      {
        type: "paragraph",
        text: "Terapeut na konsultaciji procenjuje tip i stepen izraženosti celulita i predlaže kombinaciju koja ima smisla - najčešće serija tretmana, uz savet o hidrataciji i kretanju, jer aparatura sama po sebi radi bolje kao deo šire rutine, a ne kao izolovano rešenje.",
      },
      { type: "heading", level: 2, text: "Naši tretmani protiv celulita" },
      {
        type: "paragraph",
        text: "Sva tri pristupa opisana iznad dostupni su kod nas kao konkretni, imenovani tretmani - birate prema tome koliko vremena imate i koliko intenzivan pristup želite:",
      },
      {
        type: "serviceReference",
        title: "Anticelulit masaža – ručni pristup",
        text: "Ručna tehnika gnječenja i podsticanje limfne drenaže. Bira se 30 minuta (ciljana zona) ili 60 minuta (celo telo).",
        button: { text: "Zakažite anticelulit masažu", url: "/zakazivanje/anticelulit-masaza" },
      },
      {
        type: "serviceReference",
        title: "Lipolise Russian-Max – elektrolipoliza",
        text: "Struje deluju direktno na masne ćelije u tretiranoj zoni - stomak, bokovi, jahaće pantalone. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Lipolise Russian-Max", url: "/zakazivanje/lipolise-russianmax" },
      },
      {
        type: "serviceReference",
        title: "Tri-Active Cellu-Erase – kombinovani tretman",
        text: "Ultrazvuk + interferentna struja + svetlosna terapija u jednoj proceduri od 75 minuta - najsveobuhvatniji pristup za dugotrajan i tvrdokoran celulit.",
        button: { text: "Zakažite Tri-Active Cellu-Erase", url: "/zakazivanje/triactive-celluerase" },
      },
      {
        type: "serviceReference",
        title: "Paket od 5 tretmana – povoljnija cena po tretmanu",
        text: "Za seriju Tri-Active Cellu-Erase tretmana, paket od 5 seansi izlazi povoljnije po tretmanu nego pojedinačne posete.",
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/tri-active-cellu-erase-5-tretmana" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Anticelulit tretmani",
        faqItems: [
          { question: "Da li se celulit može potpuno ukloniti?", answer: "Ne postoji tretman koji trajno i potpuno uklanja celulit. Tretmani mogu doprineti izgledu kože i cirkulaciji, ali ne menjaju osnovnu strukturu vezivnog tkiva." },
          { question: "Koliko brzo se vidi razlika?", answer: "Zavisi od individualnih faktora, ali većina terapeuta preporučuje seriju od najmanje 8 do 10 tretmana pre procene rezultata." },
          { question: "Da li anticelulit masaža boli?", answer: "Može biti intenzivnija od klasične relaksacione masaže, ali se intenzitet uvek prilagođava toleranciji klijenta." },
          { question: "Da li je potrebno menjati ishranu uz tretmane?", answer: "Nije obavezno, ali zdrave navike - hidratacija, kretanje, uravnotežena ishrana - pomažu da efekat tretmana bude vidljiviji i duže traje." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Tri-Active Cellu-Erase",
        text: "Za najtvrdokorniji celulit i najsveobuhvatniji pristup, zakažite naš kombinovani tretman Tri-Active Cellu-Erase, ili konsultaciju za pomoć u izboru pravog pristupa.",
        button: { text: "Zakažite Tri-Active Cellu-Erase", url: "/zakazivanje/triactive-celluerase" },
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
      { type: "heading", level: 2, text: "Zašto lice \"pada\" sa godinama" },
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
        type: "callout",
        variant: "success",
        title: "Bez oporavka",
        text: "Tretman je bezbolan, bez perioda oporavka - klijent može odmah nastaviti dan. Efekat posle jednog tretmana je suptilan i privremen; za primetniju i dužu razliku terapeuti preporučuju seriju tretmana, uz periodično održavanje.",
      },
      {
        type: "paragraph",
        text: "Ovo nije zamena za hiruršku intervenciju, već neinvazivna alternativa za onе koji žele postepen, prirodniji pristup. Terapeut na konsultaciji realno procenjuje šta se od mikrostrujnog liftinga može očekivati za konkretnu osobu, bez preteranih obećanja.",
      },
      { type: "heading", level: 2, text: "Mikrostrujni lifting vs hirurški lifting" },
      {
        type: "table",
        table: {
          columns: ["Mikrostrujni lifting", "Hirurški lifting"],
          rows: [
            { label: "Invazivnost", values: ["Neinvazivno, bez rezova", "Hirurška intervencija, period oporavka"] },
            { label: "Efekat", values: ["Postepen, suptilan, gradi se kroz seriju", "Izraženiji i trenutan posle oporavka"] },
            { label: "Trajanje efekta", values: ["Zahteva periodično održavanje", "Dugotrajniji efekat po prirodi zahvata"] },
            { label: "Rizik", values: ["Minimalan", "Hirurški rizici prisutni kao kod svake operacije"] },
          ],
        },
      },
      { type: "heading", level: 2, text: "Laser-Sonic Face Sculpt – naš tretman mikrostrujnog liftinga" },
      {
        type: "paragraph",
        text: "Kod nas mikrostrujni lifting izvodimo kroz tretman Laser-Sonic Face Sculpt, koji mikrostruje kombinuje sa ultrazvučnom fonoforezom i svetlosnom terapijom. Mikrostruje rade nežan miolifting lica i podbratka, ultrazvuk pomaže unosu aktivnih sastojaka u kožu, a svetlosna terapija na kraju doprinosi osećaju svežine i sjaja. Tretman traje 45 minuta, bez igala i bez perioda oporavka.",
      },
      {
        type: "serviceReference",
        title: "Laser-Sonic Face Sculpt – lifting lica bez igala",
        text: "Mikrostruje + ultrazvuk + svetlosna terapija za tonus obraza i vilice, sjaj kože i osećaj zategnutosti odmah nakon tretmana.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
      {
        type: "serviceReference",
        title: "Paket od 5 tretmana – povoljnija cena po tretmanu",
        text: "Za seriju Laser-Sonic Face Sculpt tretmana, paket od 5 seansi izlazi povoljnije po tretmanu nego pojedinačne posete.",
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/laser-sonic-face-sculpt-5-tretmana" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Mikrostrujni lifting lica",
        faqItems: [
          { question: "Da li mikrostrujni lifting boli?", answer: "Ne, tretman je bezbolan - osećaju se blagi trnci na koži." },
          { question: "Koliko tretmana je potrebno?", answer: "Terapeuti najčešće preporučuju seriju od 5 do 10 tretmana za primetniji efekat, uz periodično održavanje." },
          { question: "Kome se ovaj tretman ne preporučuje?", answer: "Trudnicama, osobama sa pejsmejkerom, epilepsijom ili akutnim upalama kože lica." },
          { question: "Da li se kombinuje sa drugim tretmanima lica?", answer: "Da, Laser-Sonic Face Sculpt već u sebi kombinuje mikrostruje, ultrazvuk i svetlosnu terapiju u jednoj seansi." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Laser-Sonic Face Sculpt",
        text: "Zakažite Laser-Sonic Face Sculpt ili konsultaciju da saznate da li je mikrostrujni lifting pravi izbor za vaš cilj.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
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
      { type: "heading", level: 2, text: "Fokusirani ultrazvuk umesto rezova" },
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
        type: "cards",
        cards: [
          { icon: "bi bi-soundwave", title: "Fokusirani ultrazvuk", text: "Talasi ciljaju tačno određenu dubinu tkiva, bez oštećenja površine kože." },
          { icon: "bi bi-arrow-repeat", title: "Prirodna obnova kolagena", text: "Telo samo gradi novi kolagen tokom narednih nedelja." },
          { icon: "bi bi-calendar-week", title: "Bez oporavka", text: "Odmah nakon tretmana moguć je povratak svakodnevnim aktivnostima." },
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Rezultat nije trenutan",
        text: "Ono što je važno postaviti realno: efekat se ne vidi odmah na izlasku iz salona. Kolagen se gradi postepeno, pa se puni efekat obično primećuje tokom narednih nedelja do meseci, a rezultat zavisi od individualnih karakteristika kože i starosne strukture kolagena.",
      },
      {
        type: "paragraph",
        text: "Terapeut na konsultaciji procenjuje da li je HIFU pravi izbor za konkretnu zonu i cilj, uzimajući u obzir stanje kože, starost i realna očekivanja klijenta.",
      },
      { type: "heading", level: 2, text: "HIFU vs mikrostrujni lifting" },
      {
        type: "table",
        table: {
          columns: ["HIFU", "Mikrostrujni lifting"],
          rows: [
            { label: "Princip delovanja", values: ["Fokusirani ultrazvuk podstiče proizvodnju kolagena", "Mikrostruja stimuliše mišiće lica direktno"] },
            { label: "Kada se vidi efekat", values: ["Postepeno, tokom nedelja do meseci", "Postepeno, kroz seriju tretmana"] },
            { label: "Učestalost dolazaka", values: ["Ređe, efekat traje duže po prirodi zahvata", "Češće, uz periodično održavanje"] },
          ],
        },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - HIFU lifting",
        faqItems: [
          { question: "Da li HIFU boli?", answer: "Klijenti najčešće osećaju blagu toplotu ili trnce tokom tretmana, u zavisnosti od praga tolerancije." },
          { question: "Koliko traje efekat HIFU tretmana?", answer: "Efekat po prirodi zahvata traje duže od mikrostrujnog liftinga, ali tačno trajanje zavisi od individualnih faktora poput starosti kože i načina života." },
          { question: "Kome HIFU nije preporučljiv?", answer: "Trudnicama, osobama sa određenim kožnim oboljenjima ili implantatima na tretiranoj zoni - o tome se razgovara na konsultaciji." },
          { question: "Da li je potreban jedan tretman ili serija?", answer: "Zavisi od cilja i stanja kože - terapeut na konsultaciji predlaže plan prilagođen konkretnoj osobi." },
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Naša alternativa neinvazivnom liftingu lica",
        text: "U našem studiju trenutno ne radimo tretmane na namenskom HIFU aparatu. Ako vas zanima neinvazivno zatezanje i tonus lica, naš Laser-Sonic Face Sculpt tretman koristi drugačiju, ali srodnu kombinaciju tehnologija (mikrostruje + ultrazvuk + svetlosna terapija) sa sličnim ciljem - podrška tonusu i konturi lica bez igala i bez oporavka.",
      },
      {
        type: "serviceReference",
        title: "Laser-Sonic Face Sculpt – naša alternativa za lifting lica",
        text: "Mikrostruje + ultrazvuk + svetlosna terapija za konturu lica, bez igala i bez perioda oporavka.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju za lifting lica",
        text: "Zakažite konsultaciju kako bi terapeut predložio pravi neinvazivni pristup zatezanju i tonusu lica za vaš cilj.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/lasersonic-face-sculpt" },
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
      { type: "heading", level: 2, text: "Više primena, jedna tehnologija" },
      {
        type: "paragraph",
        text: "Ultrazvučni tretmani za lice koriste vibracije visoke frekvencije u nekoliko različitih svrha - od nežnog uklanjanja mrtvih ćelija kože i nečistoća iz pora (ultrazvučni piling), do podrške cirkulaciji i utrljavanju aktivnih sastojaka dublje u kožu.",
      },
      { type: "heading", level: 3, text: "Glavne primene" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-droplet-half", title: "Ultrazvučni piling", text: "Nežno uklanjanje mrtvih ćelija kože i nečistoća iz pora." },
          { icon: "bi bi-arrow-down-circle", title: "Ultrafonoforeza", text: "Podrška dubljem prodiranju aktivnih sastojaka u kožu." },
          { icon: "bi bi-water", title: "Podrška cirkulaciji", text: "Blagi rad na cirkulaciji i osećaju svežine kože." },
        ],
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
        text: "Tretman je nežan i bez oporavka, pogodan i za osetljiviju kožu, ali kao i kod svih tretmana lica, terapeut prvo procenjuje tip kože i eventualne kontraindikacije.",
      },
      {
        type: "callout",
        variant: "warning",
        title: "Kada se ultrazvučni tretman odlaže",
        text: "Aktivna akne infekcija, otvorene rane ili određena kožna stanja mogu biti razlog da terapeut predloži odlaganje tretmana do smirivanja stanja kože.",
      },
      { type: "heading", level: 2, text: "Gde se ultrazvuk za lice koristi kod nas" },
      {
        type: "paragraph",
        text: "Ultrazvučnu fonoforezu kombinujemo sa mikrostrujama i svetlosnom terapijom u okviru tretmana Laser-Sonic Face Sculpt - ultrazvuk tu pomaže unosu aktivnih sastojaka u kožu, dok mikrostruje rade na tonusu mišića lica. Ako vas prevashodno zanima samo ultrazvučni piling i osećaj svežine kože, recite terapeutu na konsultaciji - kombinacija modaliteta se uvek može prilagoditi vašem cilju.",
      },
      {
        type: "serviceReference",
        title: "Laser-Sonic Face Sculpt – ultrazvuk, mikrostruje i svetlosna terapija",
        text: "Kombinovani tretman za lice koji uključuje ultrazvučnu fonoforezu, miolifting mikrostrujama i svetlosnu terapiju za sjaj kože.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Ultrazvuk za lice",
        faqItems: [
          { question: "Da li ultrazvučni piling boli?", answer: "Ne, tretman se opisuje kao prijatan i bez nelagodnosti." },
          { question: "Koliko često se preporučuje ultrazvučni piling?", answer: "U zavisnosti od tipa kože, najčešće jednom u nekoliko nedelja kao deo redovne nege." },
          { question: "Da li se ultrazvuk za lice kombinuje sa drugim tretmanima?", answer: "Da, kod nas je već deo Laser-Sonic Face Sculpt tretmana, u kombinaciji sa mikrostrujama i svetlosnom terapijom." },
          { question: "Da li je pogodan za osetljivu kožu?", answer: "Uglavnom da, jer je tretman nežan, ali terapeut uvek prvo procenjuje individualno stanje kože." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite negu lica",
        text: "Zakažite Laser-Sonic Face Sculpt ili konsultaciju, a terapeut će prilagoditi kombinaciju modaliteta vašoj koži.",
        button: { text: "Zakažite Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
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
      { type: "heading", level: 2, text: "Kako laser deluje na dlaku" },
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
        type: "callout",
        variant: "info",
        title: "Zašto je potrebno više tretmana",
        text: "Dlake rastu u ciklusima, a laser deluje samo na one koje su trenutno u aktivnoj fazi rasta. Zato je serija od više tretmana, u preporučenim razmacima, standardan i očekivan deo procesa, a ne znak da nešto ne funkcioniše.",
      },
      { type: "heading", level: 2, text: "Faze rasta dlake" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-arrow-up-circle", title: "Anagena faza", text: "Aktivan rast - dlaka je najosetljivija na dejstvo lasera." },
          { icon: "bi bi-pause-circle", title: "Katagena faza", text: "Prelazna faza mirovanja rasta." },
          { icon: "bi bi-dash-circle", title: "Telogena faza", text: "Faza mirovanja - dlaka u ovoj fazi ne reaguje na tretman." },
        ],
      },
      {
        type: "paragraph",
        text: "Pošto se dlake na različitim delovima tela ne nalaze u istoj fazi u isto vreme, potrebno je nekoliko tretmana u razmaku od nekoliko nedelja da bi se obuhvatile sve dlake tokom svog aktivnog ciklusa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Laserska epilacija",
        faqItems: [
          { question: "Koliko tretmana je potrebno za trajniji efekat?", answer: "Najčešće između 6 i 8 tretmana, u zavisnosti od regije i individualnih karakteristika dlake i kože." },
          { question: "Da li laserska epilacija boli?", answer: "Osećaj se opisuje kao blago pečenje ili trnci, u zavisnosti od osetljivosti kože i regije koja se tretira." },
          { question: "Da li je bezbedna za tamniju kožu?", answer: "Moderni medicinski laseri imaju prilagodljive parametre baš za tu svrhu - terapeut bira podešavanja prema tonu kože klijenta." },
          { question: "Šta ako imam svetle ili sede dlake?", answer: "Fine i svetle dlake sadrže manje pigmenta i sporije reaguju na lasersku epilaciju - terapeut na konsultaciji objašnjava realna očekivanja za vaš tip dlake." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju za lasersku epilaciju",
        text: "Terapeut će proceniti vaš tip kože i dlake i predložiti realan plan tretmana.",
        button: { text: "Zakažite termin", url: "/kontakt" },
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
      { type: "heading", level: 2, text: "Dva mehanizma u jednom tretmanu" },
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
        type: "cards",
        cards: [
          { icon: "bi bi-lightning-charge", title: "EMS kontrakcije", text: "Kontrolisana stimulacija mišićnih vlakana na ciljanoj zoni." },
          { icon: "bi bi-thermometer-sun", title: "Radiofrekvencija", text: "Zagrevanje dubljih slojeva tkiva koje podržava zatezanje kože." },
          { icon: "bi bi-graph-up", title: "Kumulativan efekat", text: "Efekat se gradi kroz seriju tretmana, ne posle jedne posete." },
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Realna očekivanja",
        text: "Kao i kod svih tretmana ove vrste, jedan tretman daje osećaj, a rezultat gradi serija - terapeuti obično predlažu paket od više seansi, uz napomenu da rezultati zavise od polazne tačke, načina života i redovnosti dolazaka, ne samo od same tehnologije.",
      },
      { type: "heading", level: 2, text: "EMS tretman vs klasičan trening" },
      {
        type: "table",
        table: {
          columns: ["EMS tretman", "Klasičan trening"],
          rows: [
            { label: "Fizički napor", values: ["Minimalan - nema znojenja ni pokreta", "Zahteva aktivno fizičko angažovanje"] },
            { label: "Trajanje seanse", values: ["Obično 20-30 minuta po zoni", "Zavisi od plana treninga"] },
            { label: "Najbolji rezultati", values: ["Kombinovano sa aktivnim načinom života", "Kombinovano sa uravnoteženom ishranom"] },
          ],
        },
      },
      { type: "heading", level: 2, text: "Tesla-Tone 24 – naš EMS tretman za oblikovanje tela" },
      {
        type: "paragraph",
        text: "Kod nas ovaj princip sprovodimo kroz Tesla-Tone 24 na ESMA Favorit aparatu - kroz veliki broj nezavisnih kanala aparat aktivira mišićna vlakna na više zona istovremeno, uključujući duboke stabilizatore koje je teško aktivirati klasičnim treningom. Tretman traje 45 minuta.",
      },
      {
        type: "serviceReference",
        title: "Tesla-Tone 24 – EMS oblikovanje tela",
        text: "Miostimulacija celog tela za tonus i jačanje mišića, bez znojenja i opterećenja zglobova. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
      },
      {
        type: "serviceReference",
        title: "Paket od 10 tretmana – za dugoročno oblikovanje tela",
        text: "Ako je cilj primetnija promena, a ne samo održavanje, paket od 10 Tesla-Tone 24 tretmana daje najbolju cenu po tretmanu.",
        button: { text: "Pogledajte paket od 10 tretmana", url: "/paketi/tesla-tone-24-10-tretmana" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - EMS oblikovanje tela",
        faqItems: [
          { question: "Da li EMS tretman zamenjuje trening u teretani?", answer: "Ne, EMS je dopuna aktivnom načinu života, a ne zamena za redovnu fizičku aktivnost." },
          { question: "Koliko tretmana je potrebno?", answer: "Terapeuti najčešće predlažu paket od 5 do 10 tretmana, uz procenu napretka tokom serije." },
          { question: "Da li tretman boli?", answer: "Opisuje se kao intenzivan, ali podnošljiv - intenzitet se prilagođava toleranciji klijenta." },
          { question: "Kome EMS tretman nije preporučljiv?", answer: "Trudnicama, osobama sa pejsmejkerom ili drugim elektronskim implantatima i osobama sa akutnim upalama na tretiranoj zoni." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Tesla-Tone 24",
        text: "Terapeut će proceniti vaš cilj i predložiti realan plan serije Tesla-Tone 24 tretmana.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
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
      { type: "heading", level: 2, text: "Dva različita pristupa opuštanju i tonusu" },
      {
        type: "paragraph",
        text: "Pitanje \"masaža ili aparat\" zapravo nema jedan tačan odgovor - zavisi od toga šta je cilj tog dana. Ručna masaža radi na opuštanju mišićnog tkiva, smanjenju napetosti i psihičkom opuštanju kroz direktan dodir i pritisak terapeuta, prilagođen u realnom vremenu.",
      },
      { type: "heading", level: 3, text: "Vrste masaže koje nudimo" },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-emoji-smile", title: "Relaksaciona / antistres masaža", text: "Opuštanje tela i uma, smanjenje osećaja stresa i napetosti." },
          { icon: "bi bi-bandaid", title: "Terapeutska masaža", text: "Rad na napetim mišićnim grupama, bol u leđima i vratu." },
          { icon: "bi bi-trophy", title: "Sportska masaža", text: "Podrška oporavku posle fizičke aktivnosti i treninga." },
        ],
      },
      { type: "heading", level: 3, text: "Kada birati šta" },
      {
        type: "table",
        table: {
          columns: ["Bolji izbor"],
          rows: [
            { label: "Opuštanje i smanjenje stresa", values: ["Relaksaciona / antistres masaža"] },
            { label: "Bol u leđima ili napetost od sedenja", values: ["Terapeutska masaža"] },
            { label: "Tonus mišića i oblikovanje", values: ["ESMA / EMS aparaturni tretman"] },
            { label: "Detoksikacija i lagane noge", values: ["Limfna drenaža (ručna ili aparaturna)"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "success",
        title: "Kombinacija je moguća",
        text: "Dobra vest je da se ova dva pristupa odlično kombinuju - mnogi klijenti naizmenično ili u istoj poseti kombinuju ručnu masažu sa aparaturnim delom tretmana. Terapeut na konsultaciji može predložiti kombinaciju koja odgovara vašem cilju i raspoloživom vremenu.",
      },
      { type: "heading", level: 2, text: "Naše masaže i aparaturni tretmani" },
      {
        type: "serviceReference",
        title: "Relaks masaža",
        text: "Klasična opuštajuća masaža za smanjenje stresa i mišićne napetosti. 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
        button: { text: "Zakažite Relaks masažu", url: "/zakazivanje/relaks-masaza" },
      },
      {
        type: "serviceReference",
        title: "Terapeutska masaža",
        text: "Ciljana masaža za hroničnu napetost, mišićne čvoriće i bol nastao usled dugog sedenja ili lošeg držanja tela.",
        button: { text: "Zakažite Terapeutsku masažu", url: "/zakazivanje/terapeutska-masaza" },
      },
      {
        type: "serviceReference",
        title: "Sportska masaža",
        text: "Priprema mišića pre napora i podrška oporavku nakon treninga, prilagođena sportistima i rekreativcima.",
        button: { text: "Zakažite Sportsku masažu", url: "/zakazivanje/sportska-masaza" },
      },
      {
        type: "serviceReference",
        title: "Tesla-Tone 24 – aparaturni tonus i oblikovanje",
        text: "Miostimulacija za tonus mišića kada je cilj oblikovanje, a ne opuštanje.",
        button: { text: "Zakažite Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Masaža i aparaturni tretmani",
        faqItems: [
          { question: "Da li mogu u istoj poseti da kombinujem masažu i aparaturni tretman?", answer: "Da, mnogi klijenti kombinuju oba pristupa u istoj poseti, u zavisnosti od raspoloživog vremena." },
          { question: "Koji pristup je bolji za bol u leđima?", answer: "Terapeutska masaža je najčešće prvi izbor za napetost i bol u leđima izazvane sedenjem ili fizičkim naporom." },
          { question: "Da li aparaturni tretmani mogu zameniti masažu?", answer: "Ne - rade na različit način. Aparaturni tretmani su usmereni na tonus mišića i oblikovanje, dok masaža radi na opuštanju i cirkulaciji kroz direktan dodir." },
          { question: "Koliko često se preporučuje masaža?", answer: "Zavisi od cilja - za opuštanje jednom nedeljno do mesečno, za rad na specifičnom bolu terapeut predlaže dinamiku prema stanju." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite masažu ili konsultaciju",
        text: "Recite nam vaš cilj, a terapeut će predložiti pristup ili kombinaciju koja najviše odgovara vašim potrebama.",
        button: { text: "Pogledajte sve masaže", url: "/usluge/kategorija/masaze" },
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
      {
        type: "paragraph",
        text: "Prvi dolazak na ESMA tretman često izaziva nekoliko istih pitanja - šta poneti, na šta se pripremiti, i šta je normalno da se oseti posle. Evo praktičnog vodiča koji pokriva ceo proces, od prve konsultacije do nege posle tretmana.",
      },
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
      {
        type: "callout",
        variant: "warning",
        title: "Budite iskreni na konsultaciji",
        text: "Konsultacija pre prvog tretmana nije formalnost - ono što kažete terapeutu direktno utiče na to koji modaliteti i intenzitet su bezbedni za vas.",
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
        type: "cards",
        cards: [
          { icon: "bi bi-droplet", title: "Hidratacija", text: "Voda pomaže telu da efikasnije reaguje na tretman." },
          { icon: "bi bi-person-walking", title: "Lagano kretanje", text: "Šetnja podržava cirkulaciju, intenzivan trening sačekajte do sutra." },
          { icon: "bi bi-calendar-check", title: "Redovnost", text: "Serija tretmana u preporučenom razmaku daje bolje rezultate od pojedinačnih poseta." },
        ],
      },
      {
        type: "paragraph",
        text: "Ako niste sigurni da li se nešto specifično odnosi na vas (lekovi, hronična stanja, trudnoća), najbolje je da to pomenete terapeutu pre prvog tretmana - konsultacija postoji baš zato da se tretman prilagodi vama, a ne obrnuto.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Pre i posle ESMA tretmana",
        faqItems: [
          { question: "Da li mogu da vozim posle tretmana?", answer: "Da, ESMA tretmani ne utiču na sposobnost vožnje ili obavljanja svakodnevnih aktivnosti." },
          { question: "Da li treba da jedem pre tretmana?", answer: "Preporučuje se da niste gladni, ali obilan obrok neposredno pre tretmana takođe nije potreban." },
          { question: "Šta ako osetim nelagodnost tokom tretmana?", answer: "Odmah recite terapeutu - intenzitet se prilagođava u realnom vremenu tokom cele seanse." },
          { question: "Koliko brzo mogu da zakažem sledeći tretman?", answer: "Terapeut na osnovu vašeg plana predlaže razmak između tretmana, najčešće nekoliko dana." },
        ],
      },
      {
        type: "cta",
        title: "Spremni za prvi tretman?",
        text: "Pogledajte ponudu ESMA tretmana i izaberite onaj koji odgovara vašem cilju, ili zakažite konsultaciju - terapeut će vas provesti kroz ceo proces, korak po korak.",
        button: { text: "Pogledajte ESMA tretmane", url: "/usluge/kategorija/esma" },
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
      { type: "heading", level: 2, text: "Zašto se tretmani rade u seriji" },
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
      { type: "heading", level: 2, text: "Orijentacioni okvir po tipu tretmana" },
      {
        type: "table",
        table: {
          columns: ["Orijentacioni broj tretmana"],
          rows: [
            { label: "ESMA / miostimulacija / EMS (Tesla-Tone 24)", values: ["Najčešće 5-10 tretmana za primetniji efekat"] },
            { label: "Limfna drenaža (Aqua-Drain 360)", values: ["Najčešće 5-10 tretmana u intenzivnijoj fazi"] },
            { label: "Laserska epilacija", values: ["Najčešće 6-8 tretmana, prati biološki ciklus dlake"] },
            { label: "Mikrostrujni lifting (Laser-Sonic Face Sculpt)", values: ["Najčešće 5-10 tretmana kroz seriju"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "info",
        title: "Ovo je orijentacioni okvir, ne obećanje",
        text: "Brojevi u tabeli su opšta orijentacija, ne garancija. Terapeuti na konsultaciji retko obećavaju tačan broj unapred bez procene uživo - umesto toga daju opšti okvir i prilagođavaju ga posle prvih par seansi, kada se vidi kako organizam reaguje.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Koliko tretmana je potrebno",
        faqItems: [
          { question: "Da li mogu da vidim rezultat posle jednog tretmana?", answer: "Kod većine tretmana osećate razliku odmah (npr. lakše noge posle limfne drenaže), ali vidljiviji i trajniji rezultat gradi se kroz seriju." },
          { question: "Šta ako mi je potrebno manje ili više tretmana od preporučenog?", answer: "To je normalno - terapeut prilagođava plan tokom serije na osnovu toga kako organizam reaguje." },
          { question: "Da li paket tretmana izlazi jeftinije?", answer: "Da, paketi od više tretmana najčešće imaju povoljniju cenu po tretmanu u odnosu na pojedinačne posete." },
          { question: "Da li treba da nastavim sa održavanjem posle serije?", answer: "Za većinu tretmana da - periodično održavanje pomaže da se postignuti efekat duže zadrži." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte sve tretmane",
        text: "Pregledajte kompletnu ponudu tretmana i paketa, ili zakažite konsultaciju - terapeut će na osnovu vašeg cilja i polaznog stanja predložiti realan plan broja tretmana.",
        button: { text: "Pogledajte sve tretmane", url: "/usluge" },
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