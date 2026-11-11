import wheelPrizeRepo from "../repositories/wheel-prize.repository.js";
import leadRepo from "../repositories/lead.repository.js";
import couponRepo from "../repositories/coupon.repository.js";
import serviceRepo from "../repositories/service.repository.js";
import categoryRepo from "../repositories/category.repository.js";
import eventEmitter from "../events/event.emitter.js";
import newsLetterService from "./news-letter.service.js";
import { mapLeadsForAdminList, mapLeadForAdminDetail, mapLeadsToCsv } from "../mappers/lead.mapper.js";
import { formatDate } from "../utils/date.time.util.js";
import { buildPhoneRecord } from "../utils/phone.util.js";
import { encryptField } from "../utils/encrypted-field.util.js";
import { pickWeighted, buildSpinPlan, generateWheelCode, secureRandom } from "../utils/wheel.util.js";
import { LEAD_SEGMENTS } from "../models/lead.model.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo, logWarn, logError } from "../utils/logger.util.js";

// Where each segment lands in the newsletter's existing interests (see news-letter.model.js)
export const SEGMENT_TO_INTERESTS = { usluge: ["general"], kozmetika: ["products"], b2b: ["partnership"] };

// Names of PRODUCT categories that hold equipment/devices - prizes that include products
// never discount these (same idea as coupon.productDiscount.excludedCategories).
const APPARATUS_CATEGORY_NAME = /aparat|ure[đd]aj|oprema/i;

const PALETTE = ["#b08d57", "#7a5c3e", "#d9c3a0", "#5d4a36", "#c9a66b", "#8c6d4a"];

// Starting prize set - created once, only when the collection is empty. After that everything
// (chances, stock, validity, on/off) is edited in admin; this list is never re-applied.
export const DEFAULT_PRIZES = [
  { key: "popust-10", label: "10% popusta", shortLabel: "10% popust", weight: 45, stock: null, isFallback: true, discountType: "percentage", discountValue: 10, includeProducts: true, serviceSlugs: [] },
  { key: "popust-15", label: "15% popusta", shortLabel: "15% popust", weight: 25, stock: 150, discountType: "percentage", discountValue: 15, includeProducts: true, serviceSlugs: [] },
  { key: "popust-20", label: "20% popusta", shortLabel: "20% popust", weight: 15, stock: 80, discountType: "percentage", discountValue: 20, includeProducts: true, serviceSlugs: [] },
  { key: "besplatna-masaza", label: "Besplatna relaks masaža (30 min)", shortLabel: "Masaža gratis", weight: 8, stock: 25, discountType: "percentage", discountValue: 100, maxDiscountAmount: 2000, serviceSlugs: ["relaks-masaza"] },
  { key: "besplatan-neo-sculpt", label: "Besplatan Neo Sculpt tretman", shortLabel: "Neo Sculpt gratis", weight: 4, stock: 12, discountType: "percentage", discountValue: 100, maxDiscountAmount: 3000, serviceSlugs: ["neo-sculpt-pro"] },
  { key: "besplatan-esma", label: "Besplatan ESMA tretman", shortLabel: "ESMA gratis", weight: 3, stock: 8, discountType: "percentage", discountValue: 100, maxDiscountAmount: 3500, serviceSlugs: ["teslatone-24"] },
];

// Coupons the wheel minted before Coupon.origin existed would otherwise show up in the main
// coupon list - flag them once (idempotent, a no-op when there is nothing left to flag).
async function flagLegacyWheelCoupons() {
  try {
    await couponRepo.markCouponsAsWheel(await leadRepo.allCouponIds());
  } catch (error) {
    logError("[wheel] flagLegacyWheelCoupons failed", error);
  }
}

export async function ensureDefaultPrizes() {
  await flagLegacyWheelCoupons();
  if ((await wheelPrizeRepo.countPrizes()) > 0) return;
  await wheelPrizeRepo.createPrizes(
    DEFAULT_PRIZES.map((p, i) => ({ stock: null, maxDiscountAmount: null, includeProducts: false, ...p, order: i + 1, color: PALETTE[i % PALETTE.length] }))
  );
  logInfo("Wheel prizes seeded with defaults", { count: DEFAULT_PRIZES.length });
}

const isAvailable = (p) => p.isActive && (p.stock == null || p.awardedCount < p.stock);

/** What the public page draws: only prizes that can still be won, and never their weights/stock. */
export async function getWheelConfig() {
  await ensureDefaultPrizes();
  const prizes = (await wheelPrizeRepo.findAllPrizes({ onlyActive: true })).filter(isAvailable);
  return prizes.map((p) => ({ key: p.key, label: p.label, shortLabel: p.shortLabel, color: p.color }));
}

