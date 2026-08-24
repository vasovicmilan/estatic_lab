import Category from "../../models/category.model.js";
import Tag from "../../models/tag.model.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import { logInfo } from "../../utils/logger.util.js";

const DOMAIN = "post";

// ---------------------------------------------------------------------------
// SVA BLOG SADRŽAJ SEED - jedan fajl, jedan run
// ---------------------------------------------------------------------------
// Ovo je spojen fajl - sadrži sve što je ranije bilo razdvojeno u
// post-content.seed.js + pillar-a/b/c/d/e.seed.js (6 fajlova) u JEDAN, da bi
// se lakše pratio kroz git (jedan commit, jedan fajl, jedna PR granica) umesto
// šest fajlova koji se moraju pokretati tačnim redosledom.
//
// Sadržaj (56 postova ukupno):
//   - 12 originalnih postova (post-content.seed.js)          - 6 kategorija, 12 tagova
//   - 7 postova o uslugama bez sopstvenog posta (Pilar A)     - 9 novih tagova
//   - 7 postova o premium paketima (Pilar B)                 - 1 nova kategorija, 3 nova taga
//   - 12 postova o ključnim frazama (Pilar C)                 - 1 nova kategorija, 8 novih tagova
//   - 10 postova lokacija/mitovi/nalog (Pilar D)               - 3 nove kategorije, 6 novih tagova
//   - 8 postova poverenje + zaokruživanje (Pilar E)            - 5 novih tagova
// Ukupno: 11 kategorija, 43 taga, 56 postova - sve unique, bez duplikata
// (provereno programski pre spajanja).
//
// LOKACIJA: adresa je popunjena stvarnim podatkom - Maksima Gorkog 6b, Novi
// Sad, u neposrednoj blizini zgrade suda (Palate pravde) i Spensa. Radno
// vreme, tačne opcije parkinga i linije javnog prevoza i dalje nisu potvrđeni
// pa su ostavljeni kao [POPUNI: ...] placeholderi u 2 posta
// ("estetski-wellness-centar-u-novom-sadu", "kako-do-nas-parking-i-prevoz") -
// popuni ih u administraciji pre nego što ti dani zakazivanja stignu, ili će
// se auto-objaviti sa vidljivim placeholder tekstom.
//
// ⚠️ Isto važi za post "iskustva-klijenata-sta-govore" (Pilar E) - sadrži
// [POPUNI: ...] mesta za PRAVE citate klijenata (uz njihovu dozvolu) - nisu
// izmišljeni testimoniali i ne treba da budu.
//
// IDEMPOTENCY GUARD (upsertPosts, ispod): ako je post već "published" u bazi
// (npr. cron ga je već objavio, ili si ga ručno doterao u administraciji nakon
// objave), ponovno pokretanje ovog seed-a ga NE DIRA UOPŠTE - ni status, ni
// sadržaj, ni SEO, ni kategorije/tagovi. Samo postovi koji su i dalje
// "draft"/"scheduled" (ili još ne postoje) se kreiraju/ažuriraju.
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
{
    slug: "paketi-i-cene",
    name: "Paketi i cene",
    shortDescription: "Paketi tretmana - od 5/10 seansi jedne usluge do premium kombinacija ESMA tretmana i masaža.",
  },
{
    slug: "wellness-i-estetika",
    name: "Wellness i estetika",
    shortDescription: "Šira estetika, kozmetika, wellness centar i kozmetički salon - pojmovi, razlike i kako da izaberete pravu ponudu.",
  },
{
    slug: "novi-sad-i-lokacija",
    name: "Novi Sad i lokacija",
    shortDescription: "Lokalne informacije - gde se nalazimo, kako do nas i zašto klijenti iz centra Novog Sada biraju nas.",
  },
  {
    slug: "mitovi-i-cinjenice",
    name: "Mitovi i činjenice",
    shortDescription: "Raščlanjujemo najčešće mitove o estetskim tretmanima - šta je stvarno potvrđeno, a šta je samo marketing.",
  },
  {
    slug: "nalog-i-zakazivanje",
    name: "Nalog i zakazivanje",
    shortDescription: "Kako da kreirate nalog, koje funkcije platforma nudi, i zašto je online zakazivanje jednostavnije od telefonskog.",
  },
];

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
{ slug: "kombinovani-tretmani", name: "Kombinovani tretmani" },
  { slug: "terapija-bola", name: "Terapija bola" },
  { slug: "fizikalna-terapija", name: "Fizikalna terapija" },
  { slug: "relax-masaza-novi-sad", name: "Relax masaža Novi Sad" },
  { slug: "sportska-masaza-novi-sad", name: "Sportska masaža Novi Sad" },
  { slug: "masaza-za-sportiste", name: "Masaža za sportiste" },
  { slug: "terapeutska-masaza-novi-sad", name: "Terapeutska masaža Novi Sad" },
  { slug: "masaza-za-bol-u-ledjima", name: "Masaža za bol u leđima" },
  { slug: "elektrolipoliza", name: "Elektrolipoliza" },
{ slug: "paketi-tretmana", name: "Paketi tretmana" },
  { slug: "cena-tretmana", name: "Cena tretmana" },
  { slug: "premium-paketi", name: "Premium paketi" },
{ slug: "wellness-centar-novi-sad", name: "Wellness centar Novi Sad" },
  { slug: "kozmeticki-salon-novi-sad", name: "Kozmetički salon Novi Sad" },
  { slug: "estetski-salon-novi-sad", name: "Estetski salon Novi Sad" },
  { slug: "kozmetika-i-nega", name: "Kozmetika i nega" },
  { slug: "struja-tretmani", name: "Struja tretmani" },
  { slug: "ultrazvuk-u-estetici", name: "Ultrazvuk u estetici" },
  { slug: "laser-tretmani", name: "Laser tretmani" },
  { slug: "masaze-novi-sad", name: "Masaže Novi Sad" },
{ slug: "spens-novi-sad", name: "Spens Novi Sad" },
  { slug: "centar-grada-novi-sad", name: "Centar grada Novi Sad" },
  { slug: "mitovi-o-tretmanima", name: "Mitovi o tretmanima" },
  { slug: "kreiranje-naloga", name: "Kreiranje naloga" },
  { slug: "korisnicki-nalog", name: "Korisnički nalog" },
  { slug: "online-zakazivanje", name: "Online zakazivanje" },
{ slug: "iskustva-klijenata", name: "Iskustva klijenata" },
  { slug: "esma-vs-klasicni-aparati", name: "ESMA vs klasični aparati" },
  { slug: "cenovnik-tretmana", name: "Cenovnik tretmana" },
  { slug: "priprema-za-letnju-sezonu", name: "Priprema za letnju sezonu" },
  { slug: "poklon-paket", name: "Poklon paket" },
];

// ---------------------------------------------------------------------------
// Pomoćne funkcije
// ---------------------------------------------------------------------------

function blocks(list) {
  return list.map((block, i) => ({ ...block, order: i + 1 }));
}

function computeReadingTime(content) {
  const words = content
    .filter((b) => b.type === "paragraph" || b.type === "heading" || b.type === "quote")
    .reduce((sum, b) => sum + (b.text ? b.text.trim().split(/\s+/).length : 0), 0);
  return Math.max(1, Math.ceil(words / 200));
}

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
// Postovi (56)
// ---------------------------------------------------------------------------

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
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/teslatone-24-5-tretmana" },
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
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/aquadrain-360-5-tretmana" },
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
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/triactive-celluerase-5-tretmana" },
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
        button: { text: "Pogledajte paket od 5 tretmana", url: "/paketi/lasersonic-face-sculpt-5-tretmana" },
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
        button: { text: "Pogledajte paket od 10 tretmana", url: "/paketi/teslatone-24-10-tretmana" },
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

