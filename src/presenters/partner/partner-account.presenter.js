import { formatDateTime } from "../../utils/date.time.util.js";

const BASE_URL = process.env.BASE_URL || "https://beautymedica.rs";

const PAYOUT_STATUS_LABELS = { requested: "Zatraženo", approved: "Odobreno", paid: "Isplaćeno", rejected: "Odbijeno" };

export function preparePartnerDashboardData({ partner, balance, coupons, recentCommissions, payoutRequests = [] }) {
  return {
    partner,
    balance: {
      earned: balance.earned,
      paid: balance.paid,
      reserved: balance.reserved,
      available: balance.available,
    },
    // one referral link per coupon that references this partner - a partner could
    // theoretically have more than one active code (e.g. a seasonal promo alongside
    // their standing one), so this isn't assumed to be exactly one
    referralLinks: coupons.map((c) => ({
      code: c.code,
      opis: describeCoupon(c),
      link: `${BASE_URL}/?code=${encodeURIComponent(c.code)}`,
    })),
    recentCommissions: recentCommissions.map(mapCommissionRow),
    payoutRequests: payoutRequests.map(mapPayoutRequestRow),
  };
}

function mapPayoutRequestRow(request) {
  return {
    iznos: `${request.amount} RSD`,
    status: PAYOUT_STATUS_LABELS[request.status] || request.status,
    statusRaw: request.status,
    napomena: request.adminNote || null,
    zatrazeno: formatDateTime(request.requestedAt),
    // whichever of these actually happened, for a compact "last update" column -
    // paid/rejected are terminal so at most one of them is ever set alongside approvedAt
    azurirano: formatDateTime(request.paidAt || request.rejectedAt || request.approvedAt || request.requestedAt),
  };
}

export function preparePartnerCommissionsTabData(result, query = {}) {
  return {
    items: result.data.map(mapCommissionRow),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-partner-nalog/provizije",
      query,
    },
  };
}

export function preparePayoutRequestFormData(balance) {
  return {
    available: balance.available,
    formAction: "/moj-partner-nalog/isplata",
  };
}

function mapCommissionRow(entry) {
  return {
    id: entry._id?.toString?.() || entry.id,
    izvor: entry.sourceType === "appointment" ? "Termin" : "Porudžbina",
    osnovnaVrednost: `${entry.baseValue} RSD`,
    procenat: `${entry.rate}%`,
    iznos: `${entry.amount} RSD`,
    status: translateCommissionStatus(entry.status),
    datum: entry.earnedAt || entry.createdAt,
  };
}

function translateCommissionStatus(status) {
  const map = { pending: "Na čekanju", earned: "Zarađeno", reversed: "Stornirano" };
  return map[status] || status;
}

function describeCoupon(coupon) {
  const discount = coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `${coupon.discountValue} RSD`;
  return `Popust od ${discount} za korisnike koji koriste ovaj link`;
}