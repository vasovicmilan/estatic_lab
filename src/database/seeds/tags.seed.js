import Tag from "../../models/tag.model.js";

const DOMAIN = "product";

// ---------------------------------------------------------------------------
// Benefit tagovi – šta proizvod pruža korisniku
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
  { name: "Neinvazivno", slug: "neinvazivno" },
];

// ---------------------------------------------------------------------------
// Seed funkcija – vraća mapu slug -> ObjectId
// ---------------------------------------------------------------------------

export async function seedTags() {
  const results = [];
  const idMap = {};

  for (const def of tagDefs) {
    const doc = await Tag.findOneAndUpdate(
      { slug: def.slug, domain: DOMAIN },
      { name: def.name, slug: def.slug, domain: DOMAIN, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(doc);
    idMap[doc.slug] = doc._id.toString();
    console.log(`   🏷️  ${def.name} (${def.slug}) → ${doc._id}`);
  }

  console.log(`\n✅ Seedovano ${results.length} benefit tagova za domen "${DOMAIN}"`);
  return idMap;
}