async function claimRandomPrize(rng) {
  const active = await wheelPrizeRepo.findAllPrizes({ onlyActive: true });
  let candidates = active.filter(isAvailable);

  while (candidates.length) {
    const pick = pickWeighted(candidates, rng);
    if (!pick) break;
    const claimed = await wheelPrizeRepo.claimPrize(pick._id);
    if (claimed) return claimed;
    // lost the race for the last one (or it was just switched off) - draw again without it
    candidates = candidates.filter((c) => String(c._id) !== String(pick._id));
  }

  const fallback = active.find((p) => p.isFallback);
  const claimedFallback = fallback ? await wheelPrizeRepo.claimPrize(fallback._id) : null;
  if (!claimedFallback) conflict("Nagrade su trenutno podeljene. Javite se osoblju na štandu.");
  return claimedFallback;
}

async function mintCoupon(prize) {
  let applicableServices = [];
  if (prize.serviceSlugs?.length) {
    const found = await Promise.all(prize.serviceSlugs.map((slug) => serviceRepo.findServiceBySlug(slug)));
    applicableServices = found.filter(Boolean).map((s) => s._id);
    // an empty list on a Coupon means "valid for every service" - for a prize that is
    // meant for ONE treatment that would silently hand out far more than promised
    if (!applicableServices.length) {
      throw new Error(`Nagrada ${prize.key}: nijedna usluga (${prize.serviceSlugs.join(", ")}) ne postoji`);
    }
  }

  let productDiscount = null;
  if (prize.includeProducts) {
    const categories = await categoryRepo.findAllCategoriesByDomain("product", { onlyActive: false });
    const excluded = categories.filter((c) => APPARATUS_CATEGORY_NAME.test(c.name)).map((c) => c._id);
    if (excluded.length) {
      productDiscount = {
        discountType: prize.discountType,
        discountValue: prize.discountValue,
        maxDiscountAmount: prize.maxDiscountAmount ?? null,
        minOrderValue: 0,
        applicableProducts: [],
        excludedCategories: excluded,
      };
    } else {
      // no apparatus category found - safer to leave products out than to discount devices
      logWarn("Wheel prize coupon: no apparatus category found, product discount left off", { prize: prize.key });
    }
  }

  const validUntil = new Date(Date.now() + prize.validDays * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const coupon = await couponRepo.createCoupon({
        code: generateWheelCode(),
        discountType: prize.discountType,
        discountValue: prize.discountValue,
        maxDiscountAmount: prize.maxDiscountAmount ?? null,
        minValue: 0,
        maxUses: 1,
        maxUsesPerUser: 1,
        applicableServices,
        applicablePackages: [],
        productDiscount,
        validFrom: new Date(),
        validUntil,
        isActive: true,
        origin: "wheel",
        wheelPrizeKey: prize.key,
      });
      return { coupon, validUntil };
    } catch (error) {
      if (error?.code !== 11000) throw error; // only a code collision is worth another try
    }
  }
  throw new Error("Nije moguće generisati jedinstven kod kupona");
}

/**
 * One spin: validates, takes one prize from the stock, mints its single-use coupon, saves
 * the lead and returns what the page needs to animate and show the result. The prize and the
 * number of turns are decided HERE - the browser only plays the animation.
 */
