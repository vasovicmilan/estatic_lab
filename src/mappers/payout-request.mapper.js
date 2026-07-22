import { formatDateTime } from "../utils/date.time.util.js";

const STATUS_LABELS = { requested: "Zatraženo", approved: "Odobreno", paid: "Isplaćeno", rejected: "Odbijeno" };

export function translateStatus(status) {
  return STATUS_LABELS[status] || status;
}

function getEarnerName(request) {
  const earner = request.earnerType === "employee" ? request.employee : request.partner;
  if (earner && typeof earner === "object" && earner.userId && typeof earner.userId === "object") {
    const first = earner.userId.firstName || "";
    const last = earner.userId.lastName || "";
    return `${first} ${last}`.trim() || "Nepoznato";
  }
  return "Nepoznato";
}

export function mapPayoutRequestForAdminShort(request) {
  return {
    id: request._id.toString(),
    earnerType: request.earnerType === "employee" ? "Zaposleni" : "Partner",
    earnerName: getEarnerName(request),
    iznos: `${request.amount} RSD`,
    status: translateStatus(request.status),
    statusRaw: request.status,
    zatrazeno: formatDateTime(request.requestedAt || request.createdAt),
  };
}

export function mapPayoutRequestsForAdminList(requests = []) {
  return requests.map(mapPayoutRequestForAdminShort).filter(Boolean);
}

export function mapPayoutRequestForAdminDetail(request) {
  if (!request) return null;
  return {
    id: request._id.toString(),
    earnerType: request.earnerType === "employee" ? "Zaposleni" : "Partner",
    earnerName: getEarnerName(request),
    iznos: `${request.amount} RSD`,
    status: translateStatus(request.status),
    statusRaw: request.status,
    napomena: request.adminNote || null,
    vreme: {
      zatrazeno: formatDateTime(request.requestedAt || request.createdAt),
      odobreno: request.approvedAt ? formatDateTime(request.approvedAt) : null,
      isplaceno: request.paidAt ? formatDateTime(request.paidAt) : null,
      odbijeno: request.rejectedAt ? formatDateTime(request.rejectedAt) : null,
    },
  };
}

export default { mapPayoutRequestForAdminShort, mapPayoutRequestsForAdminList, mapPayoutRequestForAdminDetail, translateStatus };