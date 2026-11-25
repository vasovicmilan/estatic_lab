import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import cardRepo from "../repositories/employee-card.repository.js";
import employeeRepo from "../repositories/employee.repository.js";
import materialRepo from "../repositories/material.repository.js";
import productRepo from "../repositories/product.repository.js";
import { decryptPhone } from "../utils/phone.util.js";
import { normalizeSocialLink } from "../utils/social-link.util.js";
import { buildVCard } from "../utils/vcard.util.js";
import { deleteUploadedFile } from "../utils/file-cleanup.util.js";
import { notFound, badRequest, validationError } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { BUSINESS } from "../config/business.config.js";
import { FEATURES } from "../config/features.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PATH = process.env.UPLOAD_PUBLIC_PATH || path.join(__dirname, "..", "public");

export const MAX_PINNED_SERVICES = 3;
export const MAX_PINNED_PRODUCTS = 6;
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // bez zamenljivih znakova (0/o, 1/l/i)
const SLUG_LENGTH = 8;

// populate za zaposlenog: osnovni podaci naloga, Expert (samo za jednokratno kopiranje slike) i
// aktivne usluge sa kategorijama
const employeePopulate = [
  { path: "userId", select: "firstName lastName email phone" },
  { path: "expert", select: "firstName lastName title image" },
  { path: "services", select: "name slug isActive categories", match: { isActive: true }, populate: { path: "categories", select: "name slug" } },
];

const cardPopulate = [{ path: "material", select: "title slug isActive" }];

export function buildCardUrl(slug) {
  return `${BUSINESS.siteUrl.replace(/\/+$/, "")}/vizitka/${slug}`;
}

function randomSlug() {
  const bytes = crypto.randomBytes(SLUG_LENGTH);
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

async function generateUniqueCardSlug() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = randomSlug();
    if (!(await cardRepo.slugExists(slug))) return slug;
  }
  throw new Error("Nije moguće generisati jedinstven link vizitke");
}

function idOf(value) {
  return value?._id ? value._id.toString() : value?.toString();
}

function employeeFullName(employee) {
  const user = employee?.userId || {};
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

/** Aktivne usluge zaposlenog + kategorije u kojima radi (unija kategorija tih usluga). */
function collectWorkArea(employee) {
  const services = (employee?.services || []).filter((s) => s && s.isActive !== false);
  const categoryMap = new Map();
  for (const service of services) {
    for (const category of service.categories || []) {
      if (category?._id) categoryMap.set(idOf(category), { id: idOf(category), name: category.name });
    }
  }
  return {
    services: services.map((s) => ({ id: idOf(s), name: s.name, slug: s.slug, categoryIds: (s.categories || []).map(idOf) })),
    categories: [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name, "sr")),
  };
}

/** Aktivni artikli prodavnice koje zaposleni može da izdvoji (prazno ako je modul prodavnice isključen). */
async function loadProductOptions() {
  if (!FEATURES.shop) return [];
  const result = await productRepo.findProducts({ limit: 100, filters: { isActive: true }, populateFields: [], sort: { name: 1 } });
  return (result?.data || []).map((p) => ({ id: idOf(p), name: p.name, slug: p.slug }));
}

async function loadEmployee(employeeId) {
  const employee = await employeeRepo.findEmployeeById(employeeId, { populateFields: employeePopulate });
  if (!employee) notFound("Zaposleni");
  return employee;
}

function defaultsFor(employee) {
  return {
    slug: null,
    isPublic: false,
    adminDisabled: false,
    displayName: employeeFullName(employee),
    title: employee.expert?.title || "",
    photo: null,
    bio: "",
    instagram: "",
    facebook: "",
    website: "",
    show: { phone: false, email: false, bio: false, instagram: false, facebook: false, website: false, services: false, products: false },
    categories: [],
    pinnedServices: [],
    pinnedProducts: [],
    material: null,
    viewCount: 0,
    contactDownloadCount: 0,
  };
}