export async function spin(data, { ip, userAgent, rng = secureRandom } = {}) {
  if (!data) validationError("data");
  for (const field of ["firstName", "lastName", "email", "phone", "segment"]) if (!data[field]) validationError(field);
  if (!LEAD_SEGMENTS.includes(data.segment)) badRequest("Izaberite šta vas zanima");
  if (!data.consentContact) badRequest("Morate prihvatiti da vas kontaktiramo u vezi nagrade");

  const email = String(data.email).toLowerCase().trim();
  const phoneRecord = buildPhoneRecord(data.phone);
  if (!phoneRecord) badRequest("Unesite ispravan broj telefona");

  const existing = await leadRepo.findLeadByEmailOrPhoneHash(email, phoneRecord.hash);
  if (existing) conflict("Sa ovim emailom ili brojem telefona je točak već zavrćen. Kod nagrade vam je poslat na email.");

  await ensureDefaultPrizes();
  const prize = await claimRandomPrize(rng);

  let coupon;
  let validUntil;
  let lead;
  try {
    ({ coupon, validUntil } = await mintCoupon(prize));
    lead = await leadRepo.createLead({
      firstName: String(data.firstName).trim(),
      lastName: encryptField(data.lastName),
      email,
      phone: phoneRecord,
      segment: data.segment,
      source: data.source ? String(data.source).trim().slice(0, 60) : "tocak",
      consentContact: true,
      consentMarketing: !!data.consentMarketing,
      prize: prize._id,
      prizeLabel: prize.label,
      coupon: coupon._id,
      couponCode: coupon.code,
      couponValidUntil: validUntil,
      ip,
      userAgent,
    });
  } catch (error) {
    // undo whatever was already done so a failed spin burns neither stock nor a coupon
    await wheelPrizeRepo.releasePrize(prize._id).catch((e) => logError("[wheel] releasePrize failed", e));
    if (coupon) await couponRepo.deleteCouponById(coupon._id).catch((e) => logError("[wheel] deleteCoupon failed", e));
    // a parallel request with the same email/phone won the unique index
    if (error?.code === 11000 && /email|phone/.test(JSON.stringify(error.keyPattern || {}))) {
      conflict("Sa ovim emailom ili brojem telefona je točak već zavrćen.");
    }
    throw error;
  }

  if (data.consentMarketing) {
    try {
      await newsLetterService.subscribe(email, SEGMENT_TO_INTERESTS[data.segment], { source: "tocak", sourceDetail: lead.source || null });
    } catch (error) {
      logError("[wheel] Newsletter subscribe failed (lead already saved)", error, { email });
    }
  }

  logInfo("Wheel spin", { leadId: lead._id, prize: prize.key, segment: data.segment, source: lead.source });
  eventEmitter.emit("wheel:won", {
    leadId: lead._id.toString(),
    email,
    firstName: lead.firstName,
    prizeLabel: prize.label,
    couponCode: coupon.code,
    validUntil,
  });

  return {
    prize: { key: prize.key, label: prize.label },
    couponCode: coupon.code,
    validUntil,
    ...buildSpinPlan(rng),
  };
}

// ---------------- admin ----------------

