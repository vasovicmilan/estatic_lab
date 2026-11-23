import wheelPrizeRepo from "../repositories/wheel-prize.repository.js";
import wheelRepo from "../repositories/wheel.repository.js";
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
import { DEFAULT_WHEEL_SLUG, RESERVED_WHEEL_SLUGS } from "../models/wheel.model.js";
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

/**
 * Prvo pokretanje: pravi podrazumevani točak ("tocak"). Ako u bazi već ima nagrada/kontakata iz
 * doba pre više točkova (bez polja wheel), ONI se preuzimaju na taj točak - ništa se ne seje
 * ispočetka. Nagrade se seju samo kad nema ni jedne (potpuno nova baza).
 * Idempotentno; scripts/migrate-multi-wheel.js zove isto ovo, pa još sredi indekse.
 */
export async function ensureDefaultPrizes() {
  await flagLegacyWheelCoupons();
  if ((await wheelRepo.countWheels()) > 0) return;

  let wheel;
  try {
    wheel = await wheelRepo.createWheel({ name: "Točak sreće", slug: DEFAULT_WHEEL_SLUG, order: 0 });
  } catch (error) {
    if (error?.code === 11000) return; // paralelni zahtev ga je upravo napravio
    throw error;
  }

  if ((await wheelPrizeRepo.countPrizes()) > 0) {
    await wheelPrizeRepo.assignOrphanPrizesToWheel(wheel._id);
    await leadRepo.assignOrphanLeadsToWheel(wheel._id);
    logInfo("Default wheel created, existing prizes and contacts assigned to it", { wheel: wheel.slug });
    return;
  }
  await wheelPrizeRepo.createPrizes(
    DEFAULT_PRIZES.map((p, i) => ({ stock: null, maxDiscountAmount: null, includeProducts: false, ...p, wheel: wheel._id, order: i + 1, color: PALETTE[i % PALETTE.length] }))
  );
  logInfo("Wheel prizes seeded with defaults", { count: DEFAULT_PRIZES.length });
}

// ---------------- točkovi ----------------

function toWheelView(w) {
  return {
    id: w._id.toString(),
    name: w.name,
    slug: w.slug,
    title: w.title || "",
    intro: w.intro || "",
    isActive: w.isActive !== false,
    validFrom: w.validFrom || null,
    validUntil: w.validUntil || null,
    order: w.order ?? 0,
    isDefault: w.slug === DEFAULT_WHEEL_SLUG,
  };
}

async function resolveWheel(slug) {
  await ensureDefaultPrizes();
  const wheel = await wheelRepo.findWheelBySlug(String(slug || DEFAULT_WHEEL_SLUG).toLowerCase());
  if (!wheel) notFound("Točak");
  return wheel;
}

/** Da li se na točku trenutno sme vrteti (uključen i u zadatom periodu). */
export function isWheelOpen(wheel, now = new Date()) {
  if (wheel.isActive === false) return false;
  if (wheel.validFrom && now < new Date(wheel.validFrom)) return false;
  if (wheel.validUntil && now > new Date(wheel.validUntil)) return false;
  return true;
}

const isAvailable = (p) => p.isActive && (p.stock == null || p.awardedCount < p.stock);

/**
 * What the public page draws for ONE wheel: only prizes that can still be won, and never their
 * weights/stock. `isOpen` is false when the wheel is off, outside its dates or has fewer than two
 * winnable prizes - the page then shows "not active" instead of the form.
 */
export async function getWheelConfig(slug = DEFAULT_WHEEL_SLUG) {
  const wheel = await resolveWheel(slug);
  const prizes = (await wheelPrizeRepo.findAllPrizes({ onlyActive: true, wheelId: wheel._id })).filter(isAvailable);
  return {
    wheel: toWheelView(wheel),
    prizes: prizes.map((p) => ({ key: p.key, label: p.label, shortLabel: p.shortLabel, color: p.color })),
    isOpen: isWheelOpen(wheel) && prizes.length >= MIN_ACTIVE_PRIZES,
  };
}

async function claimRandomPrize(wheelId, rng) {
  const active = await wheelPrizeRepo.findAllPrizes({ onlyActive: true, wheelId });
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

  const wheel = await resolveWheel(data.wheel);
  if (!isWheelOpen(wheel)) conflict("Ova nagradna igra trenutno nije aktivna.");

  const existing = await leadRepo.findLeadByEmailOrPhoneHash(email, phoneRecord.hash, wheel._id);
  if (existing) conflict("Sa ovim emailom ili brojem telefona je točak već zavrćen. Kod nagrade vam je poslat na email.");

  const prize = await claimRandomPrize(wheel._id, rng);

  let coupon;
  let validUntil;
  let lead;
  try {
    ({ coupon, validUntil } = await mintCoupon(prize));
    lead = await leadRepo.createLead({
      wheel: wheel._id,
      firstName: String(data.firstName).trim(),
      lastName: encryptField(data.lastName),
      email,
      phone: phoneRecord,
      segment: data.segment,
      source: data.source ? String(data.source).trim().slice(0, 60) : wheel.slug,
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
      await newsLetterService.subscribe(email, SEGMENT_TO_INTERESTS[data.segment], { source: "tocak", sourceDetail: lead.source || null, firstName: lead.firstName });
    } catch (error) {
      logError("[wheel] Newsletter subscribe failed (lead already saved)", error, { email });
    }
  }

  logInfo("Wheel spin", { leadId: lead._id, prize: prize.key, segment: data.segment, source: lead.source });
  eventEmitter.emit("wheel:won", {
    leadId: lead._id.toString(),
    wheelSlug: wheel.slug,
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

// filter po točku stiže kao slug; nepoznat slug ne sme da vrati "sve" - zato id koji ne postoji
async function withWheelId(filters = {}) {
  if (!filters.wheel) return filters;
  const wheel = await wheelRepo.findWheelBySlug(String(filters.wheel).toLowerCase());
  return { ...filters, wheel: wheel ? wheel._id : "000000000000000000000000" };
}

export async function listLeads({ search = "", filters = {}, limit = 10, page = 1, sort } = {}) {
  const result = await leadRepo.findLeads({ search, limit, page, filters: await withWheelId(filters), ...(sort ? { sort } : {}) });
  return { data: mapLeadsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getLeadById(leadId) {
  if (!leadId) validationError("leadId");
  const lead = await leadRepo.findLeadById(leadId);
  if (!lead) notFound("Kontakt");
  return mapLeadForAdminDetail(lead);
}

export async function exportLeadsCsv(filters = {}) {
  return mapLeadsToCsv(await leadRepo.findAllLeadsForExport(await withWheelId(filters)));
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
  const wheels = await wheelRepo.findAllWheels();
  const wheelName = new Map(wheels.map((w) => [String(w._id), w.name]));
  const labelOf = (p) => (wheels.length > 1 && wheelName.get(String(p.wheel)) ? `${p.label} (${wheelName.get(String(p.wheel))})` : p.label);
  const prizeLabel = new Map(prizes.map((p) => [p.key, labelOf(p)]));
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
  return { data, total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages, prizes: prizes.map((p) => ({ key: p.key, label: labelOf(p) })) };
}

export async function listWheelOptions() {
  await ensureDefaultPrizes();
  return (await wheelRepo.findAllWheels()).map((w) => ({ value: w.slug, label: w.name, id: w._id.toString() }));
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

// `all` = nagrade SVIH točkova: ključ je jedinstven u celoj bazi
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
    wheelId: p.wheel ? p.wheel.toString() : null,
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

export async function listPrizesForAdmin(wheelId) {
  await ensureDefaultPrizes();
  return (await wheelPrizeRepo.findAllPrizes({ wheelId })).map(toPrizeView);
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
// `prizes` = nagrade JEDNOG točka. Dok se novi točak tek puni nagradama, dodavanje sme da ostavi manje od
// minimuma (javna strana kaže "nije aktivna" dok ne bude bar 2); smanjivanje ispod minimuma nije dozvoljeno.
function assertActiveCount(prizes, { replacing = null, adding = null } = {}) {
  const active = prizes.filter((p) => (replacing && String(p._id) === String(replacing._id) ? replacing.isActive : p.isActive)).length + (adding?.isActive ? 1 : 0);
  if (!adding && active < MIN_ACTIVE_PRIZES) badRequest(`Točak mora imati bar ${MIN_ACTIVE_PRIZES} aktivne nagrade.`);
  if (active > MAX_ACTIVE_PRIZES) badRequest(`Točak može imati najviše ${MAX_ACTIVE_PRIZES} aktivnih nagrada, inače se natpisi ne vide. Isključite neku pre dodavanja nove.`);
}

export async function createPrize(wheelId, input) {
  if (!wheelId) validationError("wheelId");
  if (!(await wheelRepo.findWheelById(wheelId))) notFound("Točak");
  const data = await normalizePrizeInput(input);
  const all = await wheelPrizeRepo.findAllPrizes();
  const ofWheel = all.filter((p) => String(p.wheel) === String(wheelId));
  assertActiveCount(ofWheel, { adding: data });
  const key = await uniquePrizeKey(input.key || data.label, all);
  const created = await wheelPrizeRepo.createPrize({ ...data, wheel: wheelId, key, awardedCount: 0, color: input.color ? data.color : PALETTE[ofWheel.length % PALETTE.length] });
  if (data.isFallback) await wheelPrizeRepo.unsetFallbackExcept(created._id, wheelId);
  logInfo("Wheel prize created", { prizeId: created._id, key });
  return toPrizeView(created);
}

/** Full edit of one prize (everything except its key, which coupons already minted refer to). */
export async function updatePrizeFull(prizeId, input) {
  if (!prizeId) validationError("prizeId");
  const existing = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!existing) notFound("Nagrada");
  const data = await normalizePrizeInput(input, existing);
  const all = await wheelPrizeRepo.findAllPrizes({ wheelId: existing.wheel });
  assertActiveCount(all, { replacing: { _id: existing._id, isActive: data.isActive } });
  if (existing.isFallback && !data.isFallback) {
    badRequest("Ovo je rezervna nagrada. Da biste je zamenili, označite drugu nagradu kao rezervnu.");
  }
  const updated = await wheelPrizeRepo.updatePrizeById(prizeId, data);
  if (data.isFallback) await wheelPrizeRepo.unsetFallbackExcept(updated._id, existing.wheel);
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
  const all = await wheelPrizeRepo.findAllPrizes({ wheelId: existing.wheel });
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
  if (isActive === false && existing.isActive) assertActiveCount(await wheelPrizeRepo.findAllPrizes({ wheelId: existing.wheel }), { replacing: { _id: existing._id, isActive: false } });
  const updated = await wheelPrizeRepo.updatePrizeById(prizeId, { weight, stock, validDays, isActive });
  logInfo("Wheel prize updated", { prizeId, weight, stock, validDays, isActive });
  return updated;
}

// ---------------- admin: točkovi ----------------

export async function listWheelsForAdmin() {
  await ensureDefaultPrizes();
  const [wheels, prizes, leadCounts] = await Promise.all([wheelRepo.findAllWheels(), wheelPrizeRepo.findAllPrizes(), leadRepo.countByWheel()]);
  const now = new Date();
  return wheels.map((w) => ({
    ...toWheelView(w),
    isOpen: isWheelOpen(w, now),
    prizeCount: prizes.filter((p) => String(p.wheel) === String(w._id)).length,
    leadCount: leadCounts.get(String(w._id)) || 0,
  }));
}

export async function getWheelBySlugForAdmin(slug) {
  return toWheelView(await resolveWheel(slug));
}

export async function getWheelForEdit(wheelId) {
  if (!wheelId) validationError("wheelId");
  const wheel = await wheelRepo.findWheelById(wheelId);
  if (!wheel) notFound("Točak");
  return toWheelView(wheel);
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

async function normalizeWheelInput(input, existing = null) {
  const name = String(input.name ?? "").trim();
  if (!name) badRequest("Naziv točka je obavezan");

  let slug = existing ? existing.slug : slugifyPrizeKey(input.slug || name);
  if (!existing) {
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) badRequest("Link (slug) može imati samo mala slova, brojeve i crtice (2-60 karaktera)");
    if (RESERVED_WHEEL_SLUGS.includes(slug)) badRequest(`Link „${slug}“ je rezervisan, izaberite drugi`);
    if (await wheelRepo.findWheelBySlug(slug)) conflict(`Točak sa linkom „${slug}“ već postoji`);
  }

  const validFrom = toDateOrNull(input.validFrom);
  const validUntil = toDateOrNull(input.validUntil);
  if (validFrom === "invalid" || validUntil === "invalid") badRequest("Neispravan datum");
  if (validFrom && validUntil && validUntil < validFrom) badRequest("Kraj igre ne može biti pre početka");

  return {
    name,
    slug,
    title: String(input.title ?? "").trim().slice(0, 120),
    intro: String(input.intro ?? "").trim().slice(0, 300),
    isActive: input.isActive !== false,
    validFrom,
    validUntil,
    order: num(input.order, existing?.order ?? 0),
  };
}

/** Pravi novi točak; `copyFrom` (id postojećeg) kopira njegove nagrade (sa novim ključevima i nulom podeljenih). */
export async function createWheel(input) {
  const data = await normalizeWheelInput(input);
  const created = await wheelRepo.createWheel(data);

  let copied = 0;
  if (input.copyFrom) {
    const source = await wheelRepo.findWheelById(input.copyFrom);
    if (!source) notFound("Točak za kopiranje");
    const all = await wheelPrizeRepo.findAllPrizes();
    const taken = [...all];
    const toCreate = [];
    for (const p of all.filter((x) => String(x.wheel) === String(source._id))) {
      const key = await uniquePrizeKey(p.key, taken);
      taken.push({ key });
      const { _id, createdAt, updatedAt, __v, ...rest } = p;
      toCreate.push({ ...rest, key, wheel: created._id, awardedCount: 0 });
    }
    if (toCreate.length) {
      await wheelPrizeRepo.createPrizes(toCreate);
      copied = toCreate.length;
    }
  }
  logInfo("Wheel created", { wheelId: created._id, slug: created.slug, copiedPrizes: copied });
  return { wheel: toWheelView(created), copiedPrizes: copied };
}

export async function updateWheel(wheelId, input) {
  if (!wheelId) validationError("wheelId");
  const existing = await wheelRepo.findWheelById(wheelId);
  if (!existing) notFound("Točak");
  const data = await normalizeWheelInput(input, existing);
  if (existing.slug === DEFAULT_WHEEL_SLUG && data.isActive === false) badRequest("Podrazumevani točak (/tocak) ne može da se isključi. Isključite pojedine nagrade ili napravite drugi točak.");
  delete data.slug; // link se ne menja - na njega vode odštampani QR kodovi
  const updated = await wheelRepo.updateWheelById(wheelId, data);
  logInfo("Wheel updated", { wheelId });
  return { before: toWheelView(existing), after: toWheelView(updated) };
}

/** Briše točak bez ijednog kontakta (zajedno sa njegovim nagradama). Sa kontaktima se samo isključuje. */
export async function deleteWheel(wheelId) {
  if (!wheelId) validationError("wheelId");
  const existing = await wheelRepo.findWheelById(wheelId);
  if (!existing) notFound("Točak");
  if (existing.slug === DEFAULT_WHEEL_SLUG) badRequest("Podrazumevani točak (/tocak) ne može da se obriše.");
  const leadCounts = await leadRepo.countByWheel();
  const leads = leadCounts.get(String(existing._id)) || 0;
  if (leads > 0) badRequest(`Na ovom točku ima ${leads} kontakata i ne može da se obriše. Isključite ga umesto toga.`);
  await wheelPrizeRepo.deletePrizesByWheel(existing._id);
  await wheelRepo.deleteWheelById(wheelId);
  logInfo("Wheel deleted", { wheelId, slug: existing.slug });
  return toWheelView(existing);
}

export default { listWheelOptions, listWheelsForAdmin, getWheelBySlugForAdmin, getWheelForEdit, createWheel, updateWheel, deleteWheel, getWheelConfig, spin, ensureDefaultPrizes, listWheelCoupons, listLeads, getLeadById, exportLeadsCsv, listSources, deleteLead, listPrizesForAdmin, getPrizeForEdit, listServiceOptions, createPrize, updatePrizeFull, deletePrize, updatePrize };
