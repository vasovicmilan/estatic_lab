const WHY_US = [
  {
    icon: "bi-cpu",
    title: "Profesionalna ESMA oprema",
    text: "Tretmani na ESMA Favorit aparatu — miostimulacija, limfna drenaža, mikrostrujni lifting i laserska biorevitalizacija u jednom mestu.",
  },
  {
    icon: "bi-patch-check",
    title: "Sertifikovani terapeuti",
    text: "Naš tim čine obučeni terapeuti sa iskustvom u masaži i estetskim tretmanima tela i lica.",
  },
  {
    icon: "bi-person-heart",
    title: "Individualni pristup",
    text: "Svaki tretman prilagođavamo vašoj koži, telu i cilju — bez univerzalnih rešenja.",
  },
  {
    icon: "bi-flower1",
    title: "Opuštajući ambijent",
    text: "Mirna, čista i negovana atmosfera osmišljena da vam pruži pravi predah od svakodnevice.",
  },
];

const LEGAL_CONTACT = {
  company: "Estatik Lab wellness centar",
  address: "Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija",
  email: "estetik.lab.ns@gmail.com",
};

export function prepareAboutPageData() {
  return {
    intro:
      "Estatik Lab je wellness centar u Novom Sadu posvećen nezi tela i lica kroz stručne tretmane, modernu opremu i pažljiv, individualni pristup svakom klijentu.",
    contact: LEGAL_CONTACT,
    sections: [
      {
        title: "Naša priča",
        paragraphs: [
          "Estatik Lab je nastao iz želje da opuštanje i nega tela ne budu luksuz rezervisan za posebne prilike, već deo redovne rutine brige o sebi. Od osnivanja gradimo prostor u kojem se prepliću stručnost, mirna atmosfera i pažnja posvećena svakom detalju.",
          "Danas naš tim čine obučeni terapeuti koji svakodnevno rade na tome da svaki tretman bude prilagođen potrebama klijenta — bez univerzalnih rešenja i na brzinu odrađenih usluga.",
        ],
      },
      {
        title: "Čime se bavimo",
        paragraphs: [
          "Nudimo masaže, tretmane lica i tela, kao i estetske tretmane na profesionalnoj ESMA Favorit opremi — od miostimulacije i limfne drenaže do mikrostrujnog liftinga i laserske biorevitalizacije.",
        ],
        list: [
          "Masaže — relaksacione, terapeutske i sportske",
          "Tretmani lica — nega, čišćenje i anti-age tretmani",
          "Tretmani tela — modelovanje, drenaža i regeneracija kože",
          "Estetski tretmani — miostimulacija, mikrostrujni lifting, laserska biorevitalizacija",
        ],
      },
      {
        title: "Zašto Estatic Lab",
        list: [
          "Profesionalna ESMA oprema — miostimulacija, limfna drenaža, mikrostrujni lifting i laserska biorevitalizacija u jednom mestu",
          "Sertifikovani terapeuti sa iskustvom u masaži i estetskim tretmanima",
          "Individualni pristup — svaki tretman prilagođavamo vašoj koži, telu i cilju",
          "Opuštajući, miran i negovan ambijent osmišljen za pravi predah od svakodnevice",
        ],
      },
      {
        title: "Upoznajte naš tim",
        paragraphs: [
          "Iza svakog tretmana stoji tim ljudi koji svoj posao radi sa pažnjom i posvećenošću. Pogledajte ko čini <a href=\"/nas-tim\">naš tim</a> i upoznajte se sa njihovim iskustvom i specijalnostima.",
        ],
      },
    ],
  };
}