export async function listLeads({ search = "", filters = {}, limit = 10, page = 1, sort } = {}) {
  const result = await leadRepo.findLeads({ search, limit, page, filters, ...(sort ? { sort } : {}) });
  return { data: mapLeadsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getLeadById(leadId) {
  if (!leadId) validationError("leadId");
  const lead = await leadRepo.findLeadById(leadId);
  if (!lead) notFound("Kontakt");
  return mapLeadForAdminDetail(lead);
}

export async function exportLeadsCsv(filters = {}) {
  return mapLeadsToCsv(await leadRepo.findAllLeadsForExport(filters));
}

const COUPON_STATE_LABELS = { used: "Iskorišćen", active: "Aktivan", expired: "Istekao" };

function couponState(c, now = new Date()) {
  if ((c.usedCount || 0) > 0) return "used";
  if (!c.isActive || (c.validUntil && c.validUntil < now)) return "expired";
  return "active";
}

/** Admin view of the single-use coupons the wheel handed out - kept out of the main coupon list. */
export async function listWheelCoupons({ search = "", filters = {}, limit = 10, page = 1, sort } = {}) {
  await flagLegacyWheelCoupons();
  const result = await couponRepo.findCoupons({
    search,
    limit,
    page,
    filters: { origin: "wheel", wheelPrizeKey: filters.prize || undefined, state: filters.state || undefined },
    ...(sort ? { sort } : {}),
  });
  const [leads, prizes] = await Promise.all([
    leadRepo.findLeadsByCouponIds(result.data.map((c) => c._id)),
    wheelPrizeRepo.findAllPrizes(),
  ]);
  const leadByCoupon = new Map(leads.map((l) => [String(l.coupon), l]));
  const prizeLabel = new Map(prizes.map((p) => [p.key, p.label]));
  const now = new Date();
  const data = result.data.map((c) => {
    const lead = leadByCoupon.get(String(c._id));
    return {
      id: c._id.toString(),
      kod: c.code,
      nagrada: prizeLabel.get(c.wheelPrizeKey) || c.wheelPrizeKey || "-",
      dobitnik: lead ? `${lead.firstName} (${lead.email})` : "-",
      status: COUPON_STATE_LABELS[couponState(c, now)],
      vaziDo: formatDate(c.validUntil),
      iskorisceno: `${c.usedCount || 0}/${c.maxUses ?? 1}`,
    };
  });
  return { data, total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages, prizes: prizes.map((p) => ({ key: p.key, label: p.label })) };
}

export async function listSources() {
  return leadRepo.distinctSources();
}

export async function deleteLead(leadId) {
  if (!leadId) validationError("leadId");
  const removed = await leadRepo.deleteLeadById(leadId);
  if (!removed) notFound("Kontakt");
  logInfo("Lead deleted", { leadId });
}

export const MIN_ACTIVE_PRIZES = 2;
export const MAX_ACTIVE_PRIZES = 12; // more slices than this and the labels on the wheel stop being readable

const DIACRITICS = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj" };

/** "Besplatan ESMA tretman" -> "besplatan-esma-tretman" (the stable id coupons keep pointing at). */
export function slugifyPrizeKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[čćšžđ]/g, (c) => DIACRITICS[c])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniquePrizeKey(label, all) {
  const base = slugifyPrizeKey(label) || "nagrada";
  const taken = new Set(all.map((p) => p.key));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

function toPrizeView(p) {
  return {
    id: p._id.toString(),
    key: p.key,
    label: p.label,
    shortLabel: p.shortLabel,
    color: p.color,
    weight: p.weight,
    stock: p.stock,
    awardedCount: p.awardedCount,
    remaining: p.stock == null ? null : Math.max(0, p.stock - p.awardedCount),
    validDays: p.validDays,
    order: p.order,
    isActive: p.isActive,
    isFallback: p.isFallback,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscountAmount: p.maxDiscountAmount ?? null,
    serviceSlugs: p.serviceSlugs || [],
    includeProducts: !!p.includeProducts,
  };
}

export async function listPrizesForAdmin() {
  await ensureDefaultPrizes();
  return (await wheelPrizeRepo.findAllPrizes()).map(toPrizeView);
}

export async function getPrizeForEdit(prizeId) {
  if (!prizeId) validationError("prizeId");
  const prize = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!prize) notFound("Nagrada");
  return toPrizeView(prize);
}

/** Services a prize can be tied to (value = slug, because that is what the coupon is minted from). */
export async function listServiceOptions() {
  const result = await serviceRepo.findServices({ limit: 300, page: 1, populateFields: [], sort: { name: 1 } });
  return (result.data || []).map((s) => ({ value: s.slug, label: s.name }));
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function num(value, fallback = null) {
  if (value === undefined || value === null || value === "" || Number.isNaN(Number(value))) return fallback;
  return Number(value);
}

/** Cleans and validates the whole prize form; `existing` is the stored prize when editing. */
async function normalizePrizeInput(input, existing = null) {
  const label = String(input.label ?? "").trim();
  const shortLabel = String(input.shortLabel ?? "").trim();
  if (!label) badRequest("Naziv nagrade je obavezan");
  if (!shortLabel) badRequest("Kratak naziv (za točak) je obavezan");
  if (shortLabel.length > 18) badRequest("Kratak naziv može imati najviše 18 karaktera, da stane na točak");

  const discountType = input.discountType;
  if (!["percentage", "fixed"].includes(discountType)) badRequest("Izaberite tip popusta");
  const discountValue = num(input.discountValue);
  if (discountValue == null || discountValue <= 0) badRequest("Vrednost popusta mora biti veća od 0");
  if (discountType === "percentage" && discountValue > 100) badRequest("Procenat popusta ne može biti veći od 100");

  const maxDiscountAmount = num(input.maxDiscountAmount);
  if (maxDiscountAmount != null && maxDiscountAmount < 0) badRequest("Maksimalan popust ne može biti negativan");

  const weight = num(input.weight);
  if (weight == null || weight < 0) badRequest("Šansa mora biti broj 0 ili veći");
  const stock = num(input.stock);
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) badRequest("Zaliha mora biti ceo broj 0 ili veći");
  if (stock != null && existing && stock < existing.awardedCount) badRequest(`Zaliha ne može biti manja od već podeljenih (${existing.awardedCount})`);
  const validDays = num(input.validDays, 30);
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) badRequest("Rok važenja je 1-365 dana");
  const order = num(input.order, existing?.order ?? 0);

  const color = input.color ? String(input.color).trim() : existing?.color || "#b08d57";
  if (!HEX_COLOR.test(color)) badRequest("Boja mora biti u obliku #rrggbb");

  const serviceSlugs = Array.from(new Set((Array.isArray(input.serviceSlugs) ? input.serviceSlugs : []).map((x) => String(x).trim()).filter(Boolean)));
  for (const slug of serviceSlugs) {
    if (!(await serviceRepo.findServiceBySlug(slug))) badRequest(`Usluga "${slug}" ne postoji`);
  }

  const isActive = input.isActive !== false;
  const isFallback = !!input.isFallback;
  if (isFallback && (stock != null || !isActive)) badRequest("Rezervna nagrada mora biti aktivna i bez ograničene zalihe - to je ono što točak daje kad ostale nestanu.");

  return { label, shortLabel, color, discountType, discountValue, maxDiscountAmount, weight, stock, validDays, order, isActive, isFallback, serviceSlugs, includeProducts: !!input.includeProducts };
}