/** Sve što treba formi "Moja vizitka" u panelu zaposlenog. */
export async function getEditorData(employeeId) {
  const employee = await loadEmployee(employeeId);
  const existing = await cardRepo.findCardByEmployee(employeeId, { populateFields: cardPopulate });
  const card = existing || defaultsFor(employee);
  const area = collectWorkArea(employee);

  return {
    exists: !!existing,
    card: {
      ...card,
      id: existing ? idOf(existing) : null,
      categories: (card.categories || []).map(idOf),
      pinnedServices: (card.pinnedServices || []).map(idOf),
      pinnedProducts: (card.pinnedProducts || []).map(idOf),
      materialId: card.material ? idOf(card.material) : "",
    },
    url: existing ? buildCardUrl(existing.slug) : null,
    contact: { phone: decryptPhone(employee.userId?.phone), email: employee.userId?.email || "" },
    availableCategories: area.categories,
    availableServices: area.services,
    availableProducts: await loadProductOptions(),
    materials: (await materialRepo.findActiveMaterialOptions()).map((m) => ({ id: idOf(m), title: m.title })),
    expertPhoto: employee.expert?.image?.img || null,
    maxPinned: MAX_PINNED_SERVICES,
    maxPinnedProducts: MAX_PINNED_PRODUCTS,
  };
}