export function preparePrivacyPolicyData() {
  return {
    lastUpdated: "16. jul 2026.",
    intro:
      "Ova Politika privatnosti objašnjava kako Estatic Lab prikuplja, koristi, čuva i štiti vaše podatke prilikom korišćenja našeg sajta, online zakazivanja termina i drugih usluga koje pružamo u našem wellness centru u Novom Sadu.",
    contact: LEGAL_CONTACT,
    sections: [
      {
        title: "1. Ko je rukovalac podacima",
        paragraphs: [
          "Rukovalac podataka o ličnosti je <strong>Estatic Lab wellness centar</strong>, sa sedištem na adresi Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija.",
          "Za sva pitanja u vezi sa zaštitom podataka možete nas kontaktirati putem email adrese <a href=\"mailto:estetik.lab.ns@gmail.com\">estetik.lab.ns@gmail.com</a>.",
        ],
      },
      {
        title: "2. Koje podatke prikupljamo",
        paragraphs: [
          "U zavisnosti od načina na koji koristite naš sajt i usluge, možemo obraditi sledeće kategorije podataka:",
        ],
        subsections: [
          {
            title: "Podaci o identitetu i kontaktu",
            list: [
              "ime i prezime",
              "email adresa",
              "broj telefona",
              "podaci koje nam dobrovoljno pošaljete putem kontakt forme, forme za utisak klijenata ili prijave na newsletter",
            ],
          },
          {
            title: "Podaci o nalogu",
            list: [
              "lozinka u heširanom obliku (nikada u čistom tekstu)",
              "status naloga, datum poslednje prijave i informacije o načinu registracije (email ili Google nalog)",
              "podaci profila, uključujući avatar ako ga postavite",
            ],
          },
          {
            title: "Podaci o terminima i kupovini paketa",
            list: [
              "izabrana usluga, varijanta tretmana, trajanje i cena",
              "datum i vreme termina, status termina i istorija promena",
              "informacije o kuponu ili korišćenju sesija iz paketa",
              "napomene koje unesete prilikom zakazivanja",
              "podaci o kupljenim paketima tretmana povezanim sa vašim nalogom",
            ],
          },
          {
            title: "Tehnički podaci",
            list: [
              "IP adresa, tip pregledača i operativnog sistema",
              "podaci o sesiji (kolačići neophodni za prijavu i bezbednost)",
              "podaci o pristupu sajtu u svrhu bezbednosti i sprečavanja zloupotrebe",
            ],
          },
        ],
      },
      {
        title: "3. Kako prikupljamo podatke",
        paragraphs: [
          "Podatke dobijamo direktno od vas kada se registrujete, prijavite, zakažete termin, pošaljete kontakt poruku, ostavite utisak, prijavite se na newsletter ili ažurirate profil.",
          "Termin možete zakazati i kao gost, bez registracije — u tom slučaju koristimo podatke koje unesete u formi za zakazivanje. Ako email adresa već postoji u našem sistemu, termin će biti povezan sa postojećim nalogom.",
          "Ako se registrujete ili prijavite putem Google naloga, od Google-a primamo osnovne podatke profila (email, ime, prezime i identifikator naloga) u skladu sa vašim dozvolama.",
        ],
      },
      {
        title: "4. Svrha i pravni osnov obrade",
        paragraphs: [
          "Vaše podatke obrađujemo isključivo u sledeće svrhe:",
        ],
        list: [
          "zakazivanje, potvrđivanje, izmenu i otkazivanje termina",
          "vođenje korisničkog naloga i pružanje pristupa istoriji termina",
          "evidenciju kupljenih paketa tretmana i korišćenih sesija",
          "slanje servisnih obaveštenja (potvrda termina, otkazivanje, reset lozinke, aktivacija naloga)",
          "odgovaranje na vaše upite poslate putem kontakt forme",
          "slanje newsletter-a, ukoliko ste se na njega prijavili",
          "moderaciju i objavljivanje utisaka klijenata koje pošaljete",
          "obezbeđivanje bezbednosti sajta, sprečavanje zloupotrebe i poštovanje pravnih obaveza",
        ],
        closingParagraphs: [
          "Pravni osnov obrade obuhvata: izvršenje ugovora ili prethodne radnje na vaš zahtev (zakazivanje termina), vašu saglasnost (newsletter, kontakt forma, objava utiska), legitimni interes (bezbednost sajta i sprečavanje zloupotrebe) i ispunjenje zakonskih obaveza.",
        ],
      },
      {
        title: "5. Kolačići i sesije",
        paragraphs: [
          "Naš sajt koristi neophodne kolačiće za rad sesije, CSRF zaštitu i bezbednu prijavu korisnika. Sesije se čuvaju u bazi podataka i ističu nakon 14 dana neaktivnosti.",
          "Ne koristimo kolačiće za oglašavanje trećih strana. Analitički ili marketing kolačići ne koriste se u trenutnoj verziji sajta, osim ako to posebno ne obavestimo i ne zatražimo vašu saglasnost.",
        ],
      },
      {
        title: "6. Deljenje podataka sa trećim licima",
        paragraphs: [
          "Vaše podatke ne prodajemo i ne iznajmljujemo. Deljenje podataka vršimo samo u neophodnoj meri, i to sa:",
        ],
        list: [
          "<strong>Google LLC</strong> — ako koristite prijavu putem Google naloga",
          "<strong>pružaocem email usluge</strong> — za slanje transakcionih poruka (potvrde termina, reset lozinke i sl.)",
          "<strong>pružaocem hostinga i baze podataka</strong> — za tehničko skladištenje i rad aplikacije",
        ],
        paragraphs: [
          "Interne obaveštenja našem timu mogu se slati putem Telegram servisa u svrhu operativnog praćenja termina i poruka klijenata. Ovi podaci se koriste isključivo u poslovne svrhe Estatic Lab-a.",
          "Pojedini osetljivi podaci iz kontakt poruka (prezime, telefon, tekst poruke) čuvaju se u šifrovanom obliku radi dodatne zaštite.",
        ],
      },
      {
        title: "7. Period čuvanja podataka",
        list: [
          "podaci o nalogu — dok nalog postoji, odnosno dok ne zatražite brisanje",
          "podaci o terminima — u periodu neophodnom za poslovanje, knjigovodstvo i rešavanje eventualnih reklamacija",
          "kontakt poruke — dok je potrebno da odgovorimo i rešimo vaš upit",
          "newsletter pretplata — dok ste prijavljeni; nakon odjave podaci se arhiviraju ili brišu u razumnom roku",
          "tehnički logovi — u ograničenom periodu radi bezbednosti i dijagnostike",
        ],
      },
      {
        title: "8. Vaša prava",
        paragraphs: [
          "U skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije imate pravo da:",
        ],
        list: [
          "zatražite pristup svojim podacima",
          "zatražite ispravku netačnih ili nepotpunih podataka",
          "zatražite brisanje podataka, kada je to primenjivo",
          "zatražite ograničenje obrade",
          "povučete saglasnost (npr. za newsletter), bez uticaja na ranije zakonitu obradu",
          "podnesete pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti",
        ],
        paragraphs: [
          "Za ostvarivanje prava pošaljite zahtev na <a href=\"mailto:estetik.lab.ns@gmail.com\">estetik.lab.ns@gmail.com</a>. Odgovorićemo u roku propisanom zakonom.",
        ],
      },
      {
        title: "9. Bezbednost podataka",
        paragraphs: [
          "Primenujemo odgovarajuće tehničke i organizacione mere zaštite, uključujući heširanje lozinki, CSRF zaštitu, ograničenje broja zahteva (rate limiting), sanitizaciju unosa, bezbedne sesije i kontrolu pristupa u admin delu sajta.",
          "Iako ulažemo napor da vaše podatke zaštitimo, nijedan prenos podataka putem interneta nije u potpunosti bez rizika. Preporučujemo da koristite jaku lozinku i da je ne delite sa drugima.",
        ],
      },
      {
        title: "10. Deca",
        paragraphs: [
          "Naše usluge nisu namenjene licima mlađim od 16 godina. Svesno ne prikupljamo podatke o maloletnim licima bez saglasnosti roditelja ili staratelja. Ako smatrate da smo prikupili podatke deteta, kontaktirajte nas radi brisanja.",
        ],
      },
      {
        title: "11. Izmene politike privatnosti",
        paragraphs: [
          "Ovu politiku možemo povremeno ažurirati kako bismo odražavali promene u našim uslugama ili propisima. Ažurirana verzija biće objavljena na ovoj stranici sa naznačenim datumom poslednje izmene.",
        ],
      },
    ],
  };
}

