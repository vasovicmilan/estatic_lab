import { formatDateTime, formatDate } from "../utils/date.time.util.js";
import { formatMoney } from "../utils/price.util.js";

function resolveRefId(ref) {
  if (!ref) return null;
  return (ref._id || ref).toString();
}

function translateDiscountType(type) {
  const map = {
    percentage: "Procenat",
    fixed: "Fiksni iznos",
  };
  return map[type] || type;
}

function translateActive(isActive) {
  return isActive ? "Aktivan" : "Neaktivan";
}

function formatMaxUses(maxUses) {
  if (maxUses === null || maxUses === undefined) return "Neograničeno";
  return maxUses;
}

function formatDiscountValue(discountType, discountValue) {
  return discountType === "percentage" ? `${discountValue}%` : formatMoney(discountValue);
}

export function mapCouponsForAdminList(coupons = []) {
  return coupons
    .map((coupon) => {
      if (!coupon) return null;
      return {
        id: coupon._id.toString(),
        kod: coupon.code,
        tip: translateDiscountType(coupon.discountType),
        popust: formatDiscountValue(coupon.discountType, coupon.discountValue),
        maxUpotreba: formatMaxUses(coupon.maxUses),
        iskorisceno: coupon.usedCount || 0,
        aktivnost: translateActive(coupon.isActive),
        vaziOd: formatDate(coupon.validFrom),
        vaziDo: formatDate(coupon.validUntil),
        kreiran: formatDateTime(coupon.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapCouponForAdminDetail(coupon) {
  if (!coupon) return null;

  return {
    id: coupon._id.toString(),
    osnovno: {
      kod: coupon.code,
      tip: translateDiscountType(coupon.discountType),
      popust: formatDiscountValue(coupon.discountType, coupon.discountValue),
      maxPopust: coupon.maxDiscountAmount ? formatMoney(coupon.maxDiscountAmount) : null,
      minimalnaVrednost: coupon.minValue ? formatMoney(coupon.minValue) : null,
      aktivnost: translateActive(coupon.isActive),
    },
    // odvojen, opcioni deo kupona za artikle (shop) - potpuno nezavisan tip/vrednost/
    // ograničenja od gornjeg "osnovno" bloka koji važi za usluge/pakete. Ako
    // productDiscount nije podešen, ovaj kupon se uopšte ne može iskoristiti na
    // porudžbini artikala (videti coupon.service.js's validateProductDiscount)
    proizvodi: coupon.productDiscount
      ? {
          aktivno: true,
          tip: translateDiscountType(coupon.productDiscount.discountType),
          popust: formatDiscountValue(coupon.productDiscount.discountType, coupon.productDiscount.discountValue),
          maxPopust: coupon.productDiscount.maxDiscountAmount ? formatMoney(coupon.productDiscount.maxDiscountAmount) : null,
          minimalnaVrednostPorudzbine: coupon.productDiscount.minOrderValue ? formatMoney(coupon.productDiscount.minOrderValue) : null,
        }
      : { aktivno: false },
    ogranicenja: {
      maxUpotreba: formatMaxUses(coupon.maxUses),
      maxUpotrebaPoKorisniku: formatMaxUses(coupon.maxUsesPerUser),
      trenutnoIskorisceno: coupon.usedCount || 0,
    },
    vremeVazenja: {
      pocinje: coupon.validFrom ? formatDateTime(coupon.validFrom) : null,
      istice: coupon.validUntil ? formatDateTime(coupon.validUntil) : null,
    },
    primenljivoNaUsluge: (coupon.applicableServices || []).map((s) =>
      s?.name ? { id: s._id.toString(), naziv: s.name } : { id: resolveRefId(s) }
    ),
    primenljivoNaPakete: (coupon.applicablePackages || []).map((p) =>
      p?.name ? { id: p._id.toString(), naziv: p.name } : { id: resolveRefId(p) }
    ),
    primenljivoNaProizvode: (coupon.productDiscount?.applicableProducts || []).map((p) =>
      p?.name ? { id: p._id.toString(), naziv: p.name } : { id: resolveRefId(p) }
    ),
    partner: coupon.partner
      ? {
          id: resolveRefId(coupon.partner),
          imePrezime:
            coupon.partner?.userId && typeof coupon.partner.userId === "object" && coupon.partner.userId.firstName
              ? `${coupon.partner.userId.firstName} ${coupon.partner.userId.lastName || ""}`.trim()
              : "Nepoznato",
        }
      : null,
    istorijaKoriscenja: (coupon.usageHistory || []).map((u) => ({
      korisnikId: resolveRefId(u.user),
      terminId: resolveRefId(u.appointment),
      paketId: resolveRefId(u.packagePurchase),
      porudzbinaId: resolveRefId(u.order),
      iznosPopusta: formatMoney(u.discountAmount),
      iskoriscenoU: formatDateTime(u.usedAt),
    })),
    vreme: {
      kreiran: formatDateTime(coupon.createdAt),
      poslednjeIzmenjen: formatDateTime(coupon.updatedAt),
    },
  };
}

export function mapCouponForEdit(coupon) {
  if (!coupon) return null;

  return {
    id: coupon._id.toString(),
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount ?? null,
    minValue: coupon.minValue || 0,
    maxUses: coupon.maxUses,
    maxUsesPerUser: coupon.maxUsesPerUser,
    applicableServices: (coupon.applicableServices || []).map((s) => s._id?.toString() || s.toString()),
    applicablePackages: (coupon.applicablePackages || []).map((p) => p._id?.toString() || p.toString()),
    // spljošteno iz coupon.productDiscount (ugnježdeni objekat u bazi) u ravna
    // polja, pošto generička admin forma vezuje flat imena polja - videti
    // coupon.controller.js's buildCouponPayload, koji radi obrnutu transformaciju
    // pri čuvanju.
    productDiscountEnabled: !!coupon.productDiscount,
    productDiscountType: coupon.productDiscount?.discountType || "percentage",
    productDiscountValue: coupon.productDiscount?.discountValue ?? 0,
    productDiscountMaxAmount: coupon.productDiscount?.maxDiscountAmount ?? null,
    productMinOrderValue: coupon.productDiscount?.minOrderValue ?? 0,
    applicableProducts: (coupon.productDiscount?.applicableProducts || []).map((p) => p._id?.toString() || p.toString()),
    partner: coupon.partner ? resolveRefId(coupon.partner) : null,
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
    isActive: coupon.isActive,
  };
}

// what "apply coupon" at checkout shows - no usage history, no other users' data
export function mapCouponForBookingPreview(coupon) {
  if (!coupon) return null;

  return {
    kod: coupon.code,
    popust: formatDiscountValue(coupon.discountType, coupon.discountValue),
    minimalnaVrednostTermina: coupon.minValue || 0,
    vaziDo: formatDate(coupon.validUntil),
  };
}

export function mapCouponRaw(coupon) {
  return coupon;
}

export default {
  mapCouponsForAdminList,
  mapCouponForAdminDetail,
  mapCouponForEdit,
  mapCouponForBookingPreview,
  mapCouponRaw,
};