// --- 1. Tri-Active Cellu-Erase ---
  {
    slug: "tri-active-cellu-erase-kombinovani-tretman",
    title: "Tri‑Active Cellu‑Erase – kombinovani tretman protiv celulita (ultrazvuk + struja + laser)",
    excerpt:
      "Tri-Active Cellu-Erase u jednoj proceduri kombinuje ultrazvuk, interferentnu struju i svetlosnu terapiju. Objašnjavamo kako tretman izgleda, kome se najviše preporučuje i po čemu se razlikuje od standardnih ESMA tretmana.",
    categorySlugs: ["esma-tretmani", "telo-i-oblikovanje"],
    tagSlugs: ["celulit-tretman", "kombinovani-tretmani", "esma-favorit-novi-sad"],
    statusOffset: 3,
    seo: {
      title: "Tri-Active Cellu-Erase - kombinovani anticelulit tretman | Estetik Lab",
      description: "Kako Tri-Active Cellu-Erase kombinuje ultrazvuk, struju i svetlosnu terapiju protiv celulita i masnih naslaga.",
      keywords: ["tri active cellu erase", "kombinovani anticelulit tretman", "celulit tretman novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Tri tehnologije u jednoj proceduri" },
      {
        type: "paragraph",
        text: "Tri-Active Cellu-Erase je tretman na ESMA Favorit aparatu koji u jednoj, dužoj proceduri (75 minuta) objedinjuje tri različite tehnologije - ultrazvuk, interferentnu struju i svetlosnu terapiju. Ideja iza kombinovanja je da svaka faza priprema tkivo za sledeću, umesto da se tri odvojena tretmana rade u tri odvojena termina.",
      },
      { type: "heading", level: 3, text: "Kako izgleda jedna seansa" },
      {
        type: "list",
        ordered: true,
        items: [
          "Ultrazvuk - radi mikromasažu tkiva i priprema zonu za dalju obradu",
          "Interferentna struja (elektrolipoliza) - deluje na masne naslage kroz veliki broj nezavisnih kanala",
          "Svetlosna (laserska) terapija - podstiče lokalnu cirkulaciju i doprinosi osećaju zategnutije kože na kraju tretmana",
        ],
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "paragraph",
        text: "Ovaj tretman se najčešće bira kod dugotrajnog, tvrdokornog celulita na bedrima i izraženijih masnih naslaga na stomaku - situacija u kojima je jedan modalitet često nedovoljan, pa terapeut predlaže sveobuhvatniji pristup. Kao i kod svih ESMA tretmana, rezultati zavise od organizma i podrazumevaju uz to zdravu ishranu i fizičku aktivnost.",
      },
      {
        type: "callout",
        variant: "warning",
        title: "Pre zakazivanja",
        text: "Tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, epilepsijom, akutnim upalama kože ili malignim oboljenjima. Terapeut ova pitanja postavlja na konsultaciji pre prvog tretmana.",
      },
      { type: "heading", level: 2, text: "Tri-Active Cellu-Erase u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Zbog dužine i sveobuhvatnosti tretmana, Tri-Active Cellu-Erase je i osnova našeg najintenzivnijeg anticelulit paketa - Tri-Active Anticelulit MAX Premium, koji ga kombinuje sa ručnom anticelulit masažom za dodatnu podršku cirkulaciji između ESMA tretmana.",
      },
      {
        type: "serviceReference",
        title: "Tri-Active Cellu-Erase",
        text: "Kombinovani ESMA tretman (ultrazvuk + struja + svetlosna terapija) za dugotrajan i tvrdokoran celulit. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Tri-Active Cellu-Erase", url: "/zakazivanje/triactive-celluerase" },
      },
      {
        type: "serviceReference",
        title: "Tri-Active Anticelulit MAX Premium",
        text: "Naš najsveobuhvatniji anticelulit paket - 5 Tri-Active Cellu-Erase tretmana i 3 anticelulit masaže, po povoljnijoj ceni od pojedinačnih poseta.",
        button: { text: "Pogledajte premium paket", url: "/paketi/tri-active-anticelulit-max-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Tri-Active Cellu-Erase",
        faqItems: [
          { question: "Zašto tretman traje duže od ostalih ESMA procedura?", answer: "Zato što u jednoj seansi prolazite kroz tri faze - ultrazvuk, struju i svetlosnu terapiju - umesto samo jedne, pa je i vreme trajanja veće (75 umesto uobičajenih 45 minuta)." },
          { question: "Da li mogu da radim samo jednu od tri tehnologije?", answer: "Za taj cilj postoje odvojeni tretmani - npr. Lipolise Russian-Max samo za elektrolipolizu. Tri-Active Cellu-Erase je namenjen upravo kombinaciji sve tri u jednoj proceduri." },
          { question: "Koliko tretmana se preporučuje?", answer: "Najčešće serija od 5 do 10 tretmana, u zavisnosti od cilja i stanja koje terapeut proceni na konsultaciji." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Ako se borite sa dugotrajnim celulitom i želite sveobuhvatniji pristup, zakažite Tri-Active Cellu-Erase tretman ili konsultaciju sa našim terapeutom.",
        button: { text: "Zakažite termin", url: "/zakazivanje/triactive-celluerase" },
      },
    ]),
  },

  // --- 2. Medicinski Bio-Reset ---
  {
    slug: "medicinski-bio-reset-fizikalna-terapija",
    title: "Medicinski Bio‑Reset – fizikalna terapija za bol u leđima, vratu i zglobovima",
    excerpt:
      "Medicinski Bio-Reset kombinuje interferentne struje, ultrazvuk i svetlosnu terapiju radi ublažavanja bola i mišićne napetosti. Objašnjavamo kome je namenjen i zašto je dopuna, a ne zamena za lekarski tretman.",
    categorySlugs: ["esma-tretmani"],
    tagSlugs: ["terapija-bola", "fizikalna-terapija", "esma-favorit-novi-sad"],
    statusOffset: 6,
    seo: {
      title: "Medicinski Bio-Reset - fizikalna terapija za bol | Estetik Lab",
      description: "Kako Medicinski Bio-Reset pomaže kod bola u leđima, vratu i zglobovima, i kome se najviše preporučuje.",
      keywords: ["medicinski bio reset", "fizikalna terapija novi sad", "terapija bola esma"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kada mišićna napetost i bol postanu svakodnevica" },
      {
        type: "paragraph",
        text: "Bol u leđima, vratu ili zglobovima često nastaje kao posledica dugog sedenja, lošeg držanja tela ili intenzivnijeg fizičkog napora - kod sportista posle treninga, ali i kod ljudi sa sedelačkim poslom. Medicinski Bio-Reset je tretman na ESMA Favorit aparatu razvijen upravo za ovakve situacije, kao dopuna redovnoj fizikalnoj terapiji.",
      },
      { type: "heading", level: 3, text: "Šta tretman kombinuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "Interferentne struje - deluju na zglob ili mišić i mogu doprineti smanjenju osećaja bola i mišićnog spazma",
          "Ultrazvuk - koristi se za mikromasažu tkiva",
          "Svetlosna terapija - podstiče lokalnu cirkulaciju",
        ],
      },
      {
        type: "callout",
        variant: "danger",
        title: "Ovo nije zamena za lekarski pregled",
        text: "Medicinski Bio-Reset je dopuna - ne zamena - redovnoj fizikalnoj terapiji i lekarskom tretmanu. Kod jakog, dugotrajnog ili novonastalog bola, uvek prvo potražite pregled lekara ili fizijatra.",
      },
      { type: "heading", level: 3, text: "Kome se najčešće preporučuje" },
      {
        type: "paragraph",
        text: "Sportistima kao deo redovnog oporavka, osobama sa hroničnom napetošću u vratu i ramenima nastalom usled sedenja za kompjuterom, kao i onima koji se oporavljaju od manjih povreda zglobova. Terapeut na konsultaciji procenjuje da li je ovaj tretman odgovarajući u vašoj konkretnoj situaciji.",
      },
      { type: "heading", level: 2, text: "Medicinski Bio-Reset u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Tretman traje 45 minuta i preporučuje se u seriji od 5 do 10 poseta. Za sportiste i rekreativce koji uz ublažavanje bola žele i podršku oporavku mišića, kombinujemo ga sa sportskom masažom u okviru Sport Recovery Premium paketa.",
      },
      {
        type: "serviceReference",
        title: "Medicinski Bio-Reset",
        text: "Fizikalni ESMA tretman za bol i mišićnu napetost - interferentne struje, ultrazvuk i svetlosna terapija. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Medicinski Bio-Reset", url: "/zakazivanje/medicinski-bioreset" },
      },
      {
        type: "serviceReference",
        title: "Sport Recovery Premium",
        text: "5 tretmana Medicinski Bio-Reset i 3 sportske masaže - kombinacija za sveobuhvatniju podršku oporavku sportista i rekreativaca.",
        button: { text: "Pogledajte premium paket", url: "/paketi/sport-recovery-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Medicinski Bio-Reset",
        faqItems: [
          { question: "Da li Medicinski Bio-Reset leči uzrok bola?", answer: "Ne - tretman može doprineti smanjenju osećaja bola i mišićnog spazma, ali ne zamenjuje dijagnostiku i lečenje uzroka kod lekara ili fizijatra." },
          { question: "Da li mogu da radim ovaj tretman ako imam akutnu povredu?", answer: "Kod akutnih povreda prvo je potreban lekarski pregled - terapeut će na konsultaciji proceniti da li je i kada tretman bezbedan za vas." },
          { question: "Koliko često se preporučuje dolazak?", answer: "Najčešće nekoliko puta nedeljno u intenzivnijoj fazi, a terapeut prilagođava dinamiku vašem stanju i rasporedu." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Ako vas prati hronična napetost ili bol nakon napora, zakažite Medicinski Bio-Reset tretman ili konsultaciju sa terapeutom.",
        button: { text: "Zakažite termin", url: "/zakazivanje/medicinski-bioreset" },
      },
    ]),
  },

  // --- 3. Relaks masaža ---
  {
    slug: "relaks-masaza-kako-izgleda",
    title: "Relaks masaža – kako izgleda prava antistres masaža",
    excerpt:
      "Relaks masaža koristi blage, ritmične pokrete za opuštanje tela i uma. Objašnjavamo razliku između varijante od 30 i 60 minuta, i kome se najviše preporučuje.",
    categorySlugs: ["masaza-i-relaksacija"],
    tagSlugs: ["relaksaciona-masaza", "relax-masaza-novi-sad"],
    statusOffset: 10,
    seo: {
      title: "Relaks masaža Novi Sad - antistres masaža | Estetik Lab",
      description: "Kako izgleda relaks masaža, koja je razlika između 30 i 60 minuta, i kome se najviše preporučuje.",
      keywords: ["relaks masaza novi sad", "antistres masaza", "opustajuca masaza"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kada je telu i umu potreban predah" },
      {
        type: "paragraph",
        text: "Relaks masaža je klasična ručna masaža blagim, ritmičnim pokretima namenjena opštem opuštanju. Za razliku od sportske ili terapeutske masaže koje ciljano rade na određenom problemu, relaks masaža ima jedan cilj - da smanji napetost nastalu usled stresa, dugog sedenja ili svakodnevnog fizičkog opterećenja.",
      },
      { type: "heading", level: 3, text: "Dve varijante, po vašem izboru" },
      {
        type: "list",
        ordered: false,
        items: [
          "30 minuta - gornji deo tela (vrat, ramena, leđa, ruke) ili donji deo tela (noge, stopala, donji deo leđa)",
          "60 minuta - celo telo",
        ],
      },
      {
        type: "paragraph",
        text: "Redovna relaks masaža može doprineti boljem kvalitetu sna i opštem osećaju odmornosti, uz podsticanje lokalne cirkulacije krvi. Nije zamena za medicinski tretman, već pre svega alat za prevenciju i opšte blagostanje.",
      },
      { type: "heading", level: 2, text: "Relaks masaža u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Ako uz opuštanje želite i podršku drugom tretmanu, relaks masažu kombinujemo sa ESMA tretmanima u dva premium paketa: Detox & Relax Premium (uz limfnu drenažu Aqua-Drain 360, varijanta 60 minuta) i Sculpt & Glow Premium (uz lifting lica Laser-Sonic Face Sculpt, varijanta 30 minuta gornji deo tela).",
      },
      {
        type: "serviceReference",
        title: "Relaks masaža",
        text: "Klasična opuštajuća masaža - 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
        button: { text: "Zakažite relaks masažu", url: "/zakazivanje/relaks-masaza" },
      },
      {
        type: "serviceReference",
        title: "Detox & Relax Premium",
        text: "5 tretmana Aqua-Drain 360 (limfna drenaža) i 3 relaks masaže celog tela - za lagane noge i osećaj opuštenosti u jednom paketu.",
        button: { text: "Pogledajte premium paket", url: "/paketi/detox-relax-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Relaks masaža",
        faqItems: [
          { question: "Koju varijantu da izaberem - 30 ili 60 minuta?", answer: "Ako imate ograničeno vreme ili želite da se fokusirate na jednu zonu (npr. vrat i ramena posle rada za kompjuterom), 30 minuta je dovoljno. Za opšte opuštanje celog tela biramo 60 minuta." },
          { question: "Koliko često je preporučljivo raditi relaks masažu?", answer: "Nema strogog pravila - mnogi klijenti je biraju kao redovan mesečni ritual, drugi po potrebi u periodima povećanog stresa." },
          { question: "Da li relaks masaža rešava bol u leđima?", answer: "Za ciljano rešavanje hronične napetosti i mišićnih čvorića, terapeutska masaža je pogodniji izbor - relaks masaža je pre svega za opšte opuštanje." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite termin za opuštanje",
        text: "Odvojite vreme za sebe - zakažite relaks masažu u terminu koji vam odgovara.",
        button: { text: "Zakažite termin", url: "/zakazivanje/relaks-masaza" },
      },
    ]),
  },

  // --- 4. Sportska masaža ---
  {
    slug: "sportska-masaza-priprema-i-oporavak",
    title: "Sportska masaža – priprema i oporavak za sportiste i rekreativce",
    excerpt:
      "Sportska masaža koristi dublje, ciljane tehnike prilagođene fizički aktivnim osobama. Objašnjavamo kada je bolje raditi je pre, a kada posle treninga.",
    categorySlugs: ["masaza-i-relaksacija"],
    tagSlugs: ["sportska-masaza-novi-sad", "masaza-za-sportiste"],
    statusOffset: 13,
    seo: {
      title: "Sportska masaža Novi Sad - oporavak posle treninga | Estetik Lab",
      description: "Kako sportska masaža pomaže u pripremi pre treninga i oporavku posle napora, i kome se preporučuje.",
      keywords: ["sportska masaza novi sad", "masaza za sportiste", "masaza za oporavak misica"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Masaža prilagođena fizički aktivnim osobama" },
      {
        type: "paragraph",
        text: "Sportska masaža koristi dublje, ciljane tehnike - gnječenje, kompresiju, istezanje - prilagođene onima koji se redovno fizički opterećuju, bilo profesionalno bilo rekreativno. Za razliku od relaks masaže koja teži opštem opuštanju, sportska masaža ima konkretan cilj: pripremu mišića pre napora ili podršku oporavku posle njega.",
      },
      { type: "heading", level: 3, text: "Pre ili posle treninga - kada je koja korisna" },
      {
        type: "list",
        ordered: false,
        items: [
          "Pre treninga - može pomoći u pripremi mišića i poboljšanju fleksibilnosti",
          "Posle napora - pomaže u smanjenju osećaja ukočenosti i zamora, podržavajući oporavak",
        ],
      },
      {
        type: "paragraph",
        text: "Varijanta od 30 minuta pokriva gornji ili donji deo tela (npr. samo noge nakon trčanja), dok varijanta od 60 minuta obuhvata celo telo. Terapeut na konsultaciji predlaže koja varijanta i dinamika najviše odgovaraju vašem tipu aktivnosti.",
      },
      { type: "heading", level: 2, text: "Sportska masaža u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Za sportiste i rekreativce koji uz masažu žele i podršku kod bola i napetosti, sportsku masažu kombinujemo sa fizikalnim ESMA tretmanom Medicinski Bio-Reset u okviru Sport Recovery Premium paketa.",
      },
      {
        type: "serviceReference",
        title: "Sportska masaža",
        text: "Masaža prilagođena sportistima i rekreativcima - 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
        button: { text: "Zakažite sportsku masažu", url: "/zakazivanje/sportska-masaza" },
      },
      {
        type: "serviceReference",
        title: "Sport Recovery Premium",
        text: "5 tretmana Medicinski Bio-Reset i 3 sportske masaže - kombinacija za sveobuhvatniju podršku oporavku.",
        button: { text: "Pogledajte premium paket", url: "/paketi/sport-recovery-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Sportska masaža",
        faqItems: [
          { question: "Da li sportska masaža boli?", answer: "Tehnike su dublje i intenzivnije nego kod relaks masaže, pa je pritisak jači, ali terapeut ga prilagođava vašem pragu tolerancije - cilj nije bol već rad na mišićima." },
          { question: "Koliko brzo posle treninga mogu na masažu?", answer: "To zavisi od intenziteta treninga i vašeg stanja - terapeut na konsultaciji predlaže najbolji trenutak za vašu situaciju." },
          { question: "Da li je namenjena samo profesionalnim sportistima?", answer: "Ne - podjednako je korisna i rekreativcima koji redovno treniraju, trče ili se bave nekim sportom." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite sportsku masažu",
        text: "Bilo da se pripremate za takmičenje ili se oporavljate posle napora, zakažite sportsku masažu prilagođenu vašem telu.",
        button: { text: "Zakažite termin", url: "/zakazivanje/sportska-masaza" },
      },
    ]),
  },

  // --- 5. Terapeutska masaža ---
  {
    slug: "terapeutska-masaza-hronicna-napetost",
    title: "Terapeutska masaža – rešavanje hronične napetosti i mišićnih čvorića",
    excerpt:
      "Terapeutska masaža koristi tehnike dubinskog rada na mišićima za ublažavanje hronične napetosti u vratu, ramenima i leđima. Objašnjavamo kome je najviše potrebna.",
    categorySlugs: ["masaza-i-relaksacija"],
    tagSlugs: ["terapeutska-masaza-novi-sad", "masaza-za-bol-u-ledjima"],
    statusOffset: 17,
    seo: {
      title: "Terapeutska masaža Novi Sad - napetost u vratu i leđima | Estetik Lab",
      description: "Kako terapeutska masaža radi na hroničnoj napetosti, mišićnim čvorićima i posledicama dugog sedenja.",
      keywords: ["terapeutska masaza novi sad", "masaza za bol u ledjima", "masaza za napetost u vratu"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kada napetost postane hronična" },
      {
        type: "paragraph",
        text: "Dugotrajno sedenje, loše držanje tela i ponavljajući pokreti tokom dana često dovode do hronične napetosti u vratu, ramenima i leđima - ne prolaznog osećaja posle napornog dana, već stanja koje se vraća iz nedelje u nedelju. Terapeutska masaža je ručna tehnika razvijena upravo za rad na ovakvim, upornim zonama.",
      },
      { type: "heading", level: 3, text: "Kako terapeut pristupa problemu" },
      {
        type: "paragraph",
        text: "Terapeut identifikuje zategnute zone i mišićne čvoriće i radi na njihovom postepenom otpuštanju kroz kombinaciju pritiska i istezanja - tehnika dubinskog rada na mišićima, sporija i ciljanija od relaks masaže. Dostupna je varijanta od 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
      },
      {
        type: "callout",
        variant: "info",
        title: "Dopuna, ne zamena za fizikalnu terapiju",
        text: "Terapeutska masaža može biti koristan dodatak fizikalnoj terapiji, ali je ne zamenjuje niti predstavlja medicinsko lečenje. Kod izraženog ili dugotrajnog bola, prvo se obratite lekaru ili fizijatru.",
      },
      { type: "heading", level: 2, text: "Terapeutska masaža u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Za klijente koji uz otpuštanje napetosti žele i podršku tonusu mišića, terapeutsku masažu kombinujemo sa miostimulacijom Tesla-Tone 24 u okviru Tonus & Terapeutska Premium paketa.",
      },
      {
        type: "serviceReference",
        title: "Terapeutska masaža",
        text: "Ciljana masaža za hroničnu napetost i mišićne čvoriće - 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
        button: { text: "Zakažite terapeutsku masažu", url: "/zakazivanje/terapeutska-masaza" },
      },
      {
        type: "serviceReference",
        title: "Tonus & Terapeutska Premium",
        text: "5 tretmana Tesla-Tone 24 (miostimulacija) i 3 terapeutske masaže - tonus mišića uz podršku u otpuštanju napetosti.",
        button: { text: "Pogledajte premium paket", url: "/paketi/tonus-terapeutska-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Terapeutska masaža",
        faqItems: [
          { question: "Po čemu se terapeutska masaža razlikuje od relaks masaže?", answer: "Terapeutska masaža ciljano radi na zategnutim zonama i mišićnim čvorićima dubinskim tehnikama, dok relaks masaža blagim pokretima opušta celo telo bez fokusa na konkretan problem." },
          { question: "Da li terapeutska masaža boli?", answer: "Rad na zategnutim zonama može biti neprijatan u trenutku pritiska, ali terapeut prilagođava intenzitet vašem pragu tolerancije." },
          { question: "Koliko tretmana je potrebno za osećaj razlike?", answer: "Mnogi oseti olakšanje već posle jedne posete, ali za hroničnu napetost terapeut najčešće predlaže nekoliko masaža u razmaku od nedelju dana." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite terapeutsku masažu",
        text: "Ako vas prati napetost u vratu, ramenima ili leđima, zakažite terapeutsku masažu i porazgovarajte sa terapeutom o planu.",
        button: { text: "Zakažite termin", url: "/zakazivanje/terapeutska-masaza" },
      },
    ]),
  },

  // --- 6. Anticelulit masaža ---
  {
    slug: "anticelulit-masaza-rucna-tehnika",
    title: "Anticelulit masaža – ručna tehnika koja se razlikuje od aparaturne",
    excerpt:
      "Ručna anticelulit masaža podstiče lokalnu cirkulaciju i limfnu drenažu. Objašnjavamo šta realno može, a šta ne, i kako se razlikuje od ESMA elektrolipolize.",
    categorySlugs: ["masaza-i-relaksacija", "telo-i-oblikovanje"],
    tagSlugs: ["anticelulit-masaza", "celulit-tretman"],
    statusOffset: 20,
    seo: {
      title: "Anticelulit masaža Novi Sad - ručna tehnika | Estetik Lab",
      description: "Šta ručna anticelulit masaža realno može, a šta ne, i kako se razlikuje od aparaturnih ESMA tretmana.",
      keywords: ["anticelulit masaza novi sad", "rucna masaza protiv celulita", "masaza za celulit"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Šta ručna anticelulit masaža realno radi" },
      {
        type: "paragraph",
        text: "Anticelulit masaža koristi intenzivnije tehnike gnječenja i rolanja kože u zonama sklonim celulitu - najčešće na butinama, bokovima i stomaku - kako bi podstakla lokalnu cirkulaciju krvi i limfe. Važno je biti jasan: ručna masaža ne menja trajno strukturu vezivnog tkiva niti uklanja masne naslage.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Za izraženiji rad na masnim naslagama",
        text: "Za direktniji rad na masnim naslagama, pogledajte naše ESMA tretmane poput Lipolise Russian-Max (elektrolipoliza). Ručna masaža i aparaturni tretman rade na problemu sa dve različite strane, a ne isključuju jedno drugo.",
      },
      { type: "heading", level: 3, text: "Šta realno možete očekivati" },
      {
        type: "paragraph",
        text: "Redovni tretmani mogu doprineti boljoj teksturi kože i privremenom poboljšanju izgleda kože sklone celulitu, naročito u kombinaciji sa zdravom ishranom i fizičkom aktivnošću. Dostupna je varijanta od 30 minuta (gornji ili donji deo tela) i 60 minuta (celo telo).",
      },
      { type: "heading", level: 2, text: "Anticelulit masaža u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Anticelulit masažu često kombinujemo sa ESMA elektrolipolizom u dva premium paketa - Anticelulit Premium (uz Lipolise Russian-Max) i Tri-Active Anticelulit MAX Premium (uz kombinovani Tri-Active Cellu-Erase tretman), za sveobuhvatniji pristup celulitu.",
      },
      {
        type: "serviceReference",
        title: "Anticelulit masaža",
        text: "Ručna anticelulit masaža - 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo).",
        button: { text: "Zakažite anticelulit masažu", url: "/zakazivanje/anticelulit-masaza" },
      },
      {
        type: "serviceReference",
        title: "Anticelulit Premium",
        text: "5 tretmana Lipolise Russian-Max i 3 anticelulit masaže - elektrolipoliza i ručni rad na cirkulaciji u jednom paketu.",
        button: { text: "Pogledajte premium paket", url: "/paketi/anticelulit-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Anticelulit masaža",
        faqItems: [
          { question: "Da li anticelulit masaža trajno uklanja celulit?", answer: "Ne. Ručna masaža ne menja trajno strukturu vezivnog tkiva niti uklanja masne naslage - može doprineti boljoj teksturi kože i cirkulaciji, u kombinaciji sa zdravim navikama." },
          { question: "Šta je efikasnije - masaža ili ESMA elektrolipoliza?", answer: "To nisu konkurenti već dopuna jedno drugom - elektrolipoliza deluje na masne ćelije, a masaža na cirkulaciju okolnog tkiva. Terapeut na konsultaciji predlaže pristup prema vašem cilju." },
          { question: "Koliko često se preporučuje anticelulit masaža?", answer: "Za osećaj poboljšane teksture kože, najčešće se preporučuje serija tretmana u razmaku od nekoliko dana do nedelju dana." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite anticelulit masažu",
        text: "Za podršku cirkulaciji i boljoj teksturi kože, zakažite anticelulit masažu ili se konsultujte o kombinaciji sa ESMA tretmanom.",
        button: { text: "Zakažite termin", url: "/zakazivanje/anticelulit-masaza" },
      },
    ]),
  },

  // --- 7. Lipolise Russian-Max ---
  {
    slug: "lipolise-russian-max-elektrolipoliza",
    title: "Lipolise Russian‑Max – elektrolipoliza za masne naslage i celulit",
    excerpt:
      "Lipolise Russian-Max koristi struju da deluje na masne ćelije u tretiranoj zoni. Objašnjavamo kako elektrolipoliza radi i kome se najviše preporučuje.",
    categorySlugs: ["telo-i-oblikovanje", "esma-tretmani"],
    tagSlugs: ["celulit-tretman", "elektrolipoliza", "esma-favorit-novi-sad"],
    statusOffset: 24,
    seo: {
      title: "Lipolise Russian-Max - elektrolipoliza Novi Sad | Estetik Lab",
      description: "Kako elektrolipoliza Lipolise Russian-Max deluje na masne naslage i celulit, i kome se preporučuje.",
      keywords: ["lipolise russian max", "elektrolipoliza novi sad", "masne naslage tretman"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kako elektrolipoliza deluje na masne ćelije" },
      {
        type: "paragraph",
        text: "Lipolise Russian-Max je tretman elektrolipolize na ESMA Favorit aparatu. Struje deluju na masne ćelije (adipocite) u tretiranoj zoni, podstičući oslobađanje masnih naslaga koje se dalje prirodno metabolišu i izbacuju putem limfnog sistema.",
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "Lokalizovane masne naslage na stomaku, bokovima i \"jahaćim pantalonama\"",
          "Tvrdokorni celulit koji se sporije menja",
          "Kao deo šireg plana uz zdravu ishranu i fizičku aktivnost, ne kao samostalno rešenje",
        ],
      },
      {
        type: "paragraph",
        text: "Rezultat je postepeno smanjenje obima na tretiranim zonama i utisak glađe kože. Kao i kod svih ESMA tretmana, brzina i obim rezultata zavise od organizma - terapeut na konsultaciji daje realan okvir očekivanja, ne garanciju.",
      },
      { type: "heading", level: 2, text: "Lipolise Russian-Max u Estetik Lab-u" },
      {
        type: "paragraph",
        text: "Tretman traje 45 minuta i preporučuje se u seriji od 5 do 10 poseta. Za sveobuhvatniji pristup celulitu, kombinujemo ga sa ručnom anticelulit masažom u okviru Anticelulit Premium paketa.",
      },
      {
        type: "serviceReference",
        title: "Lipolise Russian-Max",
        text: "Elektrolipoliza na ESMA Favorit aparatu za masne naslage i celulit. Preporučuje se serija od 5 do 10 tretmana.",
        button: { text: "Zakažite Lipolise Russian-Max", url: "/zakazivanje/lipolise-russianmax" },
      },
      {
        type: "serviceReference",
        title: "Anticelulit Premium",
        text: "5 tretmana Lipolise Russian-Max i 3 anticelulit masaže - najsveobuhvatniji anticelulit paket srednjeg intenziteta.",
        button: { text: "Pogledajte premium paket", url: "/paketi/anticelulit-premium" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Lipolise Russian-Max",
        faqItems: [
          { question: "Da li elektrolipoliza trajno smanjuje broj masnih ćelija?", answer: "Tretman podstiče oslobađanje masnih naslaga iz ćelija u tretiranoj zoni, ali dugoročni rezultat zavisi i od ishrane i fizičke aktivnosti nakon serije tretmana." },
          { question: "Da li je bolno?", answer: "Osećaj je stimulacija i blagi trnci, ne bol - intenzitet se prilagođava individualno." },
          { question: "Koja je razlika u odnosu na Tri-Active Cellu-Erase?", answer: "Lipolise Russian-Max je samo elektrolipoliza (45 min), dok Tri-Active Cellu-Erase kombinuje elektrolipolizu sa ultrazvukom i svetlosnom terapijom u dužoj proceduri (75 min) - terapeut predlaže koji je pogodniji za vaš cilj." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Lipolise Russian-Max",
        text: "Ako radite na lokalizovanim masnim naslagama ili tvrdokornom celulitu, zakažite Lipolise Russian-Max tretman ili konsultaciju.",
        button: { text: "Zakažite termin", url: "/zakazivanje/lipolise-russianmax" },
      },
    ]),
  },

// --- 1. Anticelulit Premium ---
  {
    slug: "anticelulit-premium-paket-tretmana",
    title: "Anticelulit Premium paket – kada elektrolipoliza i ručna masaža rade zajedno",
    excerpt:
      "Anticelulit Premium kombinuje 5 tretmana Lipolise Russian-Max i 3 anticelulit masaže po povoljnijoj ceni od pojedinačnih poseta. Objašnjavamo zašto je kombinacija smislenija od samo jedne usluge.",
    categorySlugs: ["paketi-i-cene", "telo-i-oblikovanje"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "celulit-tretman"],
    statusOffset: 27,
    seo: {
      title: "Anticelulit Premium paket - Lipolise + masaža | Estetik Lab",
      description: "Anticelulit Premium kombinuje elektrolipolizu i ručnu anticelulit masažu u jednom paketu, uz uštedu u odnosu na pojedinačne posete.",
      keywords: ["anticelulit premium paket", "elektrolipoliza i masaza", "kombinovani anticelulit tretman novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Zašto kombinovati dve različite usluge" },
      {
        type: "paragraph",
        text: "Elektrolipoliza (Lipolise Russian-Max) i ručna anticelulit masaža deluju na problem sa dve različite strane - struja radi na masnim ćelijama u tretiranoj zoni, dok masaža podstiče lokalnu cirkulaciju i limfnu drenažu okolnog tkiva. Anticelulit Premium paket spaja obe usluge u jednu celinu, po povoljnijoj ceni nego da se kupe pojedinačno.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Lipolise Russian-Max (45 minuta, elektrolipoliza na ESMA Favorit aparatu) - glavni akcenat paketa",
          "3 anticelulit masaže celog tela (60 minuta, ručna tehnika) - sporedni akcenat, dopuna cirkulaciji",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena obe usluge",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako se raspoređuju termini",
        text: "Sesije obe usluge se zakazuju pojedinačno, u dogovoru sa terapeutom - najčešće se anticelulit masaža radi u danima između ESMA tretmana, radi kontinuirane podrške cirkulaciji tokom celog paketa.",
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "paragraph",
        text: "Klijentima koji žele sveobuhvatniji pristup radu na celulitu i lokalizovanim masnim naslagama nego što to pruža samo jedna usluga, uz redovnu fizičku aktivnost i zdravu ishranu za najbolje rezultate. Ako imate izraženiji, dugotrajniji celulit, pogledajte i naš intenzivniji Tri-Active Anticelulit MAX Premium paket.",
      },
      {
        type: "serviceReference",
        title: "Lipolise Russian-Max",
        text: "Elektrolipoliza na ESMA Favorit aparatu - glavni akcenat ovog paketa.",
        button: { text: "Pročitajte više o Lipolise Russian-Max", url: "/zakazivanje/lipolise-russianmax" },
      },
      {
        type: "serviceReference",
        title: "Anticelulit masaža",
        text: "Ručna anticelulit masaža celog tela - sporedni akcenat ovog paketa.",
        button: { text: "Pročitajte više o anticelulit masaži", url: "/zakazivanje/anticelulit-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Anticelulit Premium",
        faqItems: [
          { question: "Da li moram sve tretmane da iskoristim odjednom?", answer: "Ne. Paket se plaća unapred, a sve sesije (i ESMA tretmani i masaže) se zakazuju pojedinačno u dogovoru sa terapeutom, prema vašem rasporedu." },
          { question: "Da li mogu redosled da prilagodim sebi?", answer: "Da - terapeut na konsultaciji predlaže raspored, ali finalni termin uvek zakazujete vi." },
          { question: "Šta ako mi treba intenzivniji pristup?", answer: "Za izraženiji, tvrdokorni celulit pogledajte Tri-Active Anticelulit MAX Premium, koji koristi kombinovani Tri-Active Cellu-Erase tretman umesto samostalne elektrolipolize." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Anticelulit Premium paket",
        text: "Pogledajte tačnu cenu i rezervišite Anticelulit Premium paket, ili se konsultujte sa terapeutom o tome da li je pravi izbor za vas.",
        button: { text: "Pogledajte paket", url: "/paketi/anticelulit-premium" },
      },
    ]),
  },

  // --- 2. Tri-Active Anticelulit MAX Premium ---
  {
    slug: "tri-active-anticelulit-max-premium-paket",
    title: "Tri‑Active Anticelulit MAX Premium – naš najsveobuhvatniji paket protiv celulita",
    excerpt:
      "Tri-Active Anticelulit MAX Premium kombinuje kombinovani ESMA tretman (ultrazvuk + struja + laser) sa ručnom anticelulit masažom. Objašnjavamo kome se preporučuje ovaj, naš najintenzivniji anticelulit paket.",
    categorySlugs: ["paketi-i-cene", "telo-i-oblikovanje"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "celulit-tretman", "kombinovani-tretmani"],
    statusOffset: 30,
    seo: {
      title: "Tri-Active Anticelulit MAX Premium paket | Estetik Lab",
      description: "Naš najsveobuhvatniji anticelulit paket - Tri-Active Cellu-Erase i anticelulit masaža za tvrdokorni celulit.",
      keywords: ["tri active anticelulit max", "najjaci anticelulit paket novi sad", "tvrdokorni celulit tretman"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kada je jedan modalitet nedovoljan" },
      {
        type: "paragraph",
        text: "Za dugotrajan i tvrdokoran celulit, terapeut često predlaže sveobuhvatniji pristup nego jedan tretman. Tri-Active Anticelulit MAX Premium je naš najintenzivniji paket u ovoj kategoriji - spaja kombinovani ESMA tretman koji već sam po sebi objedinjuje tri tehnologije, sa ručnom anticelulit masažom.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Tri-Active Cellu-Erase (75 minuta - ultrazvuk, interferentna struja i svetlosna terapija u jednoj proceduri) - glavni akcenat",
          "3 anticelulit masaže celog tela (60 minuta, ručna tehnika) - sporedni akcenat",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Zašto je ovo naš 'najbolji izbor' paket",
        text: "Ovo je jedina kombinacija koja spaja tehnološki najsveobuhvatniji ESMA tretman (već tri modaliteta u jednoj proceduri) sa ručnim radom - za klijente koji žele da ulože maksimalno u rad na celulitu.",
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "paragraph",
        text: "Klijentima sa dugotrajnim, tvrdokornim celulitom kojima je potreban duži ciklus da bi se videla primetnija razlika. Ako vam je potreban blaži uvod pre ovakvog intenziteta, pogledajte i standardni Anticelulit Premium paket (Lipolise Russian-Max + anticelulit masaža).",
      },
      {
        type: "serviceReference",
        title: "Tri-Active Cellu-Erase",
        text: "Kombinovani ESMA tretman - ultrazvuk, struja i svetlosna terapija u jednoj proceduri od 75 minuta.",
        button: { text: "Pročitajte više o Tri-Active Cellu-Erase", url: "/zakazivanje/triactive-celluerase" },
      },
      {
        type: "serviceReference",
        title: "Anticelulit masaža",
        text: "Ručna anticelulit masaža celog tela - dopuna cirkulaciji između ESMA tretmana.",
        button: { text: "Pročitajte više o anticelulit masaži", url: "/zakazivanje/anticelulit-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Tri-Active Anticelulit MAX Premium",
        faqItems: [
          { question: "Koliko ukupno traje ceo paket?", answer: "8 poseta - 5 Tri-Active Cellu-Erase tretmana (75 minuta) i 3 anticelulit masaže (60 minuta), ukupno oko 9 sati i 15 minuta raspoređeno kroz nekoliko nedelja." },
          { question: "Da li je ovaj paket skuplji od Anticelulit Premium?", answer: "Da, jer Tri-Active Cellu-Erase je duži i tehnološki sveobuhvatniji tretman od Lipolise Russian-Max - terapeut na konsultaciji pomaže da procenite koji nivo intenziteta odgovara vašem stanju." },
          { question: "Da li rezultat zavisi samo od tretmana?", answer: "Ne - kao i kod svih anticelulit tretmana, rezultati zavise i od zdrave ishrane i redovne fizičke aktivnosti uz seriju tretmana." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Tri-Active Anticelulit MAX Premium",
        text: "Pogledajte tačnu cenu ili se konsultujte sa terapeutom o tome da li je ovo pravi nivo intenziteta za vas.",
        button: { text: "Pogledajte paket", url: "/paketi/tri-active-anticelulit-max-premium" },
      },
    ]),
  },

  // --- 3. Sculpt & Glow Premium ---
  {
    slug: "sculpt-glow-premium-paket-lice",
    title: "Sculpt & Glow Premium – lifting lica uz opuštanje vrata i ramena",
    excerpt:
      "Sculpt & Glow Premium kombinuje mikrostrujni lifting lica Laser-Sonic Face Sculpt sa relaks masažom gornjeg dela tela. Objašnjavamo zašto opuštanje vrata i ramena dopunjuje efekat na licu.",
    categorySlugs: ["paketi-i-cene", "lice-i-lifting"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "lifting-lica-bez-igala"],
    statusOffset: 34,
    seo: {
      title: "Sculpt & Glow Premium - lifting lica i masaža | Estetik Lab",
      description: "Sculpt & Glow Premium kombinuje mikrostrujni lifting lica sa relaks masažom vrata i ramena za dodatnu zategnutost i svežinu.",
      keywords: ["lifting lica i masaza paket", "sculpt glow premium", "anti-aging paket novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Zašto se uz tretman lica dodaje masaža vrata, a ne lica" },
      {
        type: "paragraph",
        text: "Napetost u vratu i ramenima često se prenosi na mišiće lica i držanje glave - dugo sedenje za kompjuterom ili stres se vidi i u napetom izrazu lica. Sculpt & Glow Premium zato ne dodaje još jedan tretman lica, već relaks masažu gornjeg dela tela, koja dopunjuje efekat mikrostrujnog liftinga umesto da ga duplira.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Laser-Sonic Face Sculpt (45 minuta - mikrostruje, ultrazvuk i svetlosna terapija za lice) - glavni akcenat",
          "3 relaks masaže gornjeg dela tela (30 minuta - vrat, ramena, leđa, ruke) - sporedni akcenat",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena",
        ],
      },
      {
        type: "paragraph",
        text: "Laser-Sonic Face Sculpt radi nežan miolifting i podstiče unos aktivnih sastojaka u kožu, dok relaks masaža smanjuje mišićnu napetost nastalu usled stresa ili dugog sedenja. Rezultat je zategnutiji, odmorniji i sjajniji izgled - ne samo lica, već i celokupnog držanja.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Da li mogu da izaberem donji deo tela umesto gornjeg?",
        text: "Varijanta uključena u ovaj paket je gornji deo tela, jer najviše dopunjuje efekat tretmana lica. Za drugačiju kombinaciju masaže, javite se terapeutu na konsultaciji.",
      },
      {
        type: "serviceReference",
        title: "Laser-Sonic Face Sculpt",
        text: "Mikrostrujni lifting lica bez igala - glavni akcenat ovog paketa.",
        button: { text: "Pročitajte više o Laser-Sonic Face Sculpt", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
      {
        type: "serviceReference",
        title: "Relaks masaža",
        text: "Relaks masaža gornjeg dela tela (vrat, ramena, leđa, ruke) - sporedni akcenat ovog paketa.",
        button: { text: "Pročitajte više o relaks masaži", url: "/zakazivanje/relaks-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Sculpt & Glow Premium",
        faqItems: [
          { question: "Da li relaks masaža smanjuje efekat tretmana lica?", answer: "Ne - naprotiv, opuštanje vrata i ramena dopunjuje efekat liftinga, jer se napetost iz te regije često prenosi na izraz i konturu lica." },
          { question: "Da li je paket pogodan za mušku i žensku kožu?", answer: "Da, oba tretmana su prilagodljiva svim tipovima kože - terapeut prilagođava pristup na konsultaciji." },
          { question: "Koliko traje efekat?", answer: "Kao i kod svih ESMA tretmana za lice, efekat je vidljiv odmah nakon tretmana, a za dugotrajniji rezultat preporučuje se cela serija, uz periodično održavanje." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Sculpt & Glow Premium",
        text: "Pogledajte tačnu cenu i rezervišite Sculpt & Glow Premium paket.",
        button: { text: "Pogledajte paket", url: "/paketi/sculpt-glow-premium" },
      },
    ]),
  },

  // --- 4. Sport Recovery Premium ---
  {
    slug: "sport-recovery-premium-paket",
    title: "Sport Recovery Premium – fizikalna terapija i sportska masaža za sportiste",
    excerpt:
      "Sport Recovery Premium kombinuje fizikalni ESMA tretman Medicinski Bio-Reset sa sportskom masažom. Namenjen sportistima i rekreativcima koji žele sveobuhvatniju podršku oporavku.",
    categorySlugs: ["paketi-i-cene", "esma-tretmani"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "terapija-bola", "masaza-za-sportiste"],
    statusOffset: 37,
    seo: {
      title: "Sport Recovery Premium - oporavak sportista | Estetik Lab",
      description: "Sport Recovery Premium kombinuje fizikalnu terapiju i sportsku masažu za sveobuhvatniju podršku oporavku sportista.",
      keywords: ["oporavak sportista paket", "sport recovery premium", "fizikalna terapija i sportska masaza"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Dve strane oporavka - aparaturna i ručna" },
      {
        type: "paragraph",
        text: "Oporavak posle napora ima dve strane koje se retko rade zajedno u jednom paketu: aparaturni rad na bolu i napetosti (Medicinski Bio-Reset) i ručni rad na mišićima (sportska masaža). Sport Recovery Premium spaja obe, za sportiste i rekreativce koji žele sveobuhvatniju podršku.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Medicinski Bio-Reset (45 minuta - interferentne struje, ultrazvuk i svetlosna terapija) - glavni akcenat",
          "3 sportske masaže celog tela (60 minuta) - sporedni akcenat",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena",
        ],
      },
      {
        type: "callout",
        variant: "danger",
        title: "Ovo nije zamena za lekarski tretman",
        text: "Kao i kod samostalnog Medicinski Bio-Reset tretmana, ovaj paket je dopuna - ne zamena - redovnoj fizikalnoj terapiji i lekarskom tretmanu. Kod jakog ili dugotrajnog bola, prvo se obratite lekaru ili fizijatru.",
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "paragraph",
        text: "Sportistima i rekreativcima koji redovno treniraju i žele podršku i kod bola/napetosti (fizikalni tretman) i kod ukočenosti mišića posle napora (sportska masaža). Terapeut na konsultaciji predlaže raspored - masaža nakon napora najčešće pomaže oporavku, dok masaža pre treninga može doprineti fleksibilnosti.",
      },
      {
        type: "serviceReference",
        title: "Medicinski Bio-Reset",
        text: "Fizikalni ESMA tretman za bol i mišićnu napetost - glavni akcenat ovog paketa.",
        button: { text: "Pročitajte više o Medicinski Bio-Reset", url: "/zakazivanje/medicinski-bioreset" },
      },
      {
        type: "serviceReference",
        title: "Sportska masaža",
        text: "Masaža prilagođena sportistima i rekreativcima - sporedni akcenat ovog paketa.",
        button: { text: "Pročitajte više o sportskoj masaži", url: "/zakazivanje/sportska-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Sport Recovery Premium",
        faqItems: [
          { question: "Da li je paket namenjen samo profesionalnim sportistima?", answer: "Ne - podjednako je koristan rekreativcima koji redovno treniraju, trče ili se bave nekim sportom." },
          { question: "Kada je najbolje zakazati sportsku masažu u odnosu na trening?", answer: "Terapeut na konsultaciji predlaže raspored prema vašem planu treninga." },
          { question: "Da li ovaj paket leči povredu?", answer: "Ne - kod akutne povrede prvo je potreban lekarski pregled. Ovaj paket je podrška oporavku i redovnoj pripremi, ne lečenje povrede." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Sport Recovery Premium",
        text: "Pogledajte tačnu cenu i rezervišite Sport Recovery Premium paket.",
        button: { text: "Pogledajte paket", url: "/paketi/sport-recovery-premium" },
      },
    ]),
  },

  // --- 5. Detox & Relax Premium ---
  {
    slug: "detox-relax-premium-paket",
    title: "Detox & Relax Premium – limfna drenaža i opuštanje u jednom paketu",
    excerpt:
      "Detox & Relax Premium kombinuje limfnu drenažu Aqua-Drain 360 sa relaks masažom celog tela. Za lagane noge, bolju cirkulaciju i opšte opuštanje.",
    categorySlugs: ["paketi-i-cene", "telo-i-oblikovanje"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "limfna-drenaza-cena"],
    statusOffset: 41,
    seo: {
      title: "Detox & Relax Premium - limfna drenaža i masaža | Estetik Lab",
      description: "Detox & Relax Premium kombinuje limfnu drenažu Aqua-Drain 360 i relaks masažu celog tela za lagane noge i opuštanje.",
      keywords: ["limfna drenaza i masaza paket", "detox relax premium", "paket za teske noge novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kada je telu potreban i detoks i predah" },
      {
        type: "paragraph",
        text: "Sindrom \"teških nogu\", zadržavanje tečnosti i opšta iscrpljenost često idu zajedno. Detox & Relax Premium kombinuje aparaturnu limfnu drenažu sa ručnom relaks masažom, tretirajući i cirkulacijski i opuštajući aspekt u jednom paketu.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Aqua-Drain 360 (45 minuta - limfna drenaža na ESMA Favorit aparatu) - glavni akcenat",
          "3 relaks masaže celog tela (60 minuta) - sporedni akcenat",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena",
        ],
      },
      {
        type: "paragraph",
        text: "Aqua-Drain 360 kroz ritmični talasni pritisak podstiče izbacivanje nakupljene tečnosti i cirkulaciju, dok relaks masaža dodatno smanjuje mišićnu napetost i podstiče opšte opuštanje tela i uma.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Nije samo za izražene otoke",
        text: "Kombinacija limfne drenaže i relaks masaže pogodna je i kao opšti wellness paket za osećaj lakoće i opuštenosti, ne samo za izraženo zadržavanje tečnosti - mnogi klijenti ga biraju čisto radi predaha.",
      },
      {
        type: "serviceReference",
        title: "Aqua-Drain 360",
        text: "Limfna drenaža celog tela na ESMA Favorit aparatu - glavni akcenat ovog paketa.",
        button: { text: "Pročitajte više o Aqua-Drain 360", url: "/zakazivanje/aquadrain-360" },
      },
      {
        type: "serviceReference",
        title: "Relaks masaža",
        text: "Relaks masaža celog tela (60 minuta) - sporedni akcenat ovog paketa.",
        button: { text: "Pročitajte više o relaks masaži", url: "/zakazivanje/relaks-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Detox & Relax Premium",
        faqItems: [
          { question: "Da li je paket pogodan ako nemam otoke?", answer: "Da - kombinacija je pogodna i kao opšti wellness paket za osećaj lakoće i opuštenosti, ne samo za izraženo zadržavanje tečnosti." },
          { question: "Koliko često treba dolaziti u okviru paketa?", answer: "Terapeut prilagođava dinamiku vašem stanju - najčešće nekoliko puta nedeljno u intenzivnijoj fazi." },
          { question: "Da li limfna drenaža ima kontraindikacije?", answer: "Da - ne preporučuje se kod akutnih infekcija, tromboze ili određenih srčanih i bubrežnih stanja. Terapeut ova pitanja postavlja na konsultaciji." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Detox & Relax Premium",
        text: "Pogledajte tačnu cenu i rezervišite Detox & Relax Premium paket.",
        button: { text: "Pogledajte paket", url: "/paketi/detox-relax-premium" },
      },
    ]),
  },

  // --- 6. Tonus & Terapeutska Premium ---
  {
    slug: "tonus-terapeutska-premium-paket",
    title: "Tonus & Terapeutska Premium – tonus mišića uz masažu za oporavak",
    excerpt:
      "Tonus & Terapeutska Premium kombinuje miostimulaciju Tesla-Tone 24 sa terapeutskom masažom. Za one koji ulažu u telo, ali i u oporavak od te iste aktivnosti.",
    categorySlugs: ["paketi-i-cene", "esma-tretmani"],
    tagSlugs: ["paketi-tretmana", "premium-paketi", "miostimulacija-iskustva"],
    statusOffset: 44,
    seo: {
      title: "Tonus & Terapeutska Premium - miostimulacija i masaža | Estetik Lab",
      description: "Tonus & Terapeutska Premium kombinuje miostimulaciju Tesla-Tone 24 i terapeutsku masažu za tonus mišića uz podršku oporavku.",
      keywords: ["miostimulacija i masaza paket", "tonus terapeutska premium", "paket za tonus misica novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Tonus mišića i otpuštanje napetosti - zašto zajedno" },
      {
        type: "paragraph",
        text: "Miostimulacija simulira intenzivan trening i podstiče tonus mišića, ali intenzivnije fizičko angažovanje - baš kao i klasičan trening - može dovesti do napetosti i mišićnih čvorića. Tonus & Terapeutska Premium spaja Tesla-Tone 24 sa terapeutskom masažom, koja ciljano radi na otpuštanju te napetosti.",
      },
      { type: "heading", level: 3, text: "Šta paket uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "5 tretmana Tesla-Tone 24 (45 minuta - miostimulacija celog tela na ESMA Favorit aparatu) - glavni akcenat",
          "3 terapeutske masaže celog tela (60 minuta) - sporedni akcenat",
          "Ušteda od 15% u odnosu na zbir pojedinačnih cena",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Da li terapeutska masaža smanjuje efekat miostimulacije?",
        text: "Ne - terapeutska masaža radi na otpuštanju zategnutih zona i mišićnih čvorića, što je komplementarno sa jačanjem tonusa kroz miostimulaciju, a ne suprotno njemu. Terapeut prilagođava raspored sesija.",
      },
      { type: "heading", level: 3, text: "Kome se najviše preporučuje" },
      {
        type: "paragraph",
        text: "Klijentima koji žele brži osećaj tonusa mišića uz podršku u vidu otpuštanja napetosti - uz redovnu fizičku aktivnost i zdravu ishranu za najbolje rezultate.",
      },
      {
        type: "serviceReference",
        title: "Tesla-Tone 24",
        text: "Miostimulacija celog tela na ESMA Favorit aparatu - glavni akcenat ovog paketa.",
        button: { text: "Pročitajte više o Tesla-Tone 24", url: "/zakazivanje/teslatone-24" },
      },
      {
        type: "serviceReference",
        title: "Terapeutska masaža",
        text: "Ciljana masaža za hroničnu napetost i mišićne čvoriće - sporedni akcenat ovog paketa.",
        button: { text: "Pročitajte više o terapeutskoj masaži", url: "/zakazivanje/terapeutska-masaza" },
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Tonus & Terapeutska Premium",
        faqItems: [
          { question: "Da li je paket pogodan i za početnike u miostimulaciji?", answer: "Da - terapeut na konsultaciji prilagođava intenzitet i tempo bez obzira na to da li ste ranije radili miostimulaciju." },
          { question: "U kom redosledu se rade tretmani?", answer: "Terapeut predlaže raspored - masaža se često radi u danima kada nema ESMA tretmana, radi kontinuirane podrške tokom cele serije." },
          { question: "Da li paket ima rok trajanja?", answer: "Preporučujemo da svih 8 tretmana iskoristite u razmaku od nekoliko nedelja radi kontinuiteta efekta - za tačan rok pitajte na konsultaciji." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte Tonus & Terapeutska Premium",
        text: "Pogledajte tačnu cenu i rezervišite Tonus & Terapeutska Premium paket.",
        button: { text: "Pogledajte paket", url: "/paketi/tonus-terapeutska-premium" },
      },
    ]),
  },

  // --- 7. Hub post: svi paketi ---
  {
    slug: "svi-paketi-tretmana-kako-izabrati",
    title: "Svi paketi tretmana kod nas – kako izabrati pravi (5, 10 seansi ili premium kombinacija)",
    excerpt:
      "Pregled svih paketa tretmana - od paketa 5 i 10 seansi jedne usluge do premium kombinacija dve usluge. Objašnjavamo razliku i kako da izaberete pravi za sebe.",
    categorySlugs: ["paketi-i-cene", "vodic-i-saveti"],
    tagSlugs: ["paketi-tretmana", "cena-tretmana", "premium-paketi", "pre-i-posle-tretmana"],
    statusOffset: 48,
    seo: {
      title: "Svi paketi tretmana - kako izabrati pravi | Estetik Lab",
      description: "Pregled paketa od 5/10 seansi i premium kombinacija dve usluge - kako da izaberete pravi paket tretmana za sebe.",
      keywords: ["paketi tretmana novi sad", "cena paketa tretmana", "premium paketi esma"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Dve vrste paketa, dve različite svrhe" },
      {
        type: "paragraph",
        text: "Kod nas postoje dve vrste paketa, i lako je pomešati ih ako ih prvi put birate. Prva vrsta je paket od 5 ili 10 seansi JEDNE usluge - namenjen ponavljanju istog tretmana po povoljnijoj ceni. Druga vrsta su premium paketi - kombinacija DVE različite usluge (najčešće ESMA tretman kao glavni akcenat i ručna masaža kao sporedni) za sveobuhvatniji pristup jednom cilju.",
      },
      { type: "heading", level: 3, text: "Paketi od 5 i 10 seansi jedne usluge" },
      {
        type: "table",
        table: {
          columns: ["Broj seansi", "Ušteda u odnosu na pojedinačne posete"],
          rows: [
            { label: "Paket od 5 tretmana", values: ["10% popusta"] },
            { label: "Paket od 10 tretmana", values: ["20% popusta"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Ova vrsta paketa dostupna je za svih šest ESMA tretmana - Tesla-Tone 24, Aqua-Drain 360, Lipolise Russian-Max, Tri-Active Cellu-Erase, Laser-Sonic Face Sculpt i Medicinski Bio-Reset. Idealna je kada znate da vam je za rezultat potrebna serija istog tretmana - terapeuti najčešće preporučuju upravo seriju od 5 do 10 tretmana za primetniji efekat.",
      },
      { type: "heading", level: 3, text: "Premium paketi - kombinacija dve usluge" },
      {
        type: "paragraph",
        text: "Premium paketi kombinuju 5 tretmana glavne ESMA usluge sa 3 tretmana komplementarne masaže, uz uštedu od 15% u odnosu na zbir pojedinačnih cena. Ova vrsta paketa je za one koji žele da problem reše sa dve strane odjednom - aparaturne i ručne.",
      },
      {
        type: "cards",
        cards: [
          { icon: "bi bi-droplet", title: "Anticelulit Premium", text: "Lipolise Russian-Max + anticelulit masaža" },
          { icon: "bi bi-lightning-charge", title: "Tri-Active Anticelulit MAX Premium", text: "Tri-Active Cellu-Erase + anticelulit masaža (najintenzivniji)" },
          { icon: "bi bi-emoji-smile", title: "Sculpt & Glow Premium", text: "Laser-Sonic Face Sculpt + relaks masaža gornjeg dela tela" },
          { icon: "bi bi-activity", title: "Sport Recovery Premium", text: "Medicinski Bio-Reset + sportska masaža" },
          { icon: "bi bi-water", title: "Detox & Relax Premium", text: "Aqua-Drain 360 + relaks masaža celog tela" },
          { icon: "bi bi-heart-pulse", title: "Tonus & Terapeutska Premium", text: "Tesla-Tone 24 + terapeutska masaža" },
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako da izaberete",
        text: "Ako želite da ponovite jedan tretman koji vam već odgovara - paket od 5 ili 10 seansi je jednostavniji i jeftiniji izbor. Ako rešavate problem koji ima i aparaturnu i ručnu stranu (npr. celulit, tonus uz napetost, bol uz zamor mišića) - premium paket daje sveobuhvatniji pristup. U slučaju nedoumice, terapeut na konsultaciji pomaže da odaberete.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Paketi tretmana",
        faqItems: [
          { question: "Da li paket ima rok trajanja?", answer: "Preporučujemo da tretmane iskoristite u razmaku od nekoliko nedelja radi kontinuiteta efekta - za tačan rok važenja pitajte na konsultaciji." },
          { question: "Da li mogu naknadno da pređem sa 5 na 10 tretmana?", answer: "Uvek možete kupiti dodatni paket ili se raspitati o prelasku na veći paket za povoljniju cenu po tretmanu." },
          { question: "Da li se sesije premium paketa moraju raditi naizmenično?", answer: "Ne strogo - terapeut predlaže raspored, ali vi zakazujete svaku sesiju pojedinačno prema svom rasporedu." },
          { question: "Gde vidim tačne cene?", answer: "Tačan cenovnik svakog paketa uvek je vidljiv na njegovoj stranici, jer se cene periodično ažuriraju." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte sve pakete",
        text: "Pregledajte kompletnu ponudu paketa i pronađite onaj koji najviše odgovara vašem cilju.",
        button: { text: "Pogledajte sve pakete", url: "/paketi" },
      },
    ]),
  },

// --- 18. Masaže u Novom Sadu - vodič ---
  {
    slug: "masaze-u-novom-sadu-vodic",
    title: "Masaže u Novom Sadu – vodič kroz sve vrste masaža i kad je koja prava",
    excerpt: "Relax, sportska, terapeutska ili anticelulit masaža - objašnjavamo razliku i kako da izaberete pravu vrstu masaže za svoj cilj.",
    categorySlugs: ["masaza-i-relaksacija", "wellness-i-estetika"],
    tagSlugs: ["masaze-novi-sad", "relaksaciona-masaza"],
    statusOffset: 51,
    seo: {
      title: "Masaže u Novom Sadu - vodič kroz vrste masaža | Estetik Lab",
      description: "Relax, sportska, terapeutska ili anticelulit masaža - koja je prava za vaš cilj. Vodič kroz sve vrste masaža u Novom Sadu.",
      keywords: ["masaze novi sad", "vrste masaza", "koja masaza je za mene"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Nisu sve masaže isto" },
      {
        type: "paragraph",
        text: "\"Masaža\" je širok pojam - neko traži opuštanje posle napornog meseca, neko oporavak posle treninga, neko rešenje za hroničnu napetost u vratu, a neko podršku u radu na celulitu. Kod nas u Novom Sadu nudimo četiri vrste masaže, svaku sa jasno drugačijom svrhom.",
      },
      {
        type: "table",
        table: {
          columns: ["Vrsta masaže", "Glavna svrha"],
          rows: [
            { label: "Relaks masaža", values: ["Opšte opuštanje, smanjenje stresa, bolji san"] },
            { label: "Sportska masaža", values: ["Priprema pre treninga ili oporavak posle napora"] },
            { label: "Terapeutska masaža", values: ["Hronična napetost, mišićni čvorići, posledice sedenja"] },
            { label: "Anticelulit masaža", values: ["Podrška cirkulaciji u zonama sklonim celulitu"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Sve četiri dolaze u varijanti od 30 minuta (gornji ili donji deo tela) ili 60 minuta (celo telo), tako da možete prilagoditi i vreme i fokus tretmana svom rasporedu.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Niste sigurni koju da izaberete?",
        text: "Ako niste sigurni koja vrsta masaže odgovara vašem cilju, terapeut na konsultaciji rado pomaže da izaberete - ili čak predloži kombinaciju kroz jedan od naših premium paketa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Vrste masaža",
        faqItems: [
          { question: "Mogu li da kombinujem dve vrste masaže?", answer: "Da - mnogi klijenti biraju različite vrste za različite prilike, a neke kombinacije su i deo naših premium paketa (npr. terapeutska masaža uz miostimulaciju)." },
          { question: "Koja je najbolja masaža za početak?", answer: "Ako niste sigurni, relaks masaža je najčešći uvod - opšta je i bez specifičnog fokusa, pa je dobra polazna tačka." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte sve masaže",
        text: "Pregledajte sve vrste masaža i zakažite termin koji odgovara vašem cilju.",
        button: { text: "Pogledajte masaže", url: "/usluge/kategorija/masaze" },
      },
    ]),
  },

  // --- 19. Kako izabrati pravu relax masažu (buyer's guide angle) ---
  {
    slug: "kako-izabrati-pravu-relax-masazu-novi-sad",
    title: "Kako izabrati pravu relax masažu u Novom Sadu – na šta obratiti pažnju",
    excerpt: "Pre zakazivanja relax masaže u Novom Sadu, proverite ova 4 pitanja - trajanje, iskustvo terapeuta, higijenu prostora i fokus tretmana.",
    categorySlugs: ["masaza-i-relaksacija", "wellness-i-estetika"],
    tagSlugs: ["relax-masaza-novi-sad", "masaze-novi-sad"],
    statusOffset: 55,
    seo: {
      title: "Kako izabrati relax masažu u Novom Sadu | Estetik Lab",
      description: "Na šta obratiti pažnju pre zakazivanja relax masaže - trajanje, fokus tretmana, iskustvo terapeuta i higijena prostora.",
      keywords: ["relax masaza novi sad", "opustajuca masaza izbor", "kako izabrati masazu"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Pre nego što zakažete" },
      {
        type: "paragraph",
        text: "Kada tražite \"relax masažu Novi Sad\", ponude su brojne i nije uvek lako proceniti razliku. Evo na šta vredi obratiti pažnju pre nego što izaberete gde ćete zakazati.",
      },
      { type: "heading", level: 3, text: "4 stvari koje vredi proveriti" },
      {
        type: "list",
        ordered: true,
        items: [
          "Da li se jasno nudi izbor trajanja (30 ili 60 minuta) i fokusa (gornji, donji deo tela ili celo telo)",
          "Da li terapeut ima iskustvo i da li se pre tretmana razgovara o vašim potrebama i eventualnim ograničenjima",
          "Higijena prostora i opreme - čist, uredan prostor je osnovni signal ozbiljnog studija",
          "Da li postoji mogućnost online zakazivanja i jasnog uvida u dostupne termine",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Redovnost je važnija od intenziteta",
        text: "Za osećaj opuštenosti, redovna kraća masaža često daje bolji dugoročni efekat od retkih, dužih poseta - razmislite o ritmu koji realno možete da održite.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Izbor relax masaže",
        faqItems: [
          { question: "Da li je bolje zakazati online ili telefonom?", answer: "Online zakazivanje vam daje jasan uvid u sve slobodne termine u realnom vremenu, bez čekanja na odgovor - preporučujemo ga kad god je dostupno." },
          { question: "Da li treba unapred da najavim zdravstvena ograničenja?", answer: "Da - uvek je dobro da terapeuta unapred obavestite o hroničnim stanjima, trudnoći ili nedavnim povredama." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite relax masažu",
        text: "Kod nas birate trajanje i fokus tretmana, a termin zakazujete online u nekoliko klikova.",
        button: { text: "Zakažite termin", url: "/zakazivanje/relaks-masaza" },
      },
    ]),
  },

  // --- 20. Sport i rekreacija u Novom Sadu - zašto masaža deo rutine ---
  {
    slug: "sport-i-masaza-novi-sad",
    title: "Sport i rekreacija u Novom Sadu – zašto masaža treba da bude deo rutine",
    excerpt: "Trčite, trenirate u teretani ili se bavite rekreativnim sportom u Novom Sadu? Objašnjavamo zašto sportska masaža ima smisla kao redovan deo rutine, ne samo posle povrede.",
    categorySlugs: ["masaza-i-relaksacija", "wellness-i-estetika"],
    tagSlugs: ["sportska-masaza-novi-sad", "masaza-za-sportiste"],
    statusOffset: 58,
    seo: {
      title: "Sportska masaža Novi Sad - deo redovne rutine | Estetik Lab",
      description: "Zašto sportska masaža ima smisla kao redovan deo rutine za rekreativce i sportiste u Novom Sadu, ne samo posle povrede.",
      keywords: ["sportska masaza novi sad", "masaza za rekreativce", "oporavak posle treninga"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Masaža nije samo za profesionalce" },
      {
        type: "paragraph",
        text: "Novi Sad ima aktivnu rekreativnu scenu - trke duž Dunava, teretane, rekreativni fudbal i biciklizam. Sportska masaža se često povezuje samo sa profesionalnim sportistima, ali podjednako je korisna i rekreativcima koji redovno fizički opterećuju telo.",
      },
      { type: "heading", level: 3, text: "Zašto redovnost, a ne samo 'kad zaboli'" },
      {
        type: "paragraph",
        text: "Čekanje da se pojavi bol ili ukočenost pre zakazivanja masaže znači da već reagujete na problem, umesto da ga sprečavate. Uključivanje sportske masaže u redovnu rutinu - na primer jednom mesečno - može doprineti bržem oporavku između treninga i boljoj fleksibilnosti.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Za dodatnu podršku kod bola",
        text: "Ako uz masažu imate i izraženiju napetost ili bol, pogledajte i Medicinski Bio-Reset - fizikalni ESMA tretman koji se dobro kombinuje sa sportskom masažom u okviru Sport Recovery Premium paketa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Sport i masaža",
        faqItems: [
          { question: "Koliko često rekreativac treba da radi sportsku masažu?", answer: "Ne postoji univerzalno pravilo - zavisi od intenziteta i učestalosti treninga. Terapeut na konsultaciji predlaže dinamiku prilagođenu vašoj rutini." },
          { question: "Da li mogu da dođem samo posle intenzivnog treninga, bez redovnog rasporeda?", answer: "Naravno - masaža je dostupna i za jednokratne posete, redovnost je samo preporuka za dugoročno bolje rezultate." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite sportsku masažu",
        text: "Uključite sportsku masažu u svoju rekreativnu rutinu - zakažite termin koji vam odgovara.",
        button: { text: "Zakažite termin", url: "/zakazivanje/sportska-masaza" },
      },
    ]),
  },

  // --- 21. Svi anticelulit tretmani upoređeni ---
  {
    slug: "svi-anticelulit-tretmani-uporedjeni",
    title: "Anticelulit tretmani u Novom Sadu – svi naši pristupi upoređeni",
    excerpt: "Ručna masaža, elektrolipoliza ili kombinovani ESMA tretman - poredimo sve naše anticelulit opcije i objašnjavamo kada koja ima najviše smisla.",
    categorySlugs: ["telo-i-oblikovanje", "wellness-i-estetika"],
    tagSlugs: ["celulit-tretman", "masaze-novi-sad", "elektrolipoliza"],
    statusOffset: 62,
    seo: {
      title: "Anticelulit tretmani Novi Sad - poređenje opcija | Estetik Lab",
      description: "Poredimo anticelulit masažu, Lipolise Russian-Max, Tri-Active Cellu-Erase i naše premium pakete - koja opcija je za vas.",
      keywords: ["anticelulit tretmani novi sad", "poredjenje anticelulit tretmana", "koji anticelulit tretman izabrati"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Nekoliko puteva do istog cilja" },
      {
        type: "paragraph",
        text: "Kod nas postoji nekoliko različitih pristupa radu na celulitu, od blažeg do najintenzivnijeg. Ovaj vodič poredi sve opcije na jednom mestu, da biste lakše odlučili odakle da krenete ili kada da pređete na intenzivniju kombinaciju.",
      },
      {
        type: "table",
        table: {
          columns: ["Pristup", "Kako radi", "Intenzitet"],
          rows: [
            { label: "Anticelulit masaža", values: ["Ručna tehnika, cirkulacija i tekstura kože", "Blaži, dobar uvod"] },
            { label: "Lipolise Russian-Max", values: ["Elektrolipoliza - struja na masne ćelije", "Srednji"] },
            { label: "Tri-Active Cellu-Erase", values: ["Ultrazvuk + struja + svetlosna terapija", "Viši - za tvrdokorni celulit"] },
            { label: "Anticelulit Premium (paket)", values: ["Lipolise Russian-Max + anticelulit masaža", "Srednji, kombinovan"] },
            { label: "Tri-Active Anticelulit MAX Premium (paket)", values: ["Tri-Active Cellu-Erase + anticelulit masaža", "Najviši, kombinovan"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako da odlučite odakle da krenete",
        text: "Ako je celulit blaži ili tek počinjete, anticelulit masaža ili Lipolise Russian-Max su dobra polazna tačka. Za dugotrajan, tvrdokoran celulit, terapeut najčešće predlaže kombinovan pristup kroz jedan od premium paketa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Poređenje anticelulit tretmana",
        faqItems: [
          { question: "Da li mogu da počnem sa masažom, pa da kasnije dodam ESMA tretman?", answer: "Da - mnogi klijenti tako i počinju, a terapeut na osnovu rezultata predlaže dalji korak." },
          { question: "Da li kombinacija uvek daje bolji rezultat od jedne usluge?", answer: "Rezultati zavise od organizma, ali kombinacija aparaturnog i ručnog pristupa cilja problem sa dve strane, što terapeut najčešće preporučuje za izraženiji celulit." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Nesigurni ste koji pristup je za vas? Zakažite konsultaciju sa terapeutom koji će predložiti plan prema vašem stanju.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/anticelulit-masaza" },
      },
    ]),
  },

  // --- 22. Estetski salon u Novom Sadu - na sta paziti ---
  {
    slug: "estetski-salon-novi-sad-na-sta-paziti",
    title: "Estetski salon u Novom Sadu – na šta obratiti pažnju pri izboru",
    excerpt: "Pre nego što zakažete tretman u estetskom salonu, proverite ovih 5 stvari - opremu, edukaciju terapeuta, transparentnost cena i higijenske standarde.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["estetski-salon-novi-sad", "kozmeticki-salon-novi-sad"],
    statusOffset: 65,
    seo: {
      title: "Estetski salon Novi Sad - na šta obratiti pažnju | Estetik Lab",
      description: "5 stvari koje proverite pre izbora estetskog salona u Novom Sadu - oprema, edukacija terapeuta, higijena i transparentnost cena.",
      keywords: ["estetski salon novi sad", "izbor estetskog salona", "na sta paziti kod estetskih tretmana"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Ponuda je velika - kako da procenite kvalitet" },
      {
        type: "paragraph",
        text: "Novi Sad ima veliki broj estetskih salona i studija, i nije uvek lako proceniti razliku samo na osnovu fotografija na društvenim mrežama. Evo konkretnih stvari koje vredi proveriti pre zakazivanja.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Da li je oprema profesionalna i jasno predstavljena (naziv aparata, tehnologija koja se koristi)",
          "Da li terapeuti imaju relevantnu edukaciju za tretmane koje izvode",
          "Da li su cene transparentne i vidljive unapred, bez skrivenih troškova",
          "Da li se pre tretmana razgovara o vašim ciljevima i eventualnim kontraindikacijama",
          "Da li postoji jasan sistem zakazivanja i praćenja vaših termina/paketa",
        ],
      },
      {
        type: "callout",
        variant: "warning",
        title: "Oprez kod obećanja koja zvuče previše dobro",
        text: "Ozbiljan salon će vam reći da rezultati zavise od organizma i preporučiti realan broj tretmana - budite oprezni prema obećanjima \"garantovanih\" ili \"trajnih\" rezultata posle jednog tretmana.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Izbor estetskog salona",
        faqItems: [
          { question: "Da li veći salon znači i bolji kvalitet?", answer: "Ne nužno - veličina prostora nije garancija kvaliteta. Oprema, edukacija terapeuta i transparentnost su pouzdaniji pokazatelji." },
          { question: "Da li je konsultacija pre prvog tretmana važna?", answer: "Da - konsultacija pokazuje da salon ozbiljno pristupa proceni vašeg stanja i ciljeva pre nego što predloži tretman." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte našu ponudu",
        text: "Pregledajte našu opremu, tretmane i pakete, ili zakažite besplatnu konsultaciju.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 23. Kozmeticki salon vs estetski centar ---
  {
    slug: "kozmeticki-salon-vs-estetski-centar",
    title: "Kozmetički salon vs estetski centar – koja je razlika",
    excerpt: "Kozmetički salon i estetski centar često se koriste kao sinonimi, ali postoji razlika u opsegu usluga i vrsti opreme. Objašnjavamo šta možete očekivati od svakog.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["kozmeticki-salon-novi-sad", "estetski-salon-novi-sad"],
    statusOffset: 69,
    seo: {
      title: "Kozmetički salon vs estetski centar - razlika | Estetik Lab",
      description: "Koja je razlika između kozmetičkog salona i estetskog centra, i šta to znači za vrstu tretmana koje možete očekivati.",
      keywords: ["kozmeticki salon vs estetski centar", "razlika kozmeticki i estetski salon"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Isti cilj, različit opseg usluga" },
      {
        type: "paragraph",
        text: "\"Kozmetički salon\" i \"estetski centar\" se u svakodnevnom govoru često koriste kao sinonimi, ali u praksi termin \"estetski centar\" ili \"estetski studio\" često podrazumeva širi opseg usluga - uključujući aparaturne tretmane (poput ESMA sistema) pored klasične kozmetike i nege.",
      },
      {
        type: "table",
        table: {
          columns: ["Tipično uz naziv", "Šta obično podrazumeva"],
          rows: [
            { label: "Kozmetički salon", values: ["Nega lica, manikir, pedikir, klasična kozmetika"] },
            { label: "Estetski centar / studio", values: ["Aparaturni tretmani, ESMA tretmani, kombinovane procedure, uz kozmetiku"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Ova podela nije strogo formalna - mnogi objekti kombinuju oba pristupa. Najbolji način da znate šta možete očekivati je da proverite konkretnu listu usluga i opremu koju studio koristi, umesto da se oslanjate samo na naziv.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Kozmetički salon vs estetski centar",
        faqItems: [
          { question: "Da li estetski centar uvek ima skuplje tretmane?", answer: "Ne nužno - cena zavisi od konkretnog tretmana i opreme, ne od naziva objekta." },
          { question: "Kako da znam šta tačno nudi neki salon?", answer: "Najpouzdanije je proveriti listu usluga na sajtu ili se raspitati direktno - naziv sam po sebi ne garantuje tačan opseg ponude." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte našu punu ponudu",
        text: "Kod nas kombinujemo ESMA aparaturne tretmane i klasične ručne masaže na jednom mestu - pogledajte kompletnu listu usluga.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 24. Wellness centar Novi Sad ---
  {
    slug: "wellness-centar-novi-sad-sta-ukljucuje",
    title: "Wellness centar Novi Sad – šta prava wellness ponuda uključuje",
    excerpt: "Termin 'wellness centar' se koristi široko - objašnjavamo šta prava wellness ponuda treba da obuhvati, od opuštanja do tretmana za telo.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["wellness-centar-novi-sad", "masaze-novi-sad"],
    statusOffset: 72,
    seo: {
      title: "Wellness centar Novi Sad - šta prava ponuda uključuje | Estetik Lab",
      description: "Šta prava wellness ponuda treba da uključuje - od opuštajućih masaža do aparaturnih tretmana za telo i lice.",
      keywords: ["wellness centar novi sad", "wellness novi sad", "sta je wellness centar"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Wellness je više od jedne masaže" },
      {
        type: "paragraph",
        text: "\"Wellness\" doslovno znači opšte blagostanje - i prava wellness ponuda treba da odražava upravo to: kombinaciju opuštanja, brige o telu i podrške fizičkom osećaju dobrobiti, ne samo jedan izolovan tretman.",
      },
      { type: "heading", level: 3, text: "Šta bi trebalo da uključuje" },
      {
        type: "list",
        ordered: false,
        items: [
          "Opuštajuće tretmane za smanjenje stresa (relaks masaža)",
          "Podršku telu - drenažu, tonus, rad na celulitu (ESMA tretmani)",
          "Tretmane za lice - lifting, nega, sjaj kože",
          "Fleksibilnost - mogućnost kombinovanja različitih tretmana prema vašem trenutnom stanju i cilju",
        ],
      },
      {
        type: "paragraph",
        text: "Kod nas ovo postižemo kombinacijom ESMA Favorit sistema (miostimulacija, limfna drenaža, ultrazvuk, laser) i klasičnih ručnih masaža - a premium paketi su nastali upravo iz ideje da wellness ne mora biti ili-ili, već i-i.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Wellness centar",
        faqItems: [
          { question: "Da li je wellness centar isto što i spa?", answer: "Termini se preklapaju, ali \"spa\" često više naglašava opuštanje i ambijent, dok \"wellness centar\" može uključivati i ciljanije tretmane za telo i lice." },
          { question: "Da li treba da imam konkretan cilj da bih došao/la na wellness tretman?", answer: "Ne - opšte opuštanje je sasvim validan razlog, ali ako imate konkretan cilj (tonus, celulit, lifting), terapeut vam pomaže da izaberete pravi tretman za njega." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte našu wellness ponudu",
        text: "Pregledajte kompletnu ponudu ESMA tretmana i masaža i pronađite kombinaciju koja vam odgovara.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 25. Terapija bola - ESMA ili masaza ---
  {
    slug: "terapija-bola-esma-ili-masaza",
    title: "Terapija bola i napetosti mišića – ESMA tretman ili masaža?",
    excerpt: "Kod bola i mišićne napetosti, birate između fizikalnog ESMA tretmana i terapeutske masaže. Poredimo kada je koji pristup pogodniji.",
    categorySlugs: ["wellness-i-estetika", "esma-tretmani"],
    tagSlugs: ["terapija-bola", "fizikalna-terapija", "terapeutska-masaza-novi-sad"],
    statusOffset: 76,
    seo: {
      title: "Terapija bola - ESMA tretman ili masaža | Estetik Lab",
      description: "Medicinski Bio-Reset ili terapeutska masaža - poredimo dva pristupa terapiji bola i napetosti mišića.",
      keywords: ["terapija bola novi sad", "esma ili masaza za bol", "napetost misica tretman"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Dva različita alata za sličan problem" },
      {
        type: "paragraph",
        text: "Kada vas prati bol u leđima, vratu ili napetost u mišićima, kod nas imate dve opcije - fizikalni ESMA tretman Medicinski Bio-Reset ili terapeutska masaža. Nisu konkurenti, ali rade na drugačiji način.",
      },
      {
        type: "table",
        table: {
          columns: ["Pristup", "Kako radi", "Kada je pogodniji"],
          rows: [
            { label: "Medicinski Bio-Reset (ESMA)", values: ["Interferentne struje, ultrazvuk, svetlosna terapija", "Kada je potreban aparaturni pristup dubljem tkivu"] },
            { label: "Terapeutska masaža (ručna)", values: ["Direktan pritisak i istezanje na zategnutim zonama", "Kada su u pitanju mišićni čvorići i lokalizovana napetost"] },
          ],
        },
      },
      {
        type: "callout",
        variant: "danger",
        title: "Oba su dopuna, ne zamena za lekara",
        text: "Ni jedan ni drugi pristup ne zamenjuje lekarski pregled ili fizikalnu terapiju propisanu od strane lekara. Kod jakog ili dugotrajnog bola, prvo se obratite lekaru ili fizijatru.",
      },
      {
        type: "paragraph",
        text: "Za sveobuhvatniji pristup, oba se kombinuju u Tonus & Terapeutska Premium (uz Tesla-Tone 24) ili Sport Recovery Premium (Medicinski Bio-Reset + sportska masaža) paketima.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Terapija bola",
        faqItems: [
          { question: "Mogu li da radim oba tretmana u istoj nedelji?", answer: "Da - terapeut na konsultaciji predlaže raspored koji ima smisla za vaše stanje." },
          { question: "Koji je bolji izbor za početak?", answer: "Zavisi od uzroka napetosti - terapeut na konsultaciji predlaže pristup na osnovu procene uživo, ne unapred bez pregleda." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Nesigurni ste koji pristup vam više odgovara? Zakažite konsultaciju sa terapeutom.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/medicinski-bioreset" },
      },
    ]),
  },

  // --- 26. Struja u estetici ---
  {
    slug: "struja-u-estetici-elektrostimulacija",
    title: "Struja u estetici – kako elektrostimulacija oblikuje telo",
    excerpt: "Od miostimulacije do elektrolipolize - objašnjavamo kako različite vrste struje u estetici deluju na mišiće i masne naslage.",
    categorySlugs: ["esma-tretmani", "wellness-i-estetika"],
    tagSlugs: ["struja-tretmani", "esma-favorit-novi-sad"],
    statusOffset: 79,
    seo: {
      title: "Struja u estetici - elektrostimulacija tela | Estetik Lab",
      description: "Kako miostimulacija i elektrolipoliza rade, i koja je razlika između različitih vrsta struje u estetskim tretmanima.",
      keywords: ["struja tretmani estetika", "elektrostimulacija tela", "esma favorit struja"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Nije sva 'struja' ista" },
      {
        type: "paragraph",
        text: "Kada se kaže da tretman \"radi na struju\", to zapravo pokriva nekoliko različitih tehnologija sa različitom svrhom - od jačanja tonusa mišića do rada na masnim naslagama. ESMA Favorit sistem koristi nekoliko vrsta struje, svaku za drugačiji cilj.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Miostimulacija (Tesla-Tone 24) - kontrakcija mišićnih vlakana radi tonusa, simulira efekat treninga",
          "Elektrolipoliza (Lipolise Russian-Max) - deluje na masne ćelije u tretiranoj zoni",
          "Interferentne struje (Medicinski Bio-Reset) - mogu doprineti smanjenju bola i mišićnog spazma",
          "Struja kao deo limfne drenaže (Aqua-Drain 360) - ritmični talasni pritisak za cirkulaciju",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako se odabira jačina struje",
        text: "Intenzitet se uvek podešava individualno prema vašem pragu tolerancije - osećaj treba da bude prijatna kontrakcija ili trnci, nikada bol.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Struja u estetici",
        faqItems: [
          { question: "Da li je bezbedno raditi tretmane sa strujom?", answer: "Da, uz poštovanje kontraindikacija - tretman se ne preporučuje trudnicama, osobama sa pejsmejkerom, epilepsijom ili akutnim upalama kože. Terapeut ova pitanja postavlja na konsultaciji." },
          { question: "Da li struja boli?", answer: "Ne - osećaj je stimulacija, kontrakcija ili blagi trnci, ne bol." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte ESMA tretmane",
        text: "Pogledajte kompletnu ponudu tretmana na ESMA Favorit aparatu.",
        button: { text: "Pogledajte ESMA tretmane", url: "/usluge/kategorija/esma" },
      },
    ]),
  },

  // --- 27. Ultrazvuk u estetici ---
  {
    slug: "ultrazvuk-u-estetici-objasnjeno",
    title: "Ultrazvuk u estetici – piling, kavitacija i fonoforeza objašnjeni",
    excerpt: "Ultrazvuk se u estetici koristi na više načina - za mikromasažu tkiva, unos aktivnih sastojaka i pripremu kože. Objašnjavamo razlike.",
    categorySlugs: ["laser-i-koza", "wellness-i-estetika"],
    tagSlugs: ["ultrazvuk-u-estetici", "ultrazvuk-za-lice"],
    statusOffset: 83,
    seo: {
      title: "Ultrazvuk u estetici - piling i fonoforeza | Estetik Lab",
      description: "Kako se ultrazvuk koristi u estetskim tretmanima - mikromasaža tkiva, fonoforeza i priprema kože za dalju obradu.",
      keywords: ["ultrazvuk u estetici", "ultrazvucni piling", "fonoforeza"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Više uloga jedne tehnologije" },
      {
        type: "paragraph",
        text: "Ultrazvuk se u estetici retko koristi samostalno - najčešće je jedna faza u okviru šireg tretmana, sa nekoliko mogućih uloga u zavisnosti od konteksta.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Mikromasaža tkiva - priprema zonu za dalju obradu (npr. pre elektrolipolize u Tri-Active Cellu-Erase tretmanu)",
          "Fonoforeza - pomaže unosu kozmetičkih aktivnih sastojaka (npr. hijaluron, vitamini) u kožu",
          "Podsticanje lokalne cirkulacije u tretiranoj zoni",
        ],
      },
      {
        type: "paragraph",
        text: "Kod nas se ultrazvuk koristi u dva tretmana - kao deo Laser-Sonic Face Sculpt (za lice, u kombinaciji sa mikrostrujama i svetlosnom terapijom) i kao prva faza Tri-Active Cellu-Erase (za telo, pre elektrolipolize i svetlosne terapije).",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Ultrazvuk u estetici",
        faqItems: [
          { question: "Da li se ultrazvuk radi kao samostalan tretman kod vas?", answer: "Kod nas je ultrazvuk uvek deo šire procedure (Laser-Sonic Face Sculpt ili Tri-Active Cellu-Erase), ne samostalan tretman." },
          { question: "Da li ultrazvučni tretman boli?", answer: "Ne - opisuje se kao prijatna mikromasaža, bez bola." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte tretmane sa ultrazvukom",
        text: "Pogledajte Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase, oba uključuju ultrazvuk kao deo procedure.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 28. Laser tretmani u estetici ---
  {
    slug: "laser-tretmani-u-estetici-sta-moze",
    title: "Laser tretmani u estetici – šta laser realno može (a šta ne)",
    excerpt: "Pojam 'laser tretman' pokriva mnogo različitih tehnologija i namena. Objašnjavamo šta svetlosna terapija na ESMA Favorit aparatu realno radi.",
    categorySlugs: ["laser-i-koza", "wellness-i-estetika"],
    tagSlugs: ["laser-tretmani", "laser-za-kozu"],
    statusOffset: 86,
    seo: {
      title: "Laser tretmani u estetici - šta realno mogu | Estetik Lab",
      description: "Šta svetlosna (laserska) terapija u estetskim tretmanima realno može da postigne, a šta ne - objašnjavamo bez preteranih obećanja.",
      keywords: ["laser tretmani estetika", "svetlosna terapija koza", "laser za kozu novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "\"Laser\" pokriva širok spektar tehnologija" },
      {
        type: "paragraph",
        text: "Pojam \"laser tretman\" u estetici je širok - obuhvata mnoge različite tehnologije, snage i namene, od kojih svaka ima drugačiji domet delovanja. Važno je biti precizan u očekivanjima, umesto da se \"laser\" tretira kao univerzalno rešenje.",
      },
      { type: "heading", level: 3, text: "Šta svetlosna terapija na ESMA Favorit aparatu radi" },
      {
        type: "paragraph",
        text: "Kod nas se svetlosna (laserska) terapija koristi kao deo šireg tretmana - u Laser-Sonic Face Sculpt (za lice, uz mikrostruje i ultrazvuk) i u Tri-Active Cellu-Erase (za telo, kao završna faza). Ona podstiče lokalnu cirkulaciju i doprinosi osećaju zategnutije, svežije kože nakon tretmana.",
      },
      {
        type: "callout",
        variant: "warning",
        title: "Šta ovaj laser NE radi",
        text: "Svetlosna terapija u okviru naših ESMA tretmana nije laserska epilacija niti hirurški zahvat - ne uklanja dlake trajno i ne zamenjuje hiruršku intervenciju. Ako tražite konkretno tu vrstu usluge, obavezno proverite tačno koja tehnologija se nudi pre zakazivanja, bilo kod nas bilo bilo gde drugde.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Laser tretmani",
        faqItems: [
          { question: "Da li kod vas mogu da uradim lasersku epilaciju?", answer: "Trenutno naša ponuda uključuje svetlosnu terapiju u okviru Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase - za tačnu i aktuelnu ponudu tretmana, proverite stranicu usluga ili nas kontaktirajte direktno." },
          { question: "Da li je svetlosna terapija bezbedna za sve tipove kože?", answer: "Terapeut na konsultaciji procenjuje tip kože i eventualne kontraindikacije pre tretmana." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte tretmane sa svetlosnom terapijom",
        text: "Pogledajte Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 29. Kozmetika i nega koze ---
  {
    slug: "kozmetika-i-nega-koze-kucna-i-profesionalna",
    title: "Kozmetika i nega kože – kako kombinovati kućnu negu i profesionalne tretmane",
    excerpt: "Kućna nega i profesionalni tretmani ne isključuju jedno drugo. Objašnjavamo kako da ih kombinujete za bolji i dugotrajniji rezultat.",
    categorySlugs: ["wellness-i-estetika", "laser-i-koza"],
    tagSlugs: ["kozmetika-i-nega", "estetski-salon-novi-sad"],
    statusOffset: 90,
    seo: {
      title: "Kozmetika i nega kože - kućna i profesionalna | Estetik Lab",
      description: "Kako kombinovati svakodnevnu kućnu negu kože sa profesionalnim estetskim tretmanima za bolji rezultat.",
      keywords: ["kozmetika i nega koze", "kucna nega vs profesionalni tretmani", "nega koze novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kućna nega i profesionalni tretman - ne ili-ili" },
      {
        type: "paragraph",
        text: "Svakodnevna kućna nega (čišćenje, hidratacija, zaštita od sunca) i profesionalni estetski tretmani rade na različitim nivoima - kućna nega održava stanje kože iz dana u dan, dok profesionalni tretman cilja konkretniji, dublji rezultat u određenom periodu.",
      },
      { type: "heading", level: 3, text: "Kako se dopunjuju" },
      {
        type: "list",
        ordered: false,
        items: [
          "Kućna nega održava rezultate postignute profesionalnim tretmanom duže vreme",
          "Profesionalni tretman (npr. Laser-Sonic Face Sculpt) postiže efekat koji je teško dostići samo kućnom negom",
          "Redovna kućna zaštita od sunca produžava efekat tretmana za lice",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Konsultacija pre kombinovanja",
        text: "Ako uvodite nove proizvode u kućnu negu blizu termina profesionalnog tretmana, dobro je to pomenuti terapeutu - neki sastojci zahtevaju prilagođavanje rasporeda tretmana.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Kozmetika i nega kože",
        faqItems: [
          { question: "Da li profesionalni tretmani zamenjuju kućnu negu?", answer: "Ne - najbolji rezultati dolaze iz kombinacije oba pristupa, ne iz oslanjanja samo na jedno." },
          { question: "Koliko često je potreban profesionalni tretman uz redovnu kućnu negu?", answer: "Zavisi od cilja i tipa kože - terapeut na konsultaciji predlaže dinamiku prilagođenu vašoj situaciji." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju za negu kože",
        text: "Zakažite konsultaciju i saznajte kako da kombinujete kućnu negu sa našim tretmanima za lice.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
    ]),
  },

// --- 30. Lokacija - hero post (ZAHTEVA POPUNJAVANJE) ---
  {
    slug: "estetski-wellness-centar-u-novom-sadu",
    title: "Estetski i wellness centar u Novom Sadu – gde se nalazimo i kako do nas",
    excerpt: "Sve informacije o lokaciji, radnom vremenu i pristupu našem estetskom i wellness centru u Novom Sadu.",
    categorySlugs: ["novi-sad-i-lokacija"],
    tagSlugs: ["spens-novi-sad", "centar-grada-novi-sad"],
    statusOffset: 93,
    seo: {
      title: "Estetski i wellness centar Novi Sad - lokacija | Estetik Lab",
      description: "Gde se nalazi naš estetski i wellness centar u Novom Sadu, radno vreme i kako do nas.",
      keywords: ["estetski centar novi sad lokacija", "wellness centar novi sad adresa", "maksima gorkog novi sad", "estetski salon blizu spensa"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Gde nas možete pronaći" },
      {
        type: "paragraph",
        text: "Naš estetski i wellness centar nalazi se u Novom Sadu, na adresi Maksima Gorkog 6b - u neposrednoj blizini zgrade suda (Palate pravde) i Spensa.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "[POPUNI: radno vreme - dani i sati]",
          "[POPUNI: da li postoji parking, i gde]",
          "[POPUNI: najbliža stanica javnog prevoza - lokacija je u širem centru grada, blizu Spensa i zgrade suda, pa je dobro povezana javnim prevozom]",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Zašto je lokacija bitna kod izbora estetskog centra",
        text: "Redovnost je ključna za rezultate paketa od 5 ili 10 tretmana - lakše je održati raspored kada je studio na putu kojim se već krećete, bilo poslom bilo tokom slobodnog vremena u centru grada.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Lokacija",
        faqItems: [
          { question: "Da li imate parking za klijente?", answer: "[POPUNI: tačan odgovor o parkingu]" },
          { question: "Da li je potrebno zakazati unapred ili primate i bez zakazivanja?", answer: "Preporučujemo online zakazivanje unapred, kako biste bili sigurni da je termin slobodan." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite termin",
        text: "Zakažite termin online i posetite nas.",
        button: { text: "Zakažite termin", url: "/usluge" },
      },
    ]),
  },

  // --- 31. Kako do nas (ZAHTEVA POPUNJAVANJE) ---
  {
    slug: "kako-do-nas-parking-i-prevoz",
    title: "Kako do nas – parking, prevoz i pristup centru u Novom Sadu",
    excerpt: "Praktične informacije za dolazak na tretman - parking, javni prevoz i pristup našem centru u Novom Sadu.",
    categorySlugs: ["novi-sad-i-lokacija"],
    tagSlugs: ["centar-grada-novi-sad"],
    statusOffset: 97,
    seo: {
      title: "Kako do nas - parking i prevoz Novi Sad | Estetik Lab",
      description: "Praktične informacije o parkingu, javnom prevozu i pristupu našem centru u Novom Sadu.",
      keywords: ["parking novi sad centar", "kako doci do centra novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Planiranje dolaska na termin" },
      {
        type: "paragraph",
        text: "Da bi vaš tretman počeo na vreme i bez stresa, evo praktičnih informacija o dolasku do nas.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Nalazimo se na adresi Maksima Gorkog 6b u Novom Sadu, u neposrednoj blizini zgrade suda (Palate pravde) i Spensa",
          "[POPUNI: opcije parkinga - besplatan/plaćen, ulice u blizini, garaža]",
          "[POPUNI: linije gradskog prevoza i najbliža stanica]",
          "[POPUNI: da li je zgrada/ulaz pristupačan osobama sa smanjenom pokretljivošću]",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Savet za prvi dolazak",
        text: "Ako dolazite prvi put, planirajte da stignete nekoliko minuta ranije - kratak razgovor sa terapeutom pre prvog tretmana je uobičajen deo procesa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Dolazak do centra",
        faqItems: [
          { question: "Da li ste blizu centra grada?", answer: "Da - nalazimo se na adresi Maksima Gorkog 6b, u neposrednoj blizini zgrade suda (Palate pravde) i Spensa." },
          { question: "Šta ako zakasnim na termin?", answer: "Ako znate da ćete zakasniti, javite nam se što pre - u zavisnosti od rasporeda, terapeut će predložiti najbolje rešenje." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite termin",
        text: "Zakažite termin online, u vreme koje vam odgovara.",
        button: { text: "Zakažite termin", url: "/usluge" },
      },
    ]),
  },

  // --- 32. Zašto centar grada bira nas (ZAHTEVA POPUNJAVANJE / testimoniali) ---
  {
    slug: "zasto-nas-biraju-klijenti-iz-centra-novog-sada",
    title: "Zašto sve više klijenata iz centra Novog Sada bira nas",
    excerpt: "Blizina, fleksibilno zakazivanje i kombinacija ESMA tretmana i masaža na jednom mestu - razlozi zašto nas klijenti iz centra grada biraju.",
    categorySlugs: ["novi-sad-i-lokacija", "wellness-i-estetika"],
    tagSlugs: ["centar-grada-novi-sad", "estetski-salon-novi-sad"],
    statusOffset: 100,
    seo: {
      title: "Zašto klijenti iz centra Novog Sada biraju nas | Estetik Lab",
      description: "Blizina, online zakazivanje i kombinacija ESMA tretmana i masaža na jednom mestu za klijente iz centra Novog Sada.",
      keywords: ["estetski centar blizu centra novi sad", "wellness centar u centru novog sada"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Šta klijenti iz centra grada najviše cene" },
      {
        type: "paragraph",
        text: "[POPUNI: ako imate konkretne, prave citate/utiske klijenata koji su dali dozvolu za objavu, ubaciti ih ovde umesto generičkog teksta ispod - ne izmišljati testimoniale.]",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Blizina - lakše je održati redovan raspored paketa od 5 ili 10 tretmana kada je studio na putu kojim se već krećete",
          "Sve na jednom mestu - ESMA tretmani i klasične masaže, umesto odvojenih poseta različitim studijima",
          "Online zakazivanje - jasan uvid u slobodne termine, bez čekanja na telefonski odgovor",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Otvoreno o očekivanjima",
        text: "Ne obećavamo instant čudesne rezultate - terapeut na konsultaciji daje realan okvir onoga što tretman može da postigne, prilagođen vašem stanju.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Zašto mi",
        faqItems: [
          { question: "Da li je lakše doći do vas nego do studija van centra?", answer: "Da - nalazimo se na Maksima Gorkog 6b, u neposrednoj blizini zgrade suda i Spensa, što je često na putu klijentima koji već imaju obaveze ili slobodno vreme u tom delu grada." },
          { question: "Da li mogu da kombinujem ESMA tretman i masažu u istoj poseti?", answer: "Sesije se zakazuju pojedinačno, ali terapeut može predložiti raspored tako da vam pogodno legnu u istoj nedelji." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite prvu posetu",
        text: "Zakažite konsultaciju ili prvi tretman i uverite se sami.",
        button: { text: "Zakažite termin", url: "/usluge" },
      },
    ]),
  },

  // --- 33. 5 najčešćih mitova o miostimulaciji ---
  {
    slug: "5-mitova-o-miostimulaciji-i-esma-tretmanima",
    title: "5 najčešćih mitova o miostimulaciji i ESMA tretmanima",
    excerpt: "Da li miostimulacija zamenjuje teretanu? Da li deluje isto na svakoga? Raščlanjujemo 5 najčešćih mitova o ESMA tretmanima.",
    categorySlugs: ["mitovi-i-cinjenice", "esma-tretmani"],
    tagSlugs: ["mitovi-o-tretmanima", "miostimulacija-iskustva"],
    statusOffset: 104,
    seo: {
      title: "5 mitova o miostimulaciji i ESMA tretmanima | Estetik Lab",
      description: "Raščlanjujemo najčešće mitove o miostimulaciji - da li zamenjuje teretanu, da li deluje isto na sve, i šta je realno očekivati.",
      keywords: ["mitovi o miostimulaciji", "da li miostimulacija radi", "esma tretmani istina"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Razdvajanje marketinga od realnosti" },
      {
        type: "paragraph",
        text: "Miostimulacija i ESMA tretmani su okruženi brojnim tvrdnjama, od kojih neke drže vodu, a neke ne. Evo 5 najčešćih mitova, sa realnim objašnjenjem.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "MIT: Miostimulacija u potpunosti zamenjuje teretanu. ČINJENICA: Simulira intenzivan trening i podstiče tonus, ali najbolji rezultati dolaze uz redovnu fizičku aktivnost, ne kao potpuna zamena za nju.",
          "MIT: Jedan tretman daje trajan rezultat. ČINJENICA: Terapeuti preporučuju seriju od 5 do 10 tretmana za primetniji efekat, ne jednokratnu posetu.",
          "MIT: Svi osećaju isti intenzitet. ČINJENICA: Intenzitet se individualno prilagođava vašem pragu tolerancije.",
          "MIT: Tretman je bezbedan za bilo koga. ČINJENICA: Ne preporučuje se trudnicama, osobama sa pejsmejkerom, epilepsijom ili akutnim upalama kože - terapeut ova pitanja postavlja na konsultaciji.",
          "MIT: Rezultat je isti za svakoga. ČINJENICA: Rezultati zavise od organizma, ishrane i nivoa fizičke aktivnosti - terapeut daje realan okvir, ne garanciju.",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako da prepoznate preterana obećanja",
        text: "Budite oprezni prema obećanjima 'garantovanih' ili 'trajnih' rezultata posle jednog tretmana, bilo gde da ih čujete - ozbiljan pristup uvek uključuje realan okvir očekivanja.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Mitovi o miostimulaciji",
        faqItems: [
          { question: "Da li miostimulacija boli?", answer: "Ne - osećaj je prijatna mišićna kontrakcija i trnci, ne bol." },
          { question: "Da li mogu da radim miostimulaciju bez ikakve fizičke aktivnosti?", answer: "Možete, ali terapeuti preporučuju kombinaciju sa redovnom fizičkom aktivnošću i zdravom ishranom za najbolje rezultate." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Tesla-Tone 24",
        text: "Saznajte realno šta miostimulacija može da uradi za vas - zakažite konsultaciju.",
        button: { text: "Zakažite termin", url: "/zakazivanje/teslatone-24" },
      },
    ]),
  },

  // --- 34. Da li anticelulit masaza stvarno radi ---
  {
    slug: "da-li-anticelulit-masaza-stvarno-radi",
    title: "Da li anticelulit masaža stvarno uklanja celulit? Mitovi i činjenice",
    excerpt: "Ručna anticelulit masaža je okružena velikim očekivanjima. Objašnjavamo šta realno može, a šta je preterano obećanje.",
    categorySlugs: ["mitovi-i-cinjenice", "telo-i-oblikovanje"],
    tagSlugs: ["mitovi-o-tretmanima", "celulit-tretman"],
    statusOffset: 107,
    seo: {
      title: "Da li anticelulit masaža uklanja celulit - mitovi | Estetik Lab",
      description: "Šta ručna anticelulit masaža realno može da postigne, a šta je preterano obećanje.",
      keywords: ["da li masaza uklanja celulit", "anticelulit masaza istina", "mitovi o celulitu"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Najveće nesporazum oko anticelulit masaže" },
      {
        type: "paragraph",
        text: "Anticelulit masaža se često prodaje kao rešenje koje 'trajno uklanja celulit'. Ovo nije tačno, i važno nam je da to kažemo otvoreno, umesto da gradimo očekivanja koja tretman ne može ispuniti.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "MIT: Masaža trajno uklanja celulit. ČINJENICA: Ručna masaža ne menja trajno strukturu vezivnog tkiva niti uklanja masne naslage.",
          "MIT: Jedna masaža je dovoljna za vidljiv rezultat. ČINJENICA: Redovni tretmani mogu doprineti boljoj teksturi kože, ne jednokratna poseta.",
          "MIT: Masaža je jedino što je potrebno. ČINJENICA: Najbolji rezultati dolaze u kombinaciji sa zdravom ishranom i fizičkom aktivnošću.",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Šta zaista pomaže kod izraženijeg celulita",
        text: "Za direktniji rad na masnim naslagama, pogledajte naše ESMA tretmane poput Lipolise Russian-Max ili kombinovanog Tri-Active Cellu-Erase - a za sveobuhvatniji pristup, naše premium pakete koji kombinuju oba pristupa.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Anticelulit masaža, mitovi",
        faqItems: [
          { question: "Zašto onda uopšte raditi anticelulit masažu?", answer: "Jer može doprineti boljoj cirkulaciji i teksturi kože, što je realan i koristan efekat - samo ne treba očekivati da sama po sebi trajno reši celulit." },
          { question: "Koja kombinacija daje najbolji rezultat?", answer: "Terapeut najčešće predlaže kombinaciju ručne masaže i ESMA elektrolipolize, uz zdrave navike, za sveobuhvatniji pristup." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Porazgovarajte sa terapeutom o realnom pristupu vašem cilju.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/anticelulit-masaza" },
      },
    ]),
  },

  // --- 35. Mrsavljenje pomocu struje - mit ili stvarnost ---
  {
    slug: "mrsavljenje-pomocu-struje-realnost",
    title: "Mršavljenje pomoću struje – šta je realno, a šta marketing",
    excerpt: "Elektrolipoliza se često prodaje kao 'mršavljenje bez napora'. Objašnjavamo šta struja u estetici realno radi, a šta ne.",
    categorySlugs: ["mitovi-i-cinjenice", "esma-tretmani"],
    tagSlugs: ["mitovi-o-tretmanima", "elektrolipoliza"],
    statusOffset: 111,
    seo: {
      title: "Mršavljenje pomoću struje - realnost vs marketing | Estetik Lab",
      description: "Šta elektrolipoliza realno radi na masne ćelije, i zašto nije zamena za zdravu ishranu i fizičku aktivnost.",
      keywords: ["mrsavljenje strujom", "elektrolipoliza mit", "da li struja topi masti"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "\"Otopiti masti strujom\" - odakle dolazi ovaj mit" },
      {
        type: "paragraph",
        text: "Fraze poput \"otopite masti bez napora\" su česte u marketingu elektrolipolize, ali pojednostavljuju ono što se zapravo dešava u tretiranom tkivu.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "MIT: Struja direktno 'topi' masnoću kao toplota. ČINJENICA: Struja podstiče oslobađanje masnih naslaga iz ćelija, koje telo dalje prirodno metaboliše i izbacuje putem limfnog sistema - proces, ne trenutni efekat.",
          "MIT: Elektrolipoliza je zamena za mršavljenje kroz ishranu i aktivnost. ČINJENICA: Radi na lokalizovanim zonama, ne na opštem gubitku telesne mase - najbolje deluje kao dopuna zdravim navikama, ne zamena za njih.",
          "MIT: Rezultat je isti bez obzira na broj tretmana. ČINJENICA: Terapeuti preporučuju seriju tretmana za postepeno smanjenje obima, ne jednokratnu posetu.",
        ],
      },
      {
        type: "callout",
        variant: "warning",
        title: "Oprez prema obećanjima 'brzog mršavljenja'",
        text: "Nijedan estetski tretman, uključujući elektrolipolizu, ne zamenjuje kalorijski deficit i fizičku aktivnost kada je cilj gubitak telesne mase. Radi se o oblikovanju i radu na lokalizovanim zonama.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Elektrolipoliza, mitovi",
        faqItems: [
          { question: "Da li ću smršati ako radim Lipolise Russian-Max bez promene ishrane?", answer: "Tretman cilja lokalizovane masne naslage, ali dugoročni rezultat i dalje zavisi i od ishrane i fizičke aktivnosti." },
          { question: "Koliko tretmana je potrebno da se vidi razlika u obimu?", answer: "Najčešće serija od 5 do 10 tretmana - terapeut daje realan okvir na konsultaciji, ne unapred bez procene." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Porazgovarajte sa terapeutom o realnim očekivanjima za vaš cilj.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/lipolise-russianmax" },
      },
    ]),
  },

  // --- 36. Lifting lica bez igala - mit ili stvarnost ---
  {
    slug: "lifting-lica-bez-igala-mit-ili-stvarnost",
    title: "Lifting lica bez igala – mit ili stvarnost?",
    excerpt: "Mikrostrujni lifting lica se često reklamira kao 'alternativa botoksu'. Objašnjavamo šta realno možete očekivati, a šta ne.",
    categorySlugs: ["mitovi-i-cinjenice", "lice-i-lifting"],
    tagSlugs: ["mitovi-o-tretmanima", "lifting-lica-bez-igala"],
    statusOffset: 114,
    seo: {
      title: "Lifting lica bez igala - mit ili stvarnost | Estetik Lab",
      description: "Šta mikrostrujni lifting lica realno može da postigne, i zašto nije potpuna alternativa hirurškim ili injekcionim procedurama.",
      keywords: ["lifting lica bez igala mit", "mikrostrujni lifting istina", "da li lifting lica radi"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "\"Alternativa botoksu\" - koliko je to tačno" },
      {
        type: "paragraph",
        text: "Nehirurški tretmani lica se ponekad reklamiraju kao potpuna zamena za injekcione ili hirurške procedure. Ovo je pojednostavljivanje - svaki pristup ima svoj domet i svrhu.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "MIT: Mikrostrujni lifting daje isti efekat kao botoks ili hirurški lifting. ČINJENICA: Radi nežan miolifting i podstiče tonus mišića lica, sa drugačijim, blažim dometom delovanja.",
          "MIT: Efekat je trajan. ČINJENICA: Rezultat je vidljiv odmah nakon tretmana, ali za dugotrajniji efekat preporučuje se serija tretmana uz periodično održavanje.",
          "MIT: Nema razlike ko izvodi tretman. ČINJENICA: Tehnika i iskustvo terapeuta utiču na rezultat - zato je konsultacija pre tretmana važan korak.",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Šta Laser-Sonic Face Sculpt realno radi",
        text: "Kombinuje mikrostruje, ultrazvuk i svetlosnu terapiju za nežan miolifting, unos aktivnih sastojaka u kožu i osećaj zategnutosti i sjaja - bez igala i bez perioda oporavka, ali sa drugačijim dometom od invazivnijih procedura.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Lifting lica bez igala, mitovi",
        faqItems: [
          { question: "Da li je ovo zamena za hirurški lifting?", answer: "Ne - radi se o nehirurškom, nežnijem pristupu sa drugačijim dometom rezultata. Za izraženiju promenu konture lica, hirurške procedure imaju drugačiji domet delovanja." },
          { question: "Koliko brzo se vidi rezultat?", answer: "Vidljiv je odmah nakon tretmana, ali za dugotrajniji efekat preporučuje se serija od 5 do 10 tretmana." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite Laser-Sonic Face Sculpt",
        text: "Saznajte realno šta ovaj tretman može da uradi za vaše lice.",
        button: { text: "Zakažite termin", url: "/zakazivanje/lasersonic-face-sculpt" },
      },
    ]),
  },

  // --- 37. Kako kreirati nalog i zakazati prvi termin ---
  {
    slug: "kako-kreirati-nalog-i-zakazati-prvi-termin",
    title: "Kako da kreirate nalog i zakažete prvi termin online – vodič korak po korak",
    excerpt: "Kreiranje naloga i zakazivanje prvog termina traje par minuta. Vodič korak po korak kroz ceo proces.",
    categorySlugs: ["nalog-i-zakazivanje"],
    tagSlugs: ["kreiranje-naloga", "online-zakazivanje"],
    statusOffset: 118,
    seo: {
      title: "Kako kreirati nalog i zakazati termin online | Estetik Lab",
      description: "Vodič korak po korak - kako da kreirate nalog, potvrdite email i zakažete svoj prvi termin online.",
      keywords: ["kreiranje naloga online zakazivanje", "kako zakazati termin online"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Ceo proces traje par minuta" },
      {
        type: "paragraph",
        text: "Kreiranje naloga i zakazivanje prvog termina je jednostavan proces - evo tačno šta vas očekuje, korak po korak.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Otvorite stranicu za registraciju i unesite osnovne podatke (ime, email, lozinka), ili se registrujte direktno preko Google naloga za brži proces",
          "Ako ste se registrovali email adresom, proverite email i potvrdite nalog klikom na link u poruci koju smo poslali",
          "Prijavite se na nalog",
          "Izaberite uslugu koju želite da zakažete i pogledajte dostupne termine",
          "Potvrdite termin - dobićete potvrdu na email",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Zaboravili ste lozinku?",
        text: "Nema potrebe za pravljenjem novog naloga - na stranici za prijavu postoji opcija za resetovanje zaboravljene lozinke, koja vam šalje link za kreiranje nove.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Kreiranje naloga",
        faqItems: [
          { question: "Da li moram da imam nalog da bih zakazao/la termin?", answer: "Da, nalog omogućava da vidite istoriju svojih termina i lako upravljate zakazivanjem i otkazivanjem." },
          { question: "Šta ako ne dobijem email za potvrdu naloga?", answer: "Proverite folder za neželjenu poštu (spam) - ako ni tamo nije stigao, kontaktirajte nas direktno." },
          { question: "Da li mogu da se prijavim preko Google naloga?", answer: "Da - prijava preko Google naloga je dostupna kao brža alternativa unosu email adrese i lozinke." },
        ],
      },
      {
        type: "cta",
        title: "Kreirajte nalog",
        text: "Kreirajte nalog i zakažite svoj prvi termin za par minuta.",
        button: { text: "Kreirajte nalog", url: "/registracija" },
      },
    ]),
  },

  // --- 38. Sve funkcije vaseg naloga ---
  {
    slug: "sve-funkcije-vaseg-naloga",
    title: "Sve funkcije vašeg naloga – termini, porudžbine i podešavanja",
    excerpt: "Pregled svega što možete da uradite iz svog naloga - od pregleda i otkazivanja termina do upravljanja adresama i podešavanjima profila.",
    categorySlugs: ["nalog-i-zakazivanje"],
    tagSlugs: ["korisnicki-nalog", "online-zakazivanje"],
    statusOffset: 121,
    seo: {
      title: "Sve funkcije vašeg naloga | Estetik Lab",
      description: "Pregled svih funkcija vašeg naloga - termini, porudžbine, adrese i podešavanja profila.",
      keywords: ["korisnicki nalog funkcije", "moj nalog online zakazivanje"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Vaš nalog je centralno mesto za sve" },
      {
        type: "paragraph",
        text: "Nakon prijave, vaš nalog vam daje pregled i kontrolu nad svim što je vezano za vaše termine i porudžbine, na jednom mestu.",
      },
      { type: "heading", level: 3, text: "Termini" },
      {
        type: "paragraph",
        text: "Pregledajte listu svih zakazanih termina, filtrirajte ih po statusu, i pogledajte detalje svakog pojedinačno. Ako vam nešto iskrsne, termin možete i otkazati direktno iz naloga.",
      },
      { type: "heading", level: 3, text: "Porudžbine" },
      {
        type: "paragraph",
        text: "Pregledajte istoriju porudžbina, njihove detalje, i po potrebi ih otkažite.",
      },
      { type: "heading", level: 3, text: "Adrese" },
      {
        type: "paragraph",
        text: "Dodajte, uklonite ili postavite podrazumevanu adresu - korisno ako redovno naručujete ili vam je potrebna dostava.",
      },
      { type: "heading", level: 3, text: "Podešavanja" },
      {
        type: "list",
        ordered: false,
        items: [
          "Ažurirajte podatke profila",
          "Promenite lozinku",
          "Deaktivirajte nalog, ako je potrebno",
        ],
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Funkcije naloga",
        faqItems: [
          { question: "Mogu li da otkažem termin u poslednjem trenutku?", answer: "Termin možete otkazati iz naloga - za tačna pravila otkazivanja (rokovi i eventualne naknade) proverite prilikom zakazivanja." },
          { question: "Šta ako želim da obrišem nalog u potpunosti?", answer: "Opcija deaktivacije naloga se nalazi u podešavanjima - za trajno brisanje podataka kontaktirajte nas direktno." },
        ],
      },
      {
        type: "cta",
        title: "Prijavite se na svoj nalog",
        text: "Pristupite svom nalogu i upravljajte terminima na jednom mestu.",
        button: { text: "Prijavite se", url: "/prijava" },
      },
    ]),
  },

  // --- 39. Zasto je online zakazivanje brze ---
  {
    slug: "zasto-je-online-zakazivanje-brze-i-sigurnije",
    title: "Zašto je online zakazivanje brže i sigurnije od telefonskog",
    excerpt: "Online zakazivanje vam daje jasan uvid u sve slobodne termine u realnom vremenu, bez čekanja na odgovor. Objašnjavamo prednosti.",
    categorySlugs: ["nalog-i-zakazivanje"],
    tagSlugs: ["online-zakazivanje", "korisnicki-nalog"],
    statusOffset: 125,
    seo: {
      title: "Zašto je online zakazivanje brže od telefonskog | Estetik Lab",
      description: "Prednosti online zakazivanja - jasan uvid u termine, potvrda na email, i mogućnost da sami upravljate svojim terminima.",
      keywords: ["online zakazivanje prednosti", "zakazivanje termina preko interneta"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Manje čekanja, više kontrole" },
      {
        type: "paragraph",
        text: "Telefonsko zakazivanje zahteva da pozovete u radno vreme, sačekate odgovor i uskladite termine napamet. Online zakazivanje rešava sve te tačke odjednom.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Vidite sve slobodne termine odmah, u realnom vremenu, bez čekanja na odgovor",
          "Zakazujete u bilo koje doba dana, ne samo tokom radnog vremena poziva",
          "Dobijate pisanu potvrdu na email - manje prostora za nesporazum oko datuma i vremena",
          "Sami upravljate svojim terminima - pregled i otkazivanje bez potrebe za novim pozivom",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Ipak preferirate poziv?",
        text: "Online zakazivanje ne isključuje mogućnost da nas kontaktirate direktno ako imate pitanje pre zakazivanja - jednostavno vam štedi vreme za sam čin rezervacije termina.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Online zakazivanje",
        faqItems: [
          { question: "Da li mogu da promenim termin nakon zakazivanja?", answer: "Da - postojeći termin možete otkazati iz naloga, a zatim zakazati novi u terminu koji vam više odgovara." },
          { question: "Da li dobijam podsetnik pre termina?", answer: "Potvrda zakazanog termina stiže na email odmah nakon zakazivanja." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite termin online",
        text: "Isprobajte online zakazivanje - brzo je i jednostavno.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

// --- 43. Zasto izabrati nas ---
  {
    slug: "zasto-izabrati-nas-estetski-salon-novi-sad",
    title: "Zašto izabrati nas – šta nas izdvaja od drugih estetskih salona u Novom Sadu",
    excerpt: "ESMA tretmani i klasične masaže na jednom mestu, transparentne cene i online zakazivanje - evo šta nas izdvaja.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["estetski-salon-novi-sad"],
    statusOffset: 128,
    seo: {
      title: "Zašto izabrati nas - estetski salon Novi Sad | Estetik Lab",
      description: "Šta nas izdvaja od drugih estetskih salona u Novom Sadu - oprema, transparentnost i online zakazivanje.",
      keywords: ["estetski salon novi sad izbor", "zasto izabrati nas", "najbolji estetski centar novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Kombinacija koju retko nalazite na jednom mestu" },
      {
        type: "paragraph",
        text: "Umesto da birate između ESMA aparaturnih tretmana u jednom studiju i klasičnih masaža u drugom, kod nas su oba pristupa dostupna na istoj adresi - i mogu se kombinovati kroz naše premium pakete.",
      },
      { type: "heading", level: 3, text: "Šta konkretno nudimo" },
      {
        type: "list",
        ordered: false,
        items: [
          "6 ESMA tretmana na profesionalnom aparatu - miostimulacija, limfna drenaža, elektrolipoliza, kombinovani tretman, mikrostrujni lifting lica i fizikalna terapija",
          "4 vrste klasičnih ručnih masaža - relaks, sportska, terapeutska i anticelulit",
          "Paketi od 5 i 10 seansi za povoljniju cenu, i premium kombinacije dve usluge za sveobuhvatniji pristup",
          "Online zakazivanje sa jasnim uvidom u slobodne termine",
          "Transparentne cene, vidljive unapred na stranici svake usluge",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Bez preteranih obećanja",
        text: "Ne obećavamo 'čudesne' rezultate posle jednog tretmana - terapeut na konsultaciji daje realan okvir očekivanja i predlaže plan prilagođen vašem cilju i stanju.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Zašto mi",
        faqItems: [
          { question: "Da li mogu prvo na konsultaciju pre nego što se odlučim?", answer: "Da - konsultacija je dobar način da terapeut proceni vaše stanje i predloži realan plan pre nego što zakažete seriju tretmana." },
          { question: "Da li nudite pojedinačne tretmane ili samo pakete?", answer: "Oboje - svaki tretman se može zakazati pojedinačno, a paketi su tu za one koji žele povoljniju cenu kroz seriju." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte našu ponudu",
        text: "Pregledajte sve usluge i pakete, ili zakažite besplatnu konsultaciju.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 44. Iskustva klijenata (ZAHTEVA POPUNJAVANJE - pravi testimoniali) ---
  {
    slug: "iskustva-klijenata-sta-govore",
    title: "Iskustva klijenata – šta govore oni koji su probali naše tretmane",
    excerpt: "Šta klijenti najčešće ističu nakon tretmana kod nas - od prvog utiska do dugoročnih rezultata.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["iskustva-klijenata"],
    statusOffset: 132,
    seo: {
      title: "Iskustva klijenata | Estetik Lab",
      description: "Šta klijenti kažu o tretmanima i uslugama kod nas.",
      keywords: ["iskustva klijenata estetski salon", "utisci klijenata novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Šta klijenti najčešće ističu" },
      {
        type: "paragraph",
        text: "[POPUNI: ovaj odeljak treba da sadrži prave citate klijenata, uz njihovu izričitu dozvolu za objavu - ne izmišljati testimoniale. Ispod je struktura koju možeš popuniti stvarnim citatima kada ih prikupiš.]",
      },
      {
        type: "quote",
        text: "[POPUNI: pravi citat klijenta broj 1]",
        meta: "[POPUNI: ime/inicijali klijenta, uz dozvolu]",
      },
      {
        type: "quote",
        text: "[POPUNI: pravi citat klijenta broj 2]",
        meta: "[POPUNI: ime/inicijali klijenta, uz dozvolu]",
      },
      {
        type: "quote",
        text: "[POPUNI: pravi citat klijenta broj 3]",
        meta: "[POPUNI: ime/inicijali klijenta, uz dozvolu]",
      },
      {
        type: "callout",
        variant: "info",
        title: "Kako prikupljamo iskustva",
        text: "[POPUNI: opišite stvaran proces - npr. da li tražite dozvolu za objavu putem ankete posle tretmana, email-a, ili na neki drugi način.]",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Iskustva klijenata",
        faqItems: [
          { question: "Da li su ovo iskustva stvarnih klijenata?", answer: "Da - objavljujemo isključivo iskustva klijenata koji su dali dozvolu za objavu." },
          { question: "Kako da podelim svoje iskustvo?", answer: "[POPUNI: kontakt/proces kojim klijenti mogu da podele svoje iskustvo]" },
        ],
      },
      {
        type: "cta",
        title: "Zakažite svoj tretman",
        text: "Pridružite se klijentima koji su nam ukazali poverenje - zakažite konsultaciju ili tretman.",
        button: { text: "Zakažite termin", url: "/usluge" },
      },
    ]),
  },

  // --- 45. ESMA Favorit vs klasicni aparati ---
  {
    slug: "esma-favorit-vs-klasicni-estetski-aparati",
    title: "ESMA Favorit vs klasični estetski aparati – zašto je razlika bitna",
    excerpt: "Ne rade svi estetski aparati na isti način. Objašnjavamo šta ESMA Favorit sistem donosi u odnosu na jednonamenske uređaje.",
    categorySlugs: ["esma-tretmani", "wellness-i-estetika"],
    tagSlugs: ["esma-vs-klasicni-aparati", "esma-favorit-novi-sad"],
    statusOffset: 135,
    seo: {
      title: "ESMA Favorit vs klasični aparati - razlika | Estetik Lab",
      description: "Zašto je razlika između ESMA Favorit sistema i jednonamenskih estetskih aparata bitna za rezultat tretmana.",
      keywords: ["esma favorit vs klasicni aparati", "esma favorit razlika", "profesionalni estetski aparati"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Jedan sistem, više modaliteta" },
      {
        type: "paragraph",
        text: "Mnogi estetski aparati su jednonamenski - rade samo jednu vrstu tretmana. ESMA Favorit je sistem koji u jednom uređaju kombinuje nekoliko tehnologija - miostimulaciju, limfnu drenažu, mikrostrujnu terapiju, ultrazvuk i svetlosnu terapiju.",
      },
      { type: "heading", level: 3, text: "Zašto je to bitno za vas kao klijenta" },
      {
        type: "list",
        ordered: false,
        items: [
          "Mogućnost kombinovanih tretmana u jednoj proceduri (npr. Tri-Active Cellu-Erase - ultrazvuk, struja i svetlosna terapija zajedno)",
          "Fleksibilnost - isti sistem se koristi za različite ciljeve, od tonusa mišića do lifting lica",
          "Profesionalna oprema, ne kućni ili jednostavniji uređaji ograničenog dometa",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Da li 'profesionalan aparat' garantuje rezultat",
        text: "Ne - oprema je jedan deo priče, ali edukacija terapeuta i procena vašeg stanja na konsultaciji su podjednako bitni za realan i bezbedan pristup tretmanu.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - ESMA Favorit",
        faqItems: [
          { question: "Da li je ESMA Favorit isto što i drugi aparati koje viđam na tržištu?", answer: "ESMA Favorit je specifičan sistem sa svojim karakteristikama - druge marke aparata mogu imati drugačije mogućnosti i domet delovanja." },
          { question: "Da li svi naši tretmani koriste ESMA Favorit?", answer: "Naši ESMA tretmani (Tesla-Tone 24, Aqua-Drain 360, Lipolise Russian-Max, Tri-Active Cellu-Erase, Laser-Sonic Face Sculpt, Medicinski Bio-Reset) koriste ovaj sistem - klasične masaže su ručne, bez aparata." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte ESMA tretmane",
        text: "Pogledajte kompletnu ponudu tretmana na ESMA Favorit aparatu.",
        button: { text: "Pogledajte ESMA tretmane", url: "/usluge/kategorija/esma" },
      },
    ]),
  },

  // --- 46. Kozmeticki salon Novi Sad - cenovnik ---
  {
    slug: "kozmeticki-salon-novi-sad-cenovnik-prva-poseta",
    title: "Kozmetički salon Novi Sad – cenovnik i šta uključuje prva poseta",
    excerpt: "Šta možete očekivati od prve posete - konsultaciju, procenu terapeuta i transparentan uvid u cene pre zakazivanja.",
    categorySlugs: ["wellness-i-estetika"],
    tagSlugs: ["kozmeticki-salon-novi-sad", "cenovnik-tretmana"],
    statusOffset: 139,
    seo: {
      title: "Kozmetički salon Novi Sad - cenovnik i prva poseta | Estetik Lab",
      description: "Šta uključuje prva poseta kod nas i gde pronaći tačan cenovnik naših tretmana i paketa.",
      keywords: ["kozmeticki salon novi sad cenovnik", "prva poseta estetski salon"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Šta se dešava na prvoj poseti" },
      {
        type: "paragraph",
        text: "Ako prvi put dolazite kod nas, evo šta možete očekivati - kratka konsultacija, procena vašeg cilja i eventualnih kontraindikacija, i tek onda predlog tretmana.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Kratak razgovor o cilju tretmana i eventualnim zdravstvenim stanjima",
          "Terapeut predlaže tretman i realan okvir očekivanja - broj seansi, ne obećanje trenutnog rezultata",
          "Sam tretman, prilagođen vašem pragu tolerancije",
          "Preporuke za negu posle tretmana, ako je relevantno",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Gde pronaći tačne cene",
        text: "Cenovnik svakog tretmana i paketa vidljiv je na njegovoj stranici na sajtu - namerno ga ne navodimo ovde jer se cene periodično ažuriraju, pa bi ovaj tekst brzo zastareo.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Prva poseta",
        faqItems: [
          { question: "Da li prva konsultacija ima cenu?", answer: "Za tačnu informaciju o eventualnoj ceni konsultacije proverite prilikom zakazivanja ili nas kontaktirajte direktno." },
          { question: "Koliko traje prva poseta?", answer: "Zavisi od tretmana - uz kratku konsultaciju pre samog tretmana, ukupno vreme je nešto duže od uobičajenog trajanja tretmana." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite prvu posetu",
        text: "Pogledajte kompletnu ponudu i cenovnik, i zakažite svoju prvu posetu.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 47. Struje protiv celulita - realna ocekivanja ---
  {
    slug: "struje-protiv-celulita-realna-ocekivanja",
    title: "Struje protiv celulita i masnih naslaga – realna očekivanja",
    excerpt: "Koliko brzo se vidi razlika, i koliko dugo traje efekat ESMA tretmana za celulit i masne naslage - realan vremenski okvir, bez preterivanja.",
    categorySlugs: ["telo-i-oblikovanje", "esma-tretmani"],
    tagSlugs: ["struja-tretmani", "celulit-tretman"],
    statusOffset: 142,
    seo: {
      title: "Struje protiv celulita - realna očekivanja | Estetik Lab",
      description: "Koliko brzo se vidi razlika i koliko traje efekat ESMA tretmana za celulit i masne naslage - realan vremenski okvir.",
      keywords: ["struje protiv celulita", "koliko brzo deluje elektrolipoliza", "realna ocekivanja celulit tretman"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Vremenski okvir koji vredi znati unapred" },
      {
        type: "paragraph",
        text: "Pre nego što krenete u seriju ESMA tretmana za celulit, korisno je znati realan vremenski okvir - ne da bismo umanjili očekivanja, već da biste planirali seriju sa realnom slikom u glavi.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Prva poseta - osećaj stimulacije, bez trenutne vidljive promene obima",
          "Tokom serije (5-10 tretmana) - postepeno smanjenje obima i utisak glađe kože, individualno različito",
          "Posle serije - održavanje efekta zavisi od nastavka zdrave ishrane i fizičke aktivnosti",
        ],
      },
      {
        type: "callout",
        variant: "warning",
        title: "Zašto izbegavamo konkretne brojeve (cm, kg, %) u ovom tekstu",
        text: "Rezultati zavise od organizma, početnog stanja i doslednosti u ishrani/aktivnosti - navođenje konkretnih brojeva bez procene uživo bilo bi neodgovorno obećanje, ne informacija. Terapeut na konsultaciji daje realniju procenu za vaš konkretan slučaj.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Realna očekivanja",
        faqItems: [
          { question: "Da li ću videti razliku posle prvog tretmana?", answer: "Neki klijenti prijave osećaj razlike rano, ali vidljivija i trajnija promena gradi se kroz celu seriju, ne posle jedne posete." },
          { question: "Da li efekat nestane ako prestanem sa tretmanima?", answer: "Kao i kod svake estetske intervencije, održavanje rezultata zavisi od nastavka zdravih navika - periodično održavanje pomaže da se efekat duže zadrži." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju",
        text: "Porazgovarajte sa terapeutom o realnom planu za vaš cilj.",
        button: { text: "Zakažite konsultaciju", url: "/zakazivanje/lipolise-russianmax" },
      },
    ]),
  },

  // --- 48. Ultrazvuk u nasim tretmanima ---
  {
    slug: "ultrazvuk-u-nasim-tretmanima-efekti",
    title: "Ultrazvuk u našim tretmanima – efekti i koliko tretmana je potrebno",
    excerpt: "Ultrazvuk je deo Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase tretmana. Objašnjavamo šta realno radi i koliko tretmana se preporučuje.",
    categorySlugs: ["laser-i-koza", "esma-tretmani"],
    tagSlugs: ["ultrazvuk-u-estetici", "ultrazvuk-za-lice"],
    statusOffset: 146,
    seo: {
      title: "Ultrazvuk u tretmanima - efekti i broj seansi | Estetik Lab",
      description: "Šta ultrazvuk radi u okviru Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase, i koliko tretmana je potrebno.",
      keywords: ["ultrazvuk tretman efekti", "koliko ultrazvucnih tretmana je potrebno"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Gde se kod nas koristi ultrazvuk" },
      {
        type: "paragraph",
        text: "Ultrazvuk kod nas nije samostalan tretman, već deo dve procedure - Laser-Sonic Face Sculpt (za lice) i Tri-Active Cellu-Erase (za telo). U oba slučaja radi mikromasažu tkiva i priprema zonu za dalju obradu.",
      },
      {
        type: "table",
        table: {
          columns: ["Tretman", "Uloga ultrazvuka"],
          rows: [
            { label: "Laser-Sonic Face Sculpt", values: ["Fonoforeza - pomaže unosu aktivnih sastojaka (npr. hijaluron, vitamini) u kožu lica"] },
            { label: "Tri-Active Cellu-Erase", values: ["Mikromasaža tkiva pre elektrolipolize i svetlosne terapije"] },
          ],
        },
      },
      {
        type: "paragraph",
        text: "Kao i kod ostalih ESMA tretmana, preporučuje se serija od 5 do 10 tretmana za primetniji efekat - ultrazvuk sam po sebi retko daje trajan rezultat posle jedne posete.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Ultrazvuk u tretmanima",
        faqItems: [
          { question: "Da li ultrazvuk boli?", answer: "Ne - opisuje se kao prijatna mikromasaža, bez bola." },
          { question: "Da li mogu da radim samo ultrazvučni deo tretmana?", answer: "Kod nas je ultrazvuk uvek deo šire procedure (Laser-Sonic Face Sculpt ili Tri-Active Cellu-Erase), ne izdvojen samostalni tretman." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte tretmane sa ultrazvukom",
        text: "Pogledajte Laser-Sonic Face Sculpt i Tri-Active Cellu-Erase.",
        button: { text: "Pogledajte usluge", url: "/usluge" },
      },
    ]),
  },

  // --- 49. Priprema tela pred letnju sezonu ---
  {
    slug: "priprema-tela-pred-letnju-sezonu",
    title: "Priprema tela pred letnju sezonu – koji tretmani i paketi imaju smisla",
    excerpt: "Ako planirate seriju tretmana pred leto, objašnjavamo kada je pravo vreme da počnete i koje kombinacije imaju najviše smisla.",
    categorySlugs: ["telo-i-oblikovanje", "wellness-i-estetika"],
    tagSlugs: ["priprema-za-letnju-sezonu", "celulit-tretman"],
    statusOffset: 149,
    seo: {
      title: "Priprema tela pred leto - tretmani i paketi | Estetik Lab",
      description: "Kada je pravo vreme da počnete seriju tretmana pred leto, i koje kombinacije imaju najviše smisla.",
      keywords: ["priprema tela pred leto", "tretmani pred sezonu", "koji paket pre leta"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Zašto je vreme početka bitno" },
      {
        type: "paragraph",
        text: "Pošto se rezultati ESMA tretmana grade kroz seriju od 5 do 10 poseta, a ne posle jednog tretmana, planiranje unapred ima smisla ako želite da vidite razliku do određenog datuma - na primer pred letnju sezonu.",
      },
      { type: "heading", level: 3, text: "Kombinacije koje najčešće imaju smisla" },
      {
        type: "list",
        ordered: false,
        items: [
          "Rad na celulitu i masnim naslagama - Lipolise Russian-Max, Tri-Active Cellu-Erase ili neki od anticelulit premium paketa",
          "Tonus mišića - Tesla-Tone 24, samostalno ili u kombinaciji sa terapeutskom masažom",
          "Osećaj lakših nogu - Aqua-Drain 360, samostalno ili u Detox & Relax Premium paketu",
        ],
      },
      {
        type: "callout",
        variant: "info",
        title: "Koliko unapred planirati",
        text: "Ako želite da završite celu seriju od 10 tretmana pre određenog datuma, računajte na nekoliko nedelja unazad - terapeut na konsultaciji pomaže da isplanirate realan raspored.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Priprema pred leto",
        faqItems: [
          { question: "Kada je najbolje da počnem seriju tretmana?", answer: "Što ranije unapred, jer se rezultat gradi kroz seriju, ne posle jedne posete - terapeut na konsultaciji pomaže da izračunate realan raspored do željenog datuma." },
          { question: "Da li paket ili pojedinačni tretmani imaju više smisla za pripremu pred leto?", answer: "Paket od 5 ili 10 seansi izlazi povoljnije po tretmanu ako već znate da vam je potrebna cela serija." },
        ],
      },
      {
        type: "cta",
        title: "Zakažite konsultaciju za plan pred leto",
        text: "Zakažite konsultaciju i isplanirajte seriju tretmana na vreme.",
        button: { text: "Zakažite konsultaciju", url: "/usluge" },
      },
    ]),
  },

  // --- 50. Paket tretmana kao poklon ---
  {
    slug: "paket-tretmana-kao-poklon",
    title: "Paket tretmana kao poklon – ideja za rođendan ili praznik",
    excerpt: "Umesto uobičajenog poklona, razmislite o paketu tretmana - objašnjavamo kako to izgleda u praksi, kada kupujete paket za nekog drugog.",
    categorySlugs: ["paketi-i-cene", "wellness-i-estetika"],
    tagSlugs: ["poklon-paket", "paketi-tretmana"],
    statusOffset: 153,
    seo: {
      title: "Paket tretmana kao poklon | Estetik Lab",
      description: "Ideja za poklon - paket tretmana ili masaža, umesto uobičajenog poklona za rođendan ili praznik.",
      keywords: ["poklon paket tretmana", "poklon ideja masaza", "paket kao poklon novi sad"],
    },
    content: blocks([
      { type: "heading", level: 2, text: "Poklon koji traje duže od jedne večeri" },
      {
        type: "paragraph",
        text: "Umesto uobičajenog poklona, paket tretmana ili masaža je način da nekome poklonite iskustvo, ne samo predmet - posebno ako znate da bi osoba cenila predah ili rad na konkretnom cilju (npr. opuštanje, nega lica, rad na tonusu).",
      },
      { type: "heading", level: 3, text: "Kako to izgleda u praksi" },
      {
        type: "paragraph",
        text: "Paket kupujete unapred, a osoba kojoj poklanjate zakazuje svoje termine u dogovoru sa terapeutom, u tempu koji njoj odgovara. Za tačan proces poklanjanja paketa nekom drugom (npr. prenos podataka ili zakazivanje u ime primaoca), kontaktirajte nas direktno pre kupovine.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Ideje po prilici",
        text: "Relaks masaža za nekoga ko je pod stresom, anticelulit ili elektrolipoliza paket za nekoga ko radi na konkretnom cilju, ili Sculpt & Glow Premium za poklon koji kombinuje lice i opuštanje.",
      },
      { type: "heading", level: 2, text: "Najčešća pitanja" },
      {
        type: "faq",
        title: "FAQ - Paket kao poklon",
        faqItems: [
          { question: "Kako osoba kojoj poklanjam zakazuje termine?", answer: "Za tačan proces (da li se paket vezuje za nalog primaoca ili se termini zakazuju u vaše ime pa prepisuju) kontaktirajte nas direktno pre kupovine, kako biste izbegli nesporazum." },
          { question: "Da li paket ima rok trajanja koji treba imati na umu kod poklanjanja?", answer: "Da - preporučujemo da tretmane iskoristite u razumnom roku radi kontinuiteta efekta, pa je dobro tu informaciju preneti i osobi kojoj poklanjate." },
        ],
      },
      {
        type: "cta",
        title: "Pogledajte pakete za poklon",
        text: "Pregledajte našu ponudu paketa i kontaktirajte nas za detalje oko poklanjanja.",
        button: { text: "Pogledajte pakete", url: "/paketi" },
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
    // Skip guard: if this post is ALREADY "published" in the DB (either
    // because the publish-scheduled-posts cron flipped it there, or because
    // you edited it by hand in the admin after it went live), this seed
    // leaves it COMPLETELY untouched - no field is overwritten, not content,
    // not SEO, not categories/tags, nothing. Re-running this seed will never
    // clobber a real, live, possibly hand-edited post. Checked first, before
    // resolving categorySlugs/tagSlugs, so a since-renamed/removed taxonomy
    // slug can't throw for a post we're about to skip anyway. Only posts
    // that are still "draft"/"scheduled" (or don't exist yet) get resolved
    // and created/updated below.
    const existing = await Post.findOne({ slug: def.slug }, "status").lean();
    if (existing?.status === "published") {
      created.push(existing);
      continue;
    }

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

export async function seedAllBlogContent() {
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

  logInfo("Ceo blog sadržaj (post-content + pilar A-E) seedovan", summary);

  const hasPlaceholders = posts.some((p) =>
    ["estetski-wellness-centar-u-novom-sadu", "kako-do-nas-parking-i-prevoz", "iskustva-klijenata-sta-govore"].includes(p.slug)
  );
  if (hasPlaceholders) {
    console.log(
      "\n⚠️  PODSETNIK: postovi 'estetski-wellness-centar-u-novom-sadu', 'kako-do-nas-parking-i-prevoz' i " +
        "'iskustva-klijenata-sta-govore' i dalje sadrže [POPUNI: ...] placeholder tekst (radno vreme, parking, " +
        "prevoz, testimoniali) - dopuni ih u administraciji pre nego što stignu do zakazanog datuma objave.\n"
    );
  }

  return summary;
}

export default seedAllBlogContent;