export function prepareTermsAndConditionsData() {
  return {
    lastUpdated: "16. jul 2026.",
    intro:
      "Korišćenjem sajta Estatic Lab, online zakazivanja termina i usluga našeg wellness centra, prihvatate sledeće Uslove korišćenja. Molimo vas da ih pažljivo pročitate pre registracije, zakazivanja termina ili slanja poruke putem sajta.",
    contact: LEGAL_CONTACT,
    sections: [
      {
        title: "1. Opšte odredbe",
        paragraphs: [
          "Ovi Uslovi korišćenja regulišu korišćenje web sajta i online usluga koje pruža <strong>Estatic Lab wellness centar</strong>, Maksima Gorkog 6b, 21120 Novi Sad.",
          "Sajt omogućava pregled usluga, paketa tretmana, blog sadržaja, informacija o timu, online zakazivanje termina, registraciju korisničkog naloga i komunikaciju sa našim timom.",
          "Korišćenjem sajta potvrđujete da imate puno poslovnu sposobnost ili da delujete u ime lica koje je ovlašćeno da prihvati ove uslove.",
        ],
      },
      {
        title: "2. Usluge Estatic Lab-a",
        paragraphs: [
          "Estatik Lab pruža usluge nege tela i lica, masaže i estetske tretmane, uključujući tretmane na ESMA opremi (miostimulacija, limfna drenaža, mikrostrujni lifting, laserska biorevitalizacija i slično), u skladu sa aktuelnom ponudom objavljenom na sajtu.",
          "Opis, trajanje i cena usluga prikazani na sajtu su informativnog karaktera. Pre samog tretmana, naš stručni tim može dati preporuku prilagođenu vašem stanju, uz vašu saglasnost.",
          "Sajt služi za informisanje i zakazivanje. Sam tretman obavlja se u našem objektu, pod nadzorom sertifikovanih terapeuta.",
        ],
      },
      {
        title: "3. Registracija i korisnički nalog",
        list: [
          "Nalog možete kreirati putem email adrese i lozinke ili prijavom putem Google naloga.",
          "Dužni ste da prilikom registracije unesete tačne i ažurne podatke.",
          "Lozinka mora imati najmanje 8 karaktera. Odgovorni ste za čuvanje pristupnih podataka i sve aktivnosti na vašem nalogu.",
          "Nalog može biti privremeno onemogućen ili suspendovan u slučaju kršenja ovih uslova ili zloupotrebe sistema.",
          "Registracija nije obavezna za zakazivanje termina — možete zakazati termin i kao gost.",
        ],
      },
      {
        title: "4. Online zakazivanje termina",
        paragraphs: [
          "Termin možete zakazati putem stranice <a href=\"/zakazivanje\">/zakazivanje</a>, izborom usluge, varijante tretmana, datuma, vremena i — po potrebi — terapeuta.",
        ],
        subsections: [
          {
            title: "Potvrda termina",
            list: [
              "Nakon slanja zahteva, termin dobija status „u obradi” (pending) dok ga naš tim ne potvrdi ili dodeli terapeuta.",
              "Potvrđeni termin biće vam dostavljen putem email obaveštenja, ukoliko ste ostavili validnu email adresu.",
              "Prikazani slobodni termini zavise od rasporeda zaposlenih i trajanja tretmana, uključujući tehnički buffer između termina.",
            ],
          },
          {
            title: "Otkazivanje termina",
            list: [
              "Korisnik može samostalno otkazati termin iz svog naloga, najkasnije <strong>24 sata pre</strong> zakazanog vremena.",
              "Otkazivanje nakon isteka roka od 24 sata može biti moguće isključivo kontaktiranjem našeg tima, u zavisnosti od okolnosti.",
              "Estatik Lab zadržava pravo da otkaže termin u slučaju više sile, bolesti terapeuta, tehničkih problema ili drugih opravdanih razloga, uz obaveštenje klijenta.",
            ],
          },
          {
            title: "Nedolazak (no-show)",
            paragraphs: [
              "Ako se ne pojavite na potvrđeni termin bez prethodnog otkazivanja, termin može biti označen kao nedolazak. U tom slučaju, sesija iz paketa (ako je korišćena) može biti smatrana iskorišćenom, u skladu sa pravilima paketa.",
            ],
          },
        ],
      },
      {
        title: "5. Cene, plaćanje i paketi",
        paragraphs: [
          "Cene usluga i paketa prikazane na sajtu izražene su u dinarima (RSD), osim ako nije drugačije naznačeno.",
          "Online plaćanje putem sajta trenutno <strong>nije dostupno</strong>. Plaćanje se vrši u našem objektu (gotovina, platna kartica ili drugi dogovoreni način) ili se evidentira administrativno nakon dogovora sa našim timom.",
        ],
        list: [
          "Kupovina paketa tretmana evidentira se na vašem nalogu nakon plaćanja u centru ili po dogovoru sa administracijom.",
          "Sesije iz paketa mogu se koristiti za online zakazivanje, isključivo ako ste prijavljeni na nalog povezan sa paketom.",
          "Rezervacija sesije iz paketa vrši se u trenutku zakazivanja; sesija se definitivno iskorišćava tek nakon obavljenog tretmana.",
          "Ako otkažete termin rezervisan iz paketa u dozvoljenom roku, rezervisana sesija se vraća na raspolaganje.",
          "Paketi mogu imati rok važenja — proverite uslove konkretnog paketa prilikom kupovine.",
        ],
      },
      {
        title: "6. Kuponi za popust",
        paragraphs: [
          "Na sajtu možete primeniti kupon prilikom zakazivanja termina ili kupovine paketa, ukoliko je kupon aktivan i ispunjava uslove korišćenja.",
          "Kupon i plaćanje putem paketa sesija ne mogu se kombinovati za isti termin — primenjuje se jedan način popusta.",
          "Estatik Lab zadržava pravo da odbije, izmeni ili povuče kupon u slučaju zloupotrebe ili greške u sistemu.",
        ],
      },
      {
        title: "7. Newsletter, kontakt forma i utisci klijenata",
        subsections: [
          {
            title: "Newsletter",
            paragraphs: [
              "Prijavom na newsletter dajete saglasnost da vam povremeno šaljemo informacije o novostima, ponudama i savetima. Odjava je moguća u svakom trenutku putem linka u email poruci.",
            ],
          },
          {
            title: "Kontakt forma",
            paragraphs: [
              "Slanjem poruke putem kontakt forme potvrđujete da su uneti podaci tačni i da ste saglasni sa Politikom privatnosti. Obavezno je označiti saglasnost pre slanja poruke.",
            ],
          },
          {
            title: "Utisci klijenata",
            paragraphs: [
              "Utisci koje pošaljete prolaze moderaciju pre objave. Zadržavamo pravo da ne objavimo utisak koji sadrži uvredljiv, neistinit, reklamni ili na drugi način neprimeren sadržaj.",
              "Slanjem utiska dajete Estatic Lab-u dozvolu da vaš komentar, ocenu i ime (ili inicijale) objavi na sajtu, ukoliko bude odobren.",
            ],
          },
        ],
      },
      {
        title: "8. Zdravstvene napomene i odgovornost klijenta",
        paragraphs: [
          "Pre tretmana dužni ste da naš tim obavestite o postojećim zdravstvenim stanjima, alergijama, trudnoći, implantima, pejsmejkerima, upotrebi lekova ili drugim okolnostima koje mogu uticati na tretman.",
          "Estatik Lab ne snosi odgovornost za posledice ukoliko ste dali nepotpune ili netačne zdravstvene informacije.",
          "Tretmani estetske i wellness prirode ne zamenjuju lekarsku dijagnostiku ili medicinski tretman.",
        ],
      },
      {
        title: "9. Intelektualna svojina",
        paragraphs: [
          "Sav sadržaj na sajtu — tekstovi, fotografije, grafike, logo, dizajn, video materijali i softverski kod — zaštićen je autorskim pravom i pripada Estatic Lab-u ili odgovarajućim nosiocima prava.",
          "Zabranjeno je kopiranje, distribucija ili komercijalna upotreba sadržaja bez prethodne pisane saglasnosti.",
        ],
      },
      {
        title: "10. Zabranjeno ponašanje",
        list: [
          "lažno predstavljanje ili korišćenje tuđih podataka",
          "pokušaj neovlašćenog pristupa sistemu, nalozima drugih korisnika ili admin delu sajta",
          "slanje spam poruka, zloupotreba kontakt forme ili automatsko zakazivanje termina",
          "objavljivanje uvredljivih, nezakonitih ili obmanjujućih utisaka",
          "bilo kakva radnja koja ometa rad sajta ili ugrožava bezbednost drugih korisnika",
        ],
      },
      {
        title: "11. Ograničenje odgovornosti",
        paragraphs: [
          "Estatik Lab ulaže razumne napore da sajt bude dostupan i da informacije budu tačne, ali ne garantujemo da sajt u svakom trenutku radi bez prekida ili grešaka.",
          "Nismo odgovorni za indirektnu štetu, gubitak podataka ili propuštene koristi nastale korišćenjem sajta, osim u meri propisanoj primenjivim zakonima.",
          "Spoljni linkovi (npr. Google Maps) vode ka servisima trećih strana čiji uslovi važe nezavisno od naših.",
        ],
      },
      {
        title: "12. Zaštita podataka",
        paragraphs: [
          "Obrada ličnih podataka opisana je u našoj <a href=\"/politika-privatnosti\">Politici privatnosti</a>, koja čini sastavni deo ovih uslova.",
        ],
      },
      {
        title: "13. Reklamacije",
        paragraphs: [
          "Za pritužbe u vezi sa terminima, tretmanima, paketima ili radom sajta, kontaktirajte nas na <a href=\"mailto:estetik.lab.ns@gmail.com\">estetik.lab.ns@gmail.com</a> ili putem <a href=\"/kontakt\">kontakt stranice</a>. Potrudićemo se da odgovorimo u razumnom roku.",
        ],
      },
      {
        title: "14. Izmene uslova",
        paragraphs: [
          "Estatik Lab zadržava pravo da izmeni ove Uslove korišćenja. Ažurirana verzija stupa na snagu objavljivanjem na ovoj stranici. Nastavak korišćenja sajta nakon izmene podrazumeva prihvatanje novih uslova.",
        ],
      },
      {
        title: "15. Merodavno pravo",
        paragraphs: [
          "Na ove Uslove primenjuje se pravo Republike Srbije. Za sporove je nadležan sud u Novom Sadu, osim ako imperativnim propisima nije drugačije određeno.",
        ],
      },
    ],
  };
}

