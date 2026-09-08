import { formatDateTime } from "../../utils/date.time.util.js";
import { formatPrice, formatMoney } from "../../utils/price.util.js";
import { translateCommissionSourceType, translateCommissionStatus } from "../../utils/commission-display.util.js";

import { BUSINESS } from "../../config/business.config.js";
const BASE_URL = BUSINESS.siteUrl;

const PAYOUT_STATUS_LABELS = { requested: "Zatraženo", approved: "Odobreno", paid: "Isplaćeno", rejected: "Odbijeno" };

export function preparePartnerDashboardData({ partner, balance, coupons, serviceNamesById = {}, packageNamesById = {}, recentCommissions, payoutRequests = [] }) {
  return {
    partner,
    balance: {
      earned: formatMoney(balance.earned),
      paid: formatMoney(balance.paid),
      reserved: formatMoney(balance.reserved),
      available: formatMoney(balance.available),
      // the withdrawal form's `max`/`placeholder` need a bare number, not a
      // "1234 RSD" display string - see views/partner/dashboard.ejs
      availableRaw: formatPrice(balance.available),
    },
    // one referral link per coupon that references this partner - a partner could
    // theoretically have more than one active code (e.g. a seasonal promo alongside
    // their standing one), so this isn't assumed to be exactly one
    referralLinks: coupons.map((c) => ({
      code: c.code,
      uslugeOpis: describeMainDiscount(c),
      opseg: describeScope(c, serviceNamesById, packageNamesById),
      // null when this coupon doesn't cover artikli at all (see
      // coupon.service.js's listCouponsForPartner) - the dashboard only shows
      // an artikli line for coupons that actually have one, instead of always
      // showing a products discount that might not exist.
      artikliOpis: c.productDiscount ? describeProductDiscount(c.productDiscount) : null,
      vaziDo: c.validUntil ? formatDateTime(c.validUntil) : null,
      // always shown now, capped or not - "iskorišćeno 47 puta" is useful
      // motivating info for a partner even when there's no maxUses ceiling to
      // measure it against, not just when a limit makes it a fraction.
      iskorisceno: c.maxUses ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount} puta`,
      link: `${BASE_URL}/?code=${encodeURIComponent(c.code)}`,
    })),
    recentCommissions: recentCommissions.map(mapCommissionRow),
    payoutRequests: payoutRequests.map(mapPayoutRequestRow),
  };
}

function mapPayoutRequestRow(request) {
  return {
    iznos: formatMoney(request.amount),
    status: PAYOUT_STATUS_LABELS[request.status] || request.status,
    statusRaw: request.status,
    napomena: request.adminNote || null,
    zatrazeno: formatDateTime(request.requestedAt),
    // whichever of these actually happened, for a compact "last update" column -
    // paid/rejected are terminal so at most one of them is ever set alongside approvedAt
    azurirano: formatDateTime(request.paidAt || request.rejectedAt || request.approvedAt || request.requestedAt),
  };
}

export function preparePartnerPayoutsTabData(result, query = {}) {
  return {
    items: result.data.map(mapPayoutRequestRow),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-partner-nalog/isplate",
      query,
    },
    filters: {
      status: {
        value: query.status || "",
        options: [
          { value: "", label: "Svi statusi" },
          { value: "requested", label: "Zatraženo" },
          { value: "approved", label: "Odobreno" },
          { value: "paid", label: "Isplaćeno" },
          { value: "rejected", label: "Odbijeno" },
        ],
      },
    },
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
    filters: {
      status: {
        value: query.status || "",
        options: [
          { value: "", label: "Svi statusi" },
          { value: "pending", label: "Na čekanju" },
          { value: "earned", label: "Zarađeno" },
          { value: "reversed", label: "Stornirano" },
        ],
      },
      sourceType: {
        value: query.sourceType || "",
        options: [
          { value: "", label: "Svi izvori" },
          { value: "appointment", label: "Termin" },
          { value: "package_purchase", label: "Paket" },
          { value: "order", label: "Porudžbina" },
        ],
      },
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
    izvor: translateCommissionSourceType(entry.sourceType),
    osnovnaVrednost: formatMoney(entry.baseValue),
    procenat: `${entry.rate}%`,
    iznos: formatMoney(entry.amount),
    status: translateCommissionStatus(entry.status),
    datum: entry.earnedAt || entry.createdAt,
  };
}

function describeMainDiscount(coupon) {
  const discount = coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue);
  return `Popust od ${discount} na usluge i pakete za korisnike koji koriste ovaj link`;
}

// Empty applicableServices/applicablePackages means "this coupon applies to
// every service and package" (see coupon.model.js's own comment) - that's
// the common case and reads better as one clear sentence than an empty list.
// When a coupon IS restricted, name each service/package explicitly rather
// than just showing a count, since "važi za 3 usluge" tells a partner nothing
// they can act on - they need to know which 3 to actually promote.
function describeScope(coupon, serviceNamesById, packageNamesById) {
  const hasServiceRestriction = coupon.applicableServices.length > 0;
  const hasPackageRestriction = coupon.applicablePackages.length > 0;

  if (!hasServiceRestriction && !hasPackageRestriction) {
    return "Važi za sve usluge i pakete";
  }

  const parts = [];
  if (hasServiceRestriction) {
    const names = coupon.applicableServices.map((id) => serviceNamesById[id]).filter(Boolean);
    if (names.length > 0) parts.push(`usluge: ${names.join(", ")}`);
  }
  if (hasPackageRestriction) {
    const names = coupon.applicablePackages.map((id) => packageNamesById[id]).filter(Boolean);
    if (names.length > 0) parts.push(`pakete: ${names.join(", ")}`);
  }
  return parts.length > 0 ? `Važi samo za ${parts.join(" i ")}` : "Važi za odabrane usluge/pakete";
}

function describeProductDiscount(productDiscount) {
  const discount =
    productDiscount.discountType === "percentage" ? `${productDiscount.discountValue}%` : formatMoney(productDiscount.discountValue);
  return `Popust od ${discount} i na artikle iz prodavnice`;
}