// the wheel needs a sensible number of slices: at least 2 to be a choice, at most 12 to stay readable
function assertActiveCount(prizes, { replacing = null, adding = null } = {}) {
  const active = prizes.filter((p) => (replacing && String(p._id) === String(replacing._id) ? replacing.isActive : p.isActive)).length + (adding?.isActive ? 1 : 0);
  if (active < MIN_ACTIVE_PRIZES) badRequest(`Točak mora imati bar ${MIN_ACTIVE_PRIZES} aktivne nagrade.`);
  if (active > MAX_ACTIVE_PRIZES) badRequest(`Točak može imati najviše ${MAX_ACTIVE_PRIZES} aktivnih nagrada, inače se natpisi ne vide. Isključite neku pre dodavanja nove.`);
}

export async function createPrize(input) {
  const data = await normalizePrizeInput(input);
  const all = await wheelPrizeRepo.findAllPrizes();
  assertActiveCount(all, { adding: data });
  const key = await uniquePrizeKey(input.key || data.label, all);
  const created = await wheelPrizeRepo.createPrize({ ...data, key, awardedCount: 0, color: input.color ? data.color : PALETTE[all.length % PALETTE.length] });
  if (data.isFallback) await wheelPrizeRepo.unsetFallbackExcept(created._id);
  logInfo("Wheel prize created", { prizeId: created._id, key });
  return toPrizeView(created);
}

/** Full edit of one prize (everything except its key, which coupons already minted refer to). */
export async function updatePrizeFull(prizeId, input) {
  if (!prizeId) validationError("prizeId");
  const existing = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!existing) notFound("Nagrada");
  const data = await normalizePrizeInput(input, existing);
  const all = await wheelPrizeRepo.findAllPrizes();
  assertActiveCount(all, { replacing: { _id: existing._id, isActive: data.isActive } });
  if (existing.isFallback && !data.isFallback) {
    badRequest("Ovo je rezervna nagrada. Da biste je zamenili, označite drugu nagradu kao rezervnu.");
  }
  const updated = await wheelPrizeRepo.updatePrizeById(prizeId, data);
  if (data.isFallback) await wheelPrizeRepo.unsetFallbackExcept(updated._id);
  logInfo("Wheel prize fully updated", { prizeId });
  return { before: toPrizeView(existing), after: toPrizeView(updated) };
}

/**
 * Deletes a prize that was never handed out. One that already has winners is only ever switched
 * off - the contacts and coupons it produced keep pointing at it.
 */
export async function deletePrize(prizeId) {
  if (!prizeId) validationError("prizeId");
  const existing = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!existing) notFound("Nagrada");
  if (existing.isFallback) badRequest("Rezervna nagrada ne može da se obriše. Prvo označite drugu nagradu kao rezervnu.");
  if (existing.awardedCount > 0) badRequest(`Nagrada je već dodeljena ${existing.awardedCount} put(a) i ne može da se obriše. Isključite je (Aktivna) umesto toga.`);
  const all = await wheelPrizeRepo.findAllPrizes();
  assertActiveCount(all.filter((p) => String(p._id) !== String(prizeId)));
  await wheelPrizeRepo.deletePrizeById(prizeId);
  logInfo("Wheel prize deleted", { prizeId, key: existing.key });
  return toPrizeView(existing);
}

export async function updatePrize(prizeId, { weight, stock, validDays, isActive }) {
  if (!prizeId) validationError("prizeId");
  const existing = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!existing) notFound("Nagrada");
  if (existing.isFallback && isActive === false) badRequest("Rezervna nagrada ne može da se isključi - točak mora imati šta da dodeli.");
  if (stock != null && stock < existing.awardedCount) badRequest(`Zaliha ne može biti manja od već podeljenih (${existing.awardedCount})`);
  if (isActive === false && existing.isActive) assertActiveCount(await wheelPrizeRepo.findAllPrizes(), { replacing: { _id: existing._id, isActive: false } });
  const updated = await wheelPrizeRepo.updatePrizeById(prizeId, { weight, stock, validDays, isActive });
  logInfo("Wheel prize updated", { prizeId, weight, stock, validDays, isActive });
  return updated;
}

export default { getWheelConfig, spin, ensureDefaultPrizes, listWheelCoupons, listLeads, getLeadById, exportLeadsCsv, listSources, deleteLead, listPrizesForAdmin, getPrizeForEdit, listServiceOptions, createPrize, updatePrizeFull, deletePrize, updatePrize };
