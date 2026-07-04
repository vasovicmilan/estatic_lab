import { formatDateTime, formatDate } from "../utils/date.time.util.js";

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

function formatDiscountValue(coupon) {
  return coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `${coupon.discountValue} RSD`;
}

export function mapCouponsForAdminList(coupons = []) {
  return coupons
    .map((coupon) => {
      if (!coupon) return null;
      return {
        id: coupon._id.toString(),
        kod: coupon.code,
        tip: translateDiscountType(coupon.discountType),
        popust: formatDiscountValue(coupon),
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
      popust: formatDiscountValue(coupon),
      minimalnaVrednostTermina: coupon.minAppointmentValue ? `${coupon.minAppointmentValue} RSD` : null,
      aktivnost: translateActive(coupon.isActive),
    },
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
      typeof s === "object" ? { id: s._id.toString(), naziv: s.name } : { id: s.toString() }
    ),
    istorijaKoriscenja: (coupon.usageHistory || []).map((u) => ({
      korisnikId: typeof u.user === "object" ? u.user._id.toString() : u.user?.toString(),
      terminId: typeof u.appointment === "object" ? u.appointment._id.toString() : u.appointment?.toString(),
      iznosPopusta: `${u.discountAmount} RSD`,
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
    minAppointmentValue: coupon.minAppointmentValue || 0,
    maxUses: coupon.maxUses,
    maxUsesPerUser: coupon.maxUsesPerUser,
    applicableServices: (coupon.applicableServices || []).map((s) => s._id?.toString() || s.toString()),
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
    isActive: coupon.isActive,
  };
}

// what "apply coupon" at checkout shows — no usage history, no other users' data
export function mapCouponForBookingPreview(coupon) {
  if (!coupon) return null;

  return {
    kod: coupon.code,
    popust: formatDiscountValue(coupon),
    minimalnaVrednostTermina: coupon.minAppointmentValue || 0,
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