function toIdList(value) {
  if (value === undefined || value === null || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

async function copyExpertPhoto(expertImg) {
  if (!/^\/images\/experts\/[\w.-]+$/.test(expertImg || "")) return null;
  const source = path.join(PUBLIC_PATH, expertImg);
  if (!(await fs.pathExists(source))) return null;
  const ext = path.extname(expertImg).toLowerCase();
  const name = `vizitka-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.ensureDir(path.join(PUBLIC_PATH, "images", "vizitke"));
  await fs.copy(source, path.join(PUBLIC_PATH, "images", "vizitke", name));
  return `/images/vizitke/${name}`;
}

/**
 * Čuva vizitku (kreira je pri prvom čuvanju). `input` je već očišćen od validatora; ovde se
 * dodatno proverava da su izabrane kategorije/usluge zaista zaposlenog (nema izbora tuđih).
 * `photo` = { img } iz upload-a, `copyExpertPhoto` = jednokratno kopiranje slike sa Expert profila.
 */
export async function saveCard(employeeId, input, { photo = null, copyExpertPhoto: wantsCopy = false } = {}) {
  if (!employeeId) validationError("employeeId");
  const employee = await loadEmployee(employeeId);
  const existing = await cardRepo.findCardByEmployee(employeeId);
  const area = collectWorkArea(employee);

  const allowedCategories = new Set(area.categories.map((c) => c.id));
  const allowedServices = new Set(area.services.map((s) => s.id));

  const categories = toIdList(input.categories).filter((id) => allowedCategories.has(id));
  const pinnedServices = [...new Set(toIdList(input.pinnedServices).filter((id) => allowedServices.has(id)))];
  if (pinnedServices.length > MAX_PINNED_SERVICES) badRequest(`Možete izdvojiti najviše ${MAX_PINNED_SERVICES} usluge.`);

  // artikli: samo aktivni artikli prodavnice (nema izbora nepostojećih ili neaktivnih id-eva)
  let pinnedProducts = [];
  const requestedProducts = [...new Set(toIdList(input.pinnedProducts))];
  if (requestedProducts.length > MAX_PINNED_PRODUCTS) badRequest(`Možete izdvojiti najviše ${MAX_PINNED_PRODUCTS} artikala.`);
  if (requestedProducts.length && FEATURES.shop) {
    const allowedProducts = new Set((await loadProductOptions()).map((p) => p.id));
    pinnedProducts = requestedProducts.filter((pid) => allowedProducts.has(pid));
  }

  let material = null;
  if (input.materialId) {
    const options = await materialRepo.findActiveMaterialOptions();
    const chosen = options.find((m) => idOf(m) === String(input.materialId)) || null;
    material = chosen ? chosen._id : null;
  }

  const show = input.show || {};
  const data = {
    displayName: (input.displayName || "").trim() || employeeFullName(employee),
    title: (input.title || "").trim(),
    bio: (input.bio || "").trim(),
    instagram: normalizeSocialLink("instagram", input.instagram) || "",
    facebook: normalizeSocialLink("facebook", input.facebook) || "",
    website: normalizeSocialLink("website", input.website) || "",
    isPublic: !!input.isPublic,
    show: {
      phone: !!show.phone,
      email: !!show.email,
      bio: !!show.bio,
      instagram: !!show.instagram,
      facebook: !!show.facebook,
      website: !!show.website,
      services: !!show.services,
      products: !!show.products,
    },
    categories,
    pinnedServices,
    pinnedProducts,
    material,
  };

  let newPhotoImg = null;
  if (photo?.img) newPhotoImg = photo.img;
  else if (wantsCopy) newPhotoImg = await copyExpertPhoto(employee.expert?.image?.img);
  if (wantsCopy && !photo?.img && !newPhotoImg) badRequest("Povezani Expert profil nema sliku koja se može preuzeti.");
  if (newPhotoImg) data.photo = { img: newPhotoImg, imgDesc: data.displayName };

  let saved;
  if (existing) {
    saved = await cardRepo.updateCardById(existing._id, data);
    if (newPhotoImg && existing.photo?.img && existing.photo.img !== newPhotoImg) await deleteUploadedFile(existing.photo.img);
  } else {
    saved = await cardRepo.createCard({ ...data, employee: employeeId, slug: await generateUniqueCardSlug() });
  }
  logInfo("Employee card saved", { employeeId, cardId: idOf(saved), isPublic: data.isPublic });
  return saved;
}

export async function removeCardPhoto(employeeId) {
  const existing = await cardRepo.findCardByEmployee(employeeId);
  if (!existing?.photo?.img) return;
  await cardRepo.updateCardById(existing._id, { $unset: { photo: 1 } });
  await deleteUploadedFile(existing.photo.img);
}

/** Svesna akcija: novi slug poništava stare QR kodove i linkove. */
export async function regenerateSlug(employeeId) {
  const existing = await cardRepo.findCardByEmployee(employeeId);
  if (!existing) notFound("Vizitka");
  const saved = await cardRepo.updateCardById(existing._id, { slug: await generateUniqueCardSlug() });
  logInfo("Employee card slug regenerated", { employeeId, cardId: idOf(existing) });
  return saved;
}

async function loadPublicContext(slug) {
  const card = await cardRepo.findCardBySlug(slug, { populateFields: cardPopulate });
  if (!card || !card.isPublic || card.adminDisabled) notFound("Vizitka");
  const employee = await loadEmployee(card.employee);
  if (employee.isActive === false) notFound("Vizitka");
  return { card, employee };
}

/** Podaci za javnu stranicu. Lični podaci ulaze samo ako ih je zaposleni štiklirao. */
export async function getPublicCard(slug, { countView = true } = {}) {
  const { card, employee } = await loadPublicContext(slug);
  const area = collectWorkArea(employee);
  const show = card.show || {};
  const employeeId = idOf(employee);
  const bookUrl = (service) => `/zakazivanje/${service.slug}?employeeId=${employeeId}`;

  let pinned = [];
  let groups = [];
  if (show.services) {
    const byId = new Map(area.services.map((s) => [s.id, s]));
    pinned = (card.pinnedServices || []).map(idOf).map((id) => byId.get(id)).filter(Boolean);
    const pinnedIds = new Set(pinned.map((s) => s.id));
    groups = (card.categories || [])
      .map(idOf)
      .map((id) => area.categories.find((c) => c.id === id))
      .filter(Boolean)
      .map((category) => ({
        name: category.name,
        services: area.services.filter((s) => s.categoryIds.includes(category.id) && !pinnedIds.has(s.id)),
      }))
      .filter((g) => g.services.length);
  }
  const toView = (s) => ({ name: s.name, url: bookUrl(s), detailsUrl: `/usluge/${s.slug}` });

  // artikli prodavnice: bez partnerskog koda (prvi korak), samo aktivni, redosledom koji je zaposleni izabrao
  let products = [];
  if (show.products && FEATURES.shop && (card.pinnedProducts || []).length) {
    const wanted = card.pinnedProducts.map(idOf);
    const found = await productRepo.findProductsByIds(wanted, { populateFields: [] });
    const byId = new Map((found || []).filter((p) => p && p.isActive !== false).map((p) => [idOf(p), p]));
    products = wanted.map((pid) => byId.get(pid)).filter(Boolean).map((p) => ({ name: p.name, url: `/prodavnica/${p.slug}` }));
  }

  const material = card.material && card.material.isActive ? { title: card.material.title, url: `/materijali/${card.material.slug}` } : null;

  if (countView) await cardRepo.incrementCounter(card._id, "viewCount");

  return {
    slug: card.slug,
    url: buildCardUrl(card.slug),
    name: card.displayName || employeeFullName(employee),
    title: card.title || "",
    photo: card.photo?.img || null,
    bio: show.bio ? card.bio || "" : "",
    phone: show.phone ? decryptPhone(employee.userId?.phone) : null,
    email: show.email ? employee.userId?.email || null : null,
    instagram: show.instagram ? card.instagram || null : null,
    facebook: show.facebook ? card.facebook || null : null,
    website: show.website ? card.website || null : null,
    pinned: pinned.map(toView),
    groups: groups.map((g) => ({ name: g.name, services: g.services.map(toView) })),
    hasServices: pinned.length > 0 || groups.length > 0,
    products,
    hasProducts: products.length > 0,
    material,
  };
}

export async function getVCard(slug) {
  const { card, employee } = await loadPublicContext(slug);
  const show = card.show || {};
  await cardRepo.incrementCounter(card._id, "contactDownloadCount");
  const name = card.displayName || employeeFullName(employee);
  const text = buildVCard({
    name,
    title: card.title,
    org: BUSINESS.name,
    phone: show.phone ? decryptPhone(employee.userId?.phone) : null,
    email: show.email ? employee.userId?.email : null,
    url: buildCardUrl(card.slug),
  });
  return { text, fileName: `${(name || "kontakt").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kontakt"}.vcf` };
}

export async function listCardsForAdmin() {
  const cards = await cardRepo.findCards({
    populateFields: [{ path: "employee", select: "userId isActive", populate: { path: "userId", select: "firstName lastName" } }],
  });
  return cards.map((c) => ({
    id: idOf(c),
    name: c.displayName || employeeFullName(c.employee),
    url: buildCardUrl(c.slug),
    isPublic: !!c.isPublic,
    adminDisabled: !!c.adminDisabled,
    views: c.viewCount || 0,
    contactDownloads: c.contactDownloadCount || 0,
  }));
}

export async function setAdminDisabled(cardId, disabled) {
  const card = await cardRepo.findCardById(cardId);
  if (!card) notFound("Vizitka");
  await cardRepo.updateCardById(cardId, { adminDisabled: !!disabled });
  logInfo("Employee card admin toggle", { cardId, disabled: !!disabled });
}

export async function getCardUrlForEmployee(employeeId) {
  const card = await cardRepo.findCardByEmployee(employeeId);
  return card ? buildCardUrl(card.slug) : null;
}

export default {
  MAX_PINNED_SERVICES,
  MAX_PINNED_PRODUCTS,
  buildCardUrl,
  getEditorData,
  saveCard,
  removeCardPhoto,
  regenerateSlug,
  getPublicCard,
  getVCard,
  listCardsForAdmin,
  setAdminDisabled,
  getCardUrlForEmployee,
};