export function prepareHomeData({
  highlightedServices = [],
  featuredExperts = [],
  testimonials = [],
  latestPosts = [],
  bestPackages = [],
} = {}) {
  const addressText = "Maksima Gorkog 6b, Novi Sad 21120";

  const mapParam =
    "!1m18!1m12!1m3!1d2808.909996570131!2d19.843611977018323!3d45.24961274772971!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b106c892d2953%3A0x78a7de03d4dbf444!2sMaksima%20Gorkog%206b%2C%20Novi%20Sad%2021120!5e0!3m2!1sen!2srs!4v1784121266023!5m2!1sen!2srs";

  return {
    hero: {
      eyebrow: "Estatik Lab wellness centar",
      title: "Vaš prostor za opuštanje i negu",
      subtitle:
        "Masaže, ESMA tretmani i nega lica i tela u mirnom, opuštajućem ambijentu — uz stručan tim i individualan pristup svakom klijentu.",
      ctaLabel: "Zakažite termin",
      ctaUrl: "/usluge",
      secondaryCtaLabel: "Pogledajte pakete",
      secondaryCtaUrl: "/paketi",
      image: "/img/hero.jpg",
    },

    intro: {
      title: "Šta je Estetik Lab",
      lead:
        "Estetik Lab je kozmetički salon u Novom Sadu posvećen estetskim tretmanima lica i tela. Naš rad se oslanja na profesionalni ESMA aparat koji kombinuje tretmane strujom, laser i ultrazvuk, kako bismo na jednom mestu ponudili sveobuhvatnu negu prilagođenu potrebama svakog klijenta.",
      who:
        "Ovi tretmani su namenjeni svima koji žele da poboljšaju izgled i elastičnost kože, smanje celulit, zategnu telo ili ubrzaju regeneraciju — bez obzira da li se prvi put upoznajete sa estetskim tretmanima ili već imate iskustva sa negom ovog tipa.",
      massages: [
        { title: "Relax masaža", text: "Za opuštanje tela i uma nakon napornog perioda." },
        { title: "Anticelulit masaža", text: "Za modelovanje tela i zatezanje kože." },
        { title: "Terapeutska masaža", text: "Za ublažavanje napetosti, bolova i ukočenosti." },
        { title: "Sportska masaža", text: "Za regeneraciju i pripremu mišića." },
      ],
      packages:
        "Sve tretmane i masaže možete kombinovati kroz naše pakete usluga, prilagođene vašim ciljevima i dinamici poseta, čime ostvarujete bolju vrednost i kontinuitet nege.",
      closing:
        "Naš cilj je da svakom klijentu pomognemo da prevaziđe izazove sa kojima se suočava i postigne željeni izgled i osećaj u sopstvenom telu — uz stručnost, pažnju i individualan pristup.",
    },

    whyUs: WHY_US,
    highlightedServices,
    featuredExperts,
    testimonials,
    bestPackages,
    latestPosts,
    testimonialFormAction: "/testimonials/posalji",

    map: {
      address: addressText,
      embedUrl: `https://www.google.com/maps/embed?pb=${mapParam}`,
    },
    googleDataNotice: {
      text:
        "Ukoliko se registrujete ili prijavite putem Google naloga, sa Google-a primamo samo osnovne podatke vašeg profila — ime, prezime i email adresu. Ove podatke koristimo isključivo za kreiranje i povezivanje vašeg korisničkog naloga na Estetik Lab platformi, kako biste mogli da zakazujete termine i pratite svoje rezervacije. Ne delimo ih sa trećim licima niti ih koristimo u druge svrhe bez vaše saglasnosti.",
      privacyUrl: "/politika-privatnosti",
    },
  };
}

export default {
  prepareHomeData,
  preparePrivacyPolicyData,
  prepareTermsAndConditionsData,
};