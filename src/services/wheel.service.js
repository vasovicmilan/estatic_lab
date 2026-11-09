import wheelPrizeRepo from "../repositories/wheel-prize.repository.js";
import leadRepo from "../repositories/lead.repository.js";
import couponRepo from "../repositories/coupon.repository.js";
import serviceRepo from "../repositories/service.repository.js";
import categoryRepo from "../repositories/category.repository.js";
import eventEmitter from "../events/event.emitter.js";
import newsLetterService from "./news-letter.service.js";
import { mapLeadsForAdminList, mapLeadForAdminDetail, mapLeadsToCsv } from "../mappers/lead.mapper.js";
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

export async function ensureDefaultPrizes() {
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
      await newsLetterService.subscribe(email, SEGMENT_TO_INTERESTS[data.segment]);
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

export async function listSources() {
  return leadRepo.distinctSources();
}

export async function deleteLead(leadId) {
  if (!leadId) validationError("leadId");
  const removed = await leadRepo.deleteLeadById(leadId);
  if (!removed) notFound("Kontakt");
  logInfo("Lead deleted", { leadId });
}

export async function listPrizesForAdmin() {
  await ensureDefaultPrizes();
  return (await wheelPrizeRepo.findAllPrizes()).map((p) => ({
    id: p._id.toString(),
    key: p.key,
    label: p.label,
    weight: p.weight,
    stock: p.stock,
    awardedCount: p.awardedCount,
    remaining: p.stock == null ? null : Math.max(0, p.stock - p.awardedCount),
    validDays: p.validDays,
    isActive: p.isActive,
    isFallback: p.isFallback,
  }));
}

export async function updatePrize(prizeId, { weight, stock, validDays, isActive }) {
  if (!prizeId) validationError("prizeId");
  const existing = await wheelPrizeRepo.findPrizeById(prizeId);
  if (!existing) notFound("Nagrada");
  if (existing.isFallback && isActive === false) badRequest("Rezervna nagrada ne može da se isključi - točak mora imati šta da dodeli.");
  if (stock != null && stock < existing.awardedCount) badRequest(`Zaliha ne može biti manja od već podeljenih (${existing.awardedCount})`);
  const updated = await wheelPrizeRepo.updatePrizeById(prizeId, { weight, stock, validDays, isActive });
  logInfo("Wheel prize updated", { prizeId, weight, stock, validDays, isActive });
  return updated;
}

export default { getWheelConfig, spin, ensureDefaultPrizes, listLeads, getLeadById, exportLeadsCsv, listSources, deleteLead, listPrizesForAdmin, updatePrize };
