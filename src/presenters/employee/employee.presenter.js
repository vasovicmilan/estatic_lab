import { formatDateTime } from "../../utils/date.time.util.js";
import { formatPrice } from "../../utils/price.util.js";
import { translateCommissionSourceType, translateCommissionStatus } from "../../utils/commission-display.util.js";

const PAYOUT_STATUS_LABELS = { requested: "Zatraženo", approved: "Odobreno", paid: "Isplaćeno", rejected: "Odbijeno" };

export function prepareEmployeeDashboardData({
  todayAppointments = [],
  pendingCount = 0,
  weekAppointments = [],
  isCommissionBased = false,
  balance = null,
  recentCommissions = [],
} = {}) {
  return {
    todayAppointments,
    pendingCount,
    weekAppointments,
    isCommissionBased,
    balance: balance
      ? {
          earned: formatPrice(balance.earned),
          paid: formatPrice(balance.paid),
          reserved: formatPrice(balance.reserved),
          available: formatPrice(balance.available),
        }
      : null,
    recentCommissions: recentCommissions.map(mapCommissionRow),
  };
}

export function prepareEmployeeAppointmentTabData(result, query = {}) {
  return {
    appointments: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-nalog/termini",
      query,
    },
    filters: [
      { value: "", label: "Svi" },
      { value: "pending", label: "Na čekanju" },
      { value: "confirmed", label: "Potvrđeno" },
      { value: "completed", label: "Završeno" },
      { value: "no_show", label: "Nije se pojavio/la" },
    ],
  };
}

export function prepareEmployeeAppointmentDetailData(appointment) {
  return {
    appointment,
    canConfirm: appointment.status === "Na čekanju",
    canReject: appointment.status === "Na čekanju",
    canComplete: appointment.status === "Potvrđeno",
    canNoShow: appointment.status === "Potvrđeno",
    backUrl: "/moj-nalog/termini",
  };
}

const SCHEDULE_DAYS = [
  { value: "monday", label: "Ponedeljak" },
  { value: "tuesday", label: "Utorak" },
  { value: "wednesday", label: "Sreda" },
  { value: "thursday", label: "Četvrtak" },
  { value: "friday", label: "Petak" },
  { value: "saturday", label: "Subota" },
  { value: "sunday", label: "Nedelja" },
];

export function prepareEmployeeProfileTabData(employee) {
  return {
    employee,
    workingHoursEditUrl: "/moj-nalog/profil/radno-vreme",
    scheduleDays: SCHEDULE_DAYS,
  };
}

export function prepareEmployeeCommissionsTabData(result, query = {}) {
  return {
    items: result.data.map(mapCommissionRow),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-nalog/provizije",
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
          { value: "order", label: "Porudžbina" },
          { value: "package_purchase", label: "Paket" },
        ],
      },
    },
  };
}

export function prepareEmployeePayoutsTabData(result, query = {}) {
  return {
    items: result.data.map(mapPayoutRequestRow),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-nalog/isplate",
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

function mapCommissionRow(entry) {
  return {
    id: entry._id?.toString?.() || entry.id,
    izvor: translateCommissionSourceType(entry.sourceType),
    osnovnaVrednost: `${formatPrice(entry.baseValue)} RSD`,
    procenat: `${entry.rate}%`,
    iznos: `${formatPrice(entry.amount)} RSD`,
    status: translateCommissionStatus(entry.status),
    datum: entry.earnedAt || entry.createdAt,
  };
}

function mapPayoutRequestRow(request) {
  return {
    iznos: `${formatPrice(request.amount)} RSD`,
    status: PAYOUT_STATUS_LABELS[request.status] || request.status,
    statusRaw: request.status,
    napomena: request.adminNote || null,
    zatrazeno: formatDateTime(request.requestedAt),
    azurirano: formatDateTime(request.paidAt || request.rejectedAt || request.approvedAt || request.requestedAt),
